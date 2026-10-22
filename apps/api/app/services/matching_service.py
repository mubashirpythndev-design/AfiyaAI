"""Afiya AI — Medicine Matching & Normalization Engine (Exact, Token Set, Alias & Fuzzy Matching).
Author / Developer: Mubashir (Lead Developer)
"""

import logging
import re
from typing import Optional, Any
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
        drap_reg_no=med.drap_reg_no,
        source_verification_status=med.source_verification_status or "needs_source_verification",
        aliases=med.aliases or [],
        category=med.category or "",
    )


def strip_prescription_affixes(text: str) -> str:
    """Strip prescription prefix labels (Inj, Tab, Cap, Syp, etc.) and numbering."""
    t = re.sub(r"^(?:[0-9]+[\.\)\-\:]|#\d+)\s*", "", text.strip())
    t = re.sub(
        r"^(?:tab(?:let)?|cap(?:sule)?|syp|syrup|susp(?:ension)?|inj(?:ection)?|amp(?:oule)?|vial|drops?|inh(?:aler)?|cream|gel|lotion)\.?\s+",
        "",
        t,
        flags=re.IGNORECASE,
    ).strip()
    return t


def extract_strength(text: str) -> Optional[str]:
    """Extract dosage strength token from text (e.g. '500mg', '10 ml', '1g', '2%')."""
    if not text:
        return None
    m = re.search(r"\b(\d+(?:\.\d+)?\s*(?:mg(?:\s*\/\s*\d+(?:\.\d+)?\s*ml)?|mcg|g|ml|iu(?:\s*\/\s*ml)?|%))\b", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def canonicalize_strength(s: Optional[str]) -> str:
    """Canonicalize strength string for consistent unit comparison (e.g. '1 g' -> '1000mg')."""
    if not s:
        return ""
    clean = s.lower().replace(" ", "")
    m_g = re.fullmatch(r"(\d+(?:\.\d+)?)g", clean)
    if m_g:
        val = float(m_g.group(1)) * 1000
        return f"{int(val) if val.is_integer() else val}mg"
    return clean


def evaluate_strength_match(extracted_strength: Optional[str], db_strength: Optional[str]) -> dict[str, Any]:
    """
    Compare OCR/user extracted strength against matched database record strength.
    Produces exactly one of three required outcomes:
    1. EXACT_STRENGTH_MATCH - extracted strength equals database record strength.
    2. STRENGTH_MISMATCH - extracted strength does NOT equal matched record strength.
    3. NO_STRENGTH_DETECTED - OCR did not extract a strength value at all.
    """
    if not extracted_strength:
        return {
            "status": "NO_STRENGTH_DETECTED",
            "extracted_strength": None,
            "database_strength": db_strength or "",
            "warning_message": f"Prescription strength could not be confirmed from image. Closest database match is {db_strength or 'unspecified'}.",
            "urdu_warning_message": f"نسخہ سے دوا کی طاقت کی تصدیق نہیں ہو سکی۔ ڈیٹا بیس ریکارڈ {db_strength or 'غیر واضح'} ہے۔",
        }

    canon_ext = canonicalize_strength(extracted_strength)
    canon_db = canonicalize_strength(db_strength)

    if canon_ext and canon_db and canon_ext == canon_db:
        return {
            "status": "EXACT_STRENGTH_MATCH",
            "extracted_strength": extracted_strength,
            "database_strength": db_strength or "",
            "warning_message": None,
            "urdu_warning_message": None,
        }

    return {
        "status": "STRENGTH_MISMATCH",
        "extracted_strength": extracted_strength,
        "database_strength": db_strength or "",
        "warning_message": f"Prescription shows {extracted_strength} - closest database match is {db_strength}. Do not assume these are interchangeable without pharmacist confirmation.",
        "urdu_warning_message": f"نسخہ میں {extracted_strength} ہے - ڈیٹا بیس میں قریب ترین میچ {db_strength} ہے۔ فارماسسٹ کی تصدیق کے بغیر انہیں ایک جیسا نہ سمجھیں۔",
    }


def extract_dosage_form(text: str) -> Optional[str]:
    """Extract dosage form from candidate text (e.g. 'Injection', 'Tablet', 'Capsule', 'Syrup')."""
    if not text:
        return None
    lower = text.lower()
    if re.search(r"\b(?:inj(?:ection)?|amp(?:oule)?|vial|i\.?v\.?|i\.?m\.?|infusion|drip)\b", lower):
        return "Injection"
    if re.search(r"\b(?:inh(?:aler)?|rotacap|puffs?|respules?|aerosol|inhalation)\b", lower):
        return "Inhaler"
    if re.search(r"\b(?:drops?|eye\s*drops?|ear\s*drops?|gtts?|nasal\s*spray|spray)\b", lower):
        return "Drops"
    if re.search(r"\b(?:syp|syrup|susp(?:ension)?|solution|elixir|liquid)\b", lower):
        return "Syrup"
    if re.search(r"\b(?:cap(?:sule)?s?)\b", lower):
        return "Capsule"
    if re.search(r"\b(?:tab(?:let)?s?)\b", lower):
        return "Tablet"
    if re.search(r"\b(?:cream|ointment|gel|lotion)\b", lower):
        return "Cream"
    return None


def evaluate_form_match(extracted_form: Optional[str], db_form: Optional[str]) -> dict[str, Any]:
    """
    Compare OCR/user extracted dosage form against matched database record dosage form.
    Produces one of three outcomes:
    1. EXACT_FORM_MATCH - extracted form matches database record form.
    2. FORM_MISMATCH - extracted form does NOT match matched record form (e.g. Injection vs Capsule/Tablet).
    3. NO_FORM_DETECTED - Candidate did not specify a dosage form.
    """
    if not extracted_form:
        return {
            "status": "NO_FORM_DETECTED",
            "extracted_form": None,
            "database_form": db_form or "",
            "warning_message": None,
            "urdu_warning_message": None,
        }

    ext_norm = extracted_form.strip().lower()
    db_norm = (db_form or "").strip().lower()

    if ext_norm == db_norm or (ext_norm in db_norm) or (db_norm in ext_norm):
        return {
            "status": "EXACT_FORM_MATCH",
            "extracted_form": extracted_form,
            "database_form": db_form or "",
            "warning_message": None,
            "urdu_warning_message": None,
        }

    return {
        "status": "FORM_MISMATCH",
        "extracted_form": extracted_form,
        "database_form": db_form or "",
        "warning_message": f"Prescription specifies {extracted_form} — database only contains {db_form or 'different form'}. Different dosage forms have distinct routes and absorption rates. Do not substitute without physician confirmation.",
        "urdu_warning_message": f"نسخہ میں {extracted_form} درج ہے جبکہ ڈیٹا بیس میں صرف {db_form or 'دوسری شکل'} دستیاب ہے۔ طریقہ استعمال مختلف ہے۔ ڈاکٹر یا فارماسسٹ کے مشورے کے بغیر تبدیل نہ کریں۔",
    }


def build_match_result(
    med: Optional[Medicine],
    confidence: float,
    needs_confirmation: bool,
    alternatives: list,
    cand_strength: Optional[str],
    cand_form: Optional[str] = None,
) -> dict:
    """Build standardized match dictionary with safety-guaranteed strength and form assessment."""
    if not med:
        return {
            "medicine": None,
            "confidence": confidence,
            "needs_confirmation": needs_confirmation,
            "alternatives": alternatives,
            "strength_assessment": None,
            "form_assessment": None,
        }

    schema_med = medicine_to_schema(med)
    strength_eval = evaluate_strength_match(cand_strength, med.strength)
    form_eval = evaluate_form_match(cand_form, med.dosage_form)

    # If there is a strength or form mismatch, flag needs_confirmation = True
    if strength_eval["status"] == "STRENGTH_MISMATCH":
        needs_confirmation = True
    if form_eval["status"] == "FORM_MISMATCH":
        needs_confirmation = True

    return {
        "medicine": schema_med,
        "confidence": confidence,
        "needs_confirmation": needs_confirmation,
        "alternatives": alternatives,
        "strength_assessment": strength_eval,
        "form_assessment": form_eval,
    }


async def match_medicine(
    candidate: str,
    db: AsyncSession,
    extracted_strength: Optional[str] = None,
    extracted_form: Optional[str] = None,
) -> dict:
    """Match a candidate name against the verified medicine database."""
    cand_strength = extracted_strength or extract_strength(candidate)
    cand_form = extracted_form or extract_dosage_form(candidate)
    normalized = normalize(candidate)
    clean_cand = normalize(strip_prescription_affixes(candidate))
    if not normalized and not clean_cand:
        return build_match_result(None, 0.0, True, [], cand_strength, cand_form)

    cand_tokens = set(re.findall(r"\b[a-z0-9]+\b", normalized)).union(
        re.findall(r"\b[a-z0-9]+\b", clean_cand)
    )

    # 1. Exact match on brand_name (trying normalized, clean_cand)
    for q in dict.fromkeys([normalized, clean_cand]):
        if not q:
            continue
        result = await db.execute(
            select(Medicine).where(func.lower(Medicine.brand_name) == q)
        )
        meds = result.scalars().all()
        if meds:
            chosen = meds[0]
            if len(meds) > 1:
                # Prioritize matching dosage form (e.g. Risek Injection vs Risek Capsule)
                if cand_form:
                    form_matched = [m for m in meds if cand_form.lower() in m.dosage_form.lower()]
                    if form_matched:
                        meds = form_matched
                if cand_strength:
                    cand_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalize(cand_strength)))
                    if cand_tokens:
                        strength_matched = [
                            m for m in meds
                            if set(re.findall(r"\b\d+[a-z]*\b", normalize(m.strength))).intersection(cand_tokens)
                        ]
                        if strength_matched:
                            meds = strength_matched
                chosen = meds[0]

            logger.info(f"Exact brand match: '{candidate}' (query: '{q}') -> {chosen.brand_name} ({chosen.dosage_form} {chosen.strength})")
            return build_match_result(chosen, 1.0, False, [medicine_to_schema(m) for m in meds[1:4]], cand_strength, cand_form)

    # 1b. Exact match on brand_name without dosage strength / form tokens (e.g. 'Panadol 500mg' -> 'Panadol')
    for q in dict.fromkeys([clean_cand, normalized]):
        if not q:
            continue
        clean_brand_only = re.sub(r"\b\d+\s*(mg|ml|mcg|g|iu|iu/ml|%)\b", "", q).strip()
        clean_brand_only = re.sub(r"\b(?:tab(?:let)?s?|cap(?:sule)?s?|inj(?:ection)?|amp(?:oule)?|vial|syp|syrup|susp(?:ension)?|inhaler|drops?)\b", "", clean_brand_only, flags=re.IGNORECASE).strip()
        if clean_brand_only and clean_brand_only != q:
            result = await db.execute(
                select(Medicine).where(func.lower(Medicine.brand_name) == clean_brand_only)
            )
            meds = result.scalars().all()
            if meds:
                chosen = meds[0]
                if len(meds) > 1:
                    if cand_form:
                        form_matched = [m for m in meds if cand_form.lower() in m.dosage_form.lower()]
                        if form_matched:
                            meds = form_matched
                    if cand_strength:
                        cand_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalize(cand_strength)))
                        if cand_strength_tokens:
                            strength_matched = [
                                m for m in meds
                                if set(re.findall(r"\b\d+[a-z]*\b", normalize(m.strength))).intersection(cand_strength_tokens)
                            ]
                            if strength_matched:
                                meds = strength_matched
                    chosen = meds[0]

                logger.info(f"Exact brand match without strength/form: '{candidate}' -> {chosen.brand_name} ({chosen.dosage_form})")
                return build_match_result(chosen, 0.98, False, [medicine_to_schema(m) for m in meds[1:4]], cand_strength, cand_form)

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
        if cand_form:
            filtered_by_form = [m for m in generic_meds if cand_form.lower() in normalize(m.dosage_form)]
            if filtered_by_form:
                generic_meds = filtered_by_form
        else:
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
            logger.info(f"Single generic match: '{candidate}' -> {med.brand_name} ({med.dosage_form})")
            return build_match_result(med, 1.0, False, [], cand_strength, cand_form)

        logger.info(f"Generic match: '{candidate}' -> {len(generic_meds)} brands (cheapest: {generic_meds[0].brand_name})")
        return build_match_result(
            None,
            1.0,
            True,
            [medicine_to_schema(m) for m in generic_meds][:10],
            cand_strength,
            cand_form,
        )

    # 3. Check all medicines for token containment & aliases
    all_medicines = await db.execute(select(Medicine))
    all_meds = all_medicines.scalars().all()

    # 3a. Whole-word token containment on brand name / aliases
    token_candidates = []
    for med in all_meds:
        brand_tokens = set(re.findall(r"\b[a-z0-9]+\b", normalize(med.brand_name)))
        if brand_tokens and brand_tokens.issubset(cand_tokens):
            # Check strength if candidate explicitly contains numbers
            med_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalize(med.strength)))
            cand_strength_tokens = set(re.findall(r"\b\d+[a-z]*\b", normalized))
            if not med_strength_tokens or not cand_strength_tokens or med_strength_tokens.intersection(cand_strength_tokens):
                token_candidates.append(med)

    if token_candidates:
        chosen = token_candidates[0]
        if len(token_candidates) > 1 and cand_form:
            form_matched = [m for m in token_candidates if cand_form.lower() in m.dosage_form.lower()]
            if form_matched:
                chosen = form_matched[0]
        logger.info(f"Token brand match: '{candidate}' -> {chosen.brand_name} ({chosen.dosage_form})")
        return build_match_result(chosen, 0.95, False, [medicine_to_schema(m) for m in token_candidates[1:4]], cand_strength, cand_form)

    for med in all_meds:
        for alias in (med.aliases or []):
            if normalize(alias) == normalized:
                logger.info(f"Alias match: '{candidate}' -> {med.brand_name} (alias: {alias})")
                return build_match_result(med, 0.95, False, [], cand_strength, cand_form)

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

        # Filter by form if specified
        if cand_form:
            form_filtered = [m for m in same_gen_meds if cand_form.lower() in m.dosage_form.lower()]
            if form_filtered:
                same_gen_meds = form_filtered

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
            logger.info(f"Fuzzy single generic match: '{candidate}' -> {med.brand_name} ({med.dosage_form})")
            return build_match_result(med, round(best_gen_score, 2), False, [], cand_strength, cand_form)

        logger.info(f"Fuzzy generic match: '{candidate}' -> {len(same_gen_meds)} brands for generic '{best_gen_match.generic_name}'")
        return build_match_result(
            None,
            round(best_gen_score, 2),
            True,
            [medicine_to_schema(m) for m in same_gen_meds][:10],
            cand_strength,
            cand_form,
        )

    # Otherwise, if brand match is highest
    if best_brand_match and best_brand_score >= max(threshold, 0.82):
        chosen_brand_med = best_brand_match
        if cand_form:
            same_brand_meds = [m for m in all_meds if m.brand_name.lower() == best_brand_match.brand_name.lower()]
            form_matched = [m for m in same_brand_meds if cand_form.lower() in m.dosage_form.lower()]
            if form_matched:
                chosen_brand_med = form_matched[0]

        logger.info(f"Fuzzy brand match: '{candidate}' -> {chosen_brand_med.brand_name} ({chosen_brand_med.dosage_form}) (score: {best_brand_score:.2f})")
        return build_match_result(
            chosen_brand_med,
            round(best_brand_score, 2),
            False,
            alternatives[:3],
            cand_strength,
            cand_form,
        )

    logger.info(f"No strong match found for: '{candidate}' (best: {max(best_brand_score, best_gen_score):.2f})")
    return build_match_result(
        None,
        round(max(best_brand_score, best_gen_score), 2),
        True,
        alternatives[:3],
        cand_strength,
        cand_form,
    )
