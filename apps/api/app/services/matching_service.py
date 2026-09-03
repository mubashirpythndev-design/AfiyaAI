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
from app.db.database import Medicine, MedicinePrice
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

        # If candidate explicitly specified dosage form (e.g. tablet, syrup, suspension, capsule, drop, injection)
        for form_word in ["tablet", "capsule", "syrup", "suspension", "injection", "drops"]:
            if form_word in normalized:
                filtered_by_form = [m for m in generic_meds if form_word in normalize(m.dosage_form)]
                if filtered_by_form:
                    generic_meds = filtered_by_form
                break

        if len(generic_meds) > 1:
            med_ids = [m.id for m in generic_meds]
            prices_res = await db.execute(
                select(MedicinePrice.medicine_id, func.min(MedicinePrice.price)).where(
                    MedicinePrice.medicine_id.in_(med_ids)
                ).group_by(MedicinePrice.medicine_id)
            )
            price_map = {row[0]: row[1] for row in prices_res.all()}
            generic_meds.sort(key=lambda m: price_map.get(m.id, float("inf")))

        if len(generic_meds) == 1:
            med = generic_meds[0]
            logger.info(f"Single generic match: '{candidate}' -> {med.brand_name}")
            return {"medicine": medicine_to_schema(med), "confidence": 1.0, "needs_confirmation": False, "alternatives": []}

        logger.info(f"Generic match: '{candidate}' -> {len(generic_meds)} brands (cheapest: {generic_meds[0].brand_name})")
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
    best_brand_match: Optional[Medicine] = None
    best_brand_score = 0.0
    best_gen_match: Optional[Medicine] = None
    best_gen_score = 0.0
    alternatives: list[MedicineSchema] = []

    clean_cand = re.sub(r"\b\d+\s*(mg|ml|mcg|g|iu|iu/ml|%)\b", "", normalized).strip()

    for med in all_meds:
        # Check brand name
        b_score = max(
            fuzz.token_set_ratio(normalized, normalize(med.brand_name)),
            fuzz.token_set_ratio(clean_cand, normalize(med.brand_name))
        ) / 100.0

        for alias in (med.aliases or []):
            a_score = fuzz.token_set_ratio(normalized, normalize(alias)) / 100.0
            b_score = max(b_score, a_score)

        if b_score > best_brand_score:
            best_brand_score = b_score
            best_brand_match = med

        # Check generic name
        g_score = max(
            fuzz.token_set_ratio(normalized, normalize(med.generic_name)),
            fuzz.token_set_ratio(clean_cand, normalize(med.generic_name))
        ) / 100.0

        if g_score > best_gen_score:
            best_gen_score = g_score
            best_gen_match = med

        if max(b_score, g_score) >= 0.75:
            alternatives.append(medicine_to_schema(med))

    threshold = settings.fuzzy_match_threshold

    # If the user query matches a GENERIC name better or equal to brand name (e.g. Paracetomol, Ibuprefen, Omeprazol)
    if best_gen_match and best_gen_score >= max(threshold, 0.82) and best_gen_score >= best_brand_score:
        matched_gen_name = best_gen_match.generic_name.lower()
        same_gen_meds = [m for m in all_meds if m.generic_name.lower() == matched_gen_name]

        # Filter by strength if specified
        cand_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalized))
        if cand_strength_tokens:
            filtered = [
                m for m in same_gen_meds
                if set(re.findall(r"\b\d+[a-z]*\b", normalize(m.strength))).intersection(cand_strength_tokens)
            ]
            if filtered:
                same_gen_meds = filtered

        if len(same_gen_meds) == 1:
            med = same_gen_meds[0]
            logger.info(f"Fuzzy single generic match: '{candidate}' -> {med.brand_name}")
            return {"medicine": medicine_to_schema(med), "confidence": round(best_gen_score, 2), "needs_confirmation": False, "alternatives": []}

        logger.info(f"Fuzzy generic match: '{candidate}' -> {len(same_gen_meds)} brands for generic '{best_gen_match.generic_name}'")
        return {
            "medicine": None,
            "confidence": round(best_gen_score, 2),
            "needs_confirmation": True,
            "alternatives": [medicine_to_schema(m) for m in same_gen_meds][:10],
        }

    # Otherwise, if brand match is highest
    if best_brand_match and best_brand_score >= max(threshold, 0.82):
        logger.info(f"Fuzzy brand match: '{candidate}' -> {best_brand_match.brand_name} (score: {best_brand_score:.2f})")
        return {
            "medicine": medicine_to_schema(best_brand_match),
            "confidence": round(best_brand_score, 2),
            "needs_confirmation": False,
            "alternatives": alternatives[:3],
        }

    logger.info(f"No strong match found for: '{candidate}' (best: {max(best_brand_score, best_gen_score):.2f})")
    return {"medicine": None, "confidence": round(max(best_brand_score, best_gen_score), 2), "needs_confirmation": True, "alternatives": alternatives[:3]}
