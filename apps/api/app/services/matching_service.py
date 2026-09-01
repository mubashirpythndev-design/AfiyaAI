"""Afiya AI — Medicine Matching & Normalization Engine (Exact, Token Set, Alias & Fuzzy Matching).
Author / Developer: Mubashir (Lead Developer)
"""

import logging
import re
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from thefuzz import fuzz

from app.config import settings
from app.db.database import Medicine
from app.models.schemas import MedicineSchema

logger = logging.getLogger(__name__)


def normalize(text: str) -> str:
    """Normalize medicine name for comparison."""
    text = text.lower().strip()
    # Normalize spaced dosages (e.g., '500 mg' -> '500mg', '10 ml' -> '10ml')
    text = re.sub(r"(\d+)\s*(mg|ml|mcg|g|iu|iu/ml|%)\b", r"\1\2", text)
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

    cand_tokens = set(re.findall(r"\b[a-z0-9]+\b", normalized))

    # 1. Exact match on brand_name
    result = await db.execute(
        select(Medicine).where(func.lower(Medicine.brand_name) == normalized)
    )
    med = result.scalar_one_or_none()
    if med:
        logger.info(f"Exact brand match: '{candidate}' -> {med.brand_name}")
        return {"medicine": medicine_to_schema(med), "confidence": 1.0, "needs_confirmation": False, "alternatives": []}

    # 2. Match on generic_name (exact or stripped of dosage tokens)
    clean_gen_query = re.sub(r"\b\d+\s*(mg|ml|mcg|g|iu|iu/ml|%)\b", "", normalized).strip()
    result = await db.execute(
        select(Medicine).where(
            or_(
                func.lower(Medicine.generic_name) == normalized,
                func.lower(Medicine.generic_name) == clean_gen_query,
            )
        )
    )
    generic_meds = result.scalars().all()
    if generic_meds:
        # If candidate explicitly specified strength, prioritize matching strength
        cand_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalized))
        if cand_strength_tokens:
            filtered_by_strength = [
                m for m in generic_meds
                if set(re.findall(r"\b\d+[a-z]*\b", normalize(m.strength))).intersection(cand_strength_tokens)
            ]
            if filtered_by_strength:
                generic_meds = filtered_by_strength

        if len(generic_meds) == 1:
            med = generic_meds[0]
            logger.info(f"Single generic match: '{candidate}' -> {med.brand_name}")
            return {"medicine": medicine_to_schema(med), "confidence": 1.0, "needs_confirmation": False, "alternatives": []}

        logger.info(f"Generic match: '{candidate}' -> {len(generic_meds)} brands")
        return {
            "medicine": None,
            "confidence": 1.0,
            "needs_confirmation": True,
            "alternatives": [medicine_to_schema(m) for m in generic_meds][:10],
        }

    # 3. Check all medicines for token containment & aliases
    all_medicines = await db.execute(select(Medicine))
    all_meds = all_medicines.scalars().all()

    # 3a. Whole-word token containment on brand name / aliases
    for med in all_meds:
        brand_tokens = set(re.findall(r"\b[a-z0-9]+\b", normalize(med.brand_name)))
        if brand_tokens and brand_tokens.issubset(cand_tokens):
            # Check strength if candidate explicitly contains numbers
            med_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalize(med.strength)))
            cand_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalized))
            if not med_strength_tokens or not cand_strength_tokens or med_strength_tokens.intersection(cand_strength_tokens):
                logger.info(f"Token brand match: '{candidate}' -> {med.brand_name}")
                return {"medicine": medicine_to_schema(med), "confidence": 0.95, "needs_confirmation": False, "alternatives": []}

        for alias in (med.aliases or []):
            if normalize(alias) == normalized:
                logger.info(f"Alias match: '{candidate}' -> {med.brand_name} (alias: {alias})")
                return {"medicine": medicine_to_schema(med), "confidence": 0.95, "needs_confirmation": False, "alternatives": []}

    # 4. Strict Fuzzy match against brand names, generic names, and aliases
    best_match: Optional[Medicine] = None
    best_score = 0.0
    alternatives: list[MedicineSchema] = []

    for med in all_meds:
        # Check brand name
        score = fuzz.token_set_ratio(normalized, normalize(med.brand_name)) / 100.0
        # Check generic name
        gen_score = fuzz.token_set_ratio(normalized, normalize(med.generic_name)) / 100.0
        score = max(score, gen_score)
        # Check aliases
        for alias in (med.aliases or []):
            alias_score = fuzz.token_set_ratio(normalized, normalize(alias)) / 100.0
            score = max(score, alias_score)

        if score >= 0.75:
            alternatives.append(medicine_to_schema(med))

        if score > best_score:
            best_score = score
            best_match = med

    alternatives.sort(key=lambda m: m.brand_name)
    threshold = settings.fuzzy_match_threshold

    # Only treat as a match if best_score is high (>= threshold or >= 0.82)
    if best_match and best_score >= max(threshold, 0.82):
        logger.info(f"Fuzzy match: '{candidate}' -> {best_match.brand_name} (score: {best_score:.2f})")
        return {
            "medicine": medicine_to_schema(best_match),
            "confidence": round(best_score, 2),
            "needs_confirmation": False,
            "alternatives": alternatives[:3],
        }

    logger.info(f"No strong match found for: '{candidate}' (best: {best_score:.2f})")
    return {"medicine": None, "confidence": round(best_score, 2), "needs_confirmation": True, "alternatives": alternatives[:3]}
