"""Medicine matching service: normalize -> exact -> alias -> fuzzy matching."""

import logging
import re
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from thefuzz import fuzz

from app.config import settings
from app.db.database import Medicine
from app.models.schemas import MedicineSchema

logger = logging.getLogger(__name__)


def normalize(text: str) -> str:
    """Normalize medicine name for comparison."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def medicine_to_schema(med: Medicine) -> MedicineSchema:
    return MedicineSchema(
        id=str(med.id),
        brand_name=med.brand_name,
        generic_name=med.generic_name,
        dosage_form=med.dosage_form,
        strength=med.strength,
        manufacturer=med.manufacturer or "",
        registration_info=med.registration_info,
        aliases=med.aliases or [],
        category=med.category or "",
    )


async def match_medicine(candidate: str, db: AsyncSession) -> dict:
    """Match a candidate name against the verified medicine database."""
    normalized = normalize(candidate)
    if not normalized:
        return {"medicine": None, "confidence": 0.0, "needs_confirmation": True, "alternatives": []}

    # 1. Exact match on brand_name
    result = await db.execute(
        select(Medicine).where(func.lower(Medicine.brand_name) == normalized)
    )
    med = result.scalar_one_or_none()
    if med:
        logger.info(f"Exact brand match: '{candidate}' -> {med.brand_name}")
        return {"medicine": medicine_to_schema(med), "confidence": 1.0, "needs_confirmation": False, "alternatives": []}

    # 2. Exact match on generic_name
    result = await db.execute(
        select(Medicine).where(func.lower(Medicine.generic_name) == normalized)
    )
    med = result.scalar_one_or_none()
    if med:
        logger.info(f"Exact generic match: '{candidate}' -> {med.brand_name}")
        return {"medicine": medicine_to_schema(med), "confidence": 1.0, "needs_confirmation": False, "alternatives": []}

    # 3. Alias match (check JSONB aliases)
    all_medicines = await db.execute(select(Medicine))
    all_meds = all_medicines.scalars().all()

    for med in all_meds:
        aliases = med.aliases or []
        for alias in aliases:
            if normalize(alias) == normalized:
                logger.info(f"Alias match: '{candidate}' -> {med.brand_name} (alias: {alias})")
                return {"medicine": medicine_to_schema(med), "confidence": 0.9, "needs_confirmation": False, "alternatives": []}

    # 4. Fuzzy match against brand names, generic names, and aliases
    best_match: Optional[Medicine] = None
    best_score = 0.0
    alternatives: list[MedicineSchema] = []

    for med in all_meds:
        # Check brand name
        score = fuzz.ratio(normalized, normalize(med.brand_name)) / 100.0
        # Check generic name
        gen_score = fuzz.ratio(normalized, normalize(med.generic_name)) / 100.0
        score = max(score, gen_score)
        # Check aliases
        for alias in (med.aliases or []):
            alias_score = fuzz.ratio(normalized, normalize(alias)) / 100.0
            score = max(score, alias_score)

        if score >= 0.6:
            alternatives.append(medicine_to_schema(med))

        if score > best_score:
            best_score = score
            best_match = med

    alternatives.sort(key=lambda m: m.brand_name)
    threshold = settings.fuzzy_match_threshold
    needs_confirmation = best_score < threshold

    if best_match and best_score >= 0.6:
        logger.info(f"Fuzzy match: '{candidate}' -> {best_match.brand_name} (score: {best_score:.2f})")
        return {
            "medicine": medicine_to_schema(best_match),
            "confidence": round(best_score, 2),
            "needs_confirmation": needs_confirmation,
            "alternatives": alternatives[:3],
        }

    logger.info(f"No match found for: '{candidate}'")
    return {"medicine": None, "confidence": best_score, "needs_confirmation": True, "alternatives": alternatives[:3]}
