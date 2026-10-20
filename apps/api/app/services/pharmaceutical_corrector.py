"""Afiya AI — Pharmaceutical Spell Corrector & Clinical Normalizer for OCR.
Preserves optical transcriptions and offers catalog spelling suggestions separately,
normalizes dosage forms and strengths, and expands clinical shorthand (TDS, BD, ac, pc).
Author / Developer: Mubashir (Lead Developer)
"""

import json
import logging
import re
from typing import Any, Optional

try:
    from rapidfuzz import process, fuzz
except ImportError:
    try:
        from thefuzz import process, fuzz
    except ImportError:
        process = None
        fuzz = None

from app.services.disease_advisory_service import get_dataset_path

logger = logging.getLogger(__name__)

_INDEX_INITIALIZED = False
_ALL_BRANDS: dict[str, dict[str, Any]] = {}
_ALL_GENERICS: dict[str, list[dict[str, Any]]] = {}
_NAME_LOOKUP_LIST: list[str] = []

FORM_NORMALIZATION_MAP = {
    "tab": "Tablet",
    "tabs": "Tablet",
    "tablet": "Tablet",
    "tablets": "Tablet",
    "cap": "Capsule",
    "caps": "Capsule",
    "capsule": "Capsule",
    "capsules": "Capsule",
    "syp": "Syrup",
    "syrup": "Syrup",
    "susp": "Suspension",
    "suspension": "Suspension",
    "inh": "Inhaler",
    "inhaler": "Inhaler",
    "inhalation": "Inhaler",
    "rotacap": "Inhaler",
    "rotacaps": "Inhaler",
    "inj": "Injection",
    "injection": "Injection",
    "drop": "Drops",
    "drops": "Drops",
    "eyedrop": "Drops",
    "eardrop": "Drops",
    "cream": "Cream",
    "ointment": "Ointment",
    "gel": "Gel",
    "lotion": "Lotion",
    "bar": "Bar",
    "soap": "Bar",
    "soapbar": "Bar",
    "bars": "Bar",
    "cleansingbar": "Bar",
    "spray": "Spray",
    "nasalspray": "Spray",
    "shampoo": "Shampoo",
    "solution": "Solution",
    "soln": "Solution",
    "wash": "Wash",
    "mouthwash": "Mouthwash",
    "powder": "Powder",
    "patch": "Patch",
    "patches": "Patch",
    "suppository": "Suppository",
    "suppositories": "Suppository",
    "pessary": "Pessary",
    "pessaries": "Pessary",
    "paste": "Paste",
    "foam": "Foam",
    "emulsion": "Emulsion",
}

PREFIX_REGEX = re.compile(
    r"^(?:tab|cap|syp|susp|inj|inh|drops|t|c|s)\.?\s+",
    re.IGNORECASE
)

SHORTHAND_EXPANSIONS = [
    (re.compile(r"\b(tds|tid)\b", re.IGNORECASE), "3 times daily (TDS)"),
    (re.compile(r"\b(bd|bid)\b", re.IGNORECASE), "2 times daily (BD)"),
    (re.compile(r"\b(od|qd)\b", re.IGNORECASE), "once daily (OD)"),
    (re.compile(r"\b(qds|qid)\b", re.IGNORECASE), "4 times daily (QDS)"),
    (re.compile(r"\b(hs)\b", re.IGNORECASE), "at bedtime (HS)"),
    (re.compile(r"\b(sos|prn)\b", re.IGNORECASE), "as needed (SOS)"),
    (re.compile(r"\b(stat)\b", re.IGNORECASE), "immediately (stat)"),
    (re.compile(r"\b(ac)\b", re.IGNORECASE), "before meals (ac)"),
    (re.compile(r"\b(pc)\b", re.IGNORECASE), "after meals (pc)"),
    (re.compile(r"\bx\s*(\d+)/7\b", re.IGNORECASE), r"for \1 days"),
    (re.compile(r"\bx\s*(\d+)d\b", re.IGNORECASE), r"for \1 days"),
    (re.compile(r"\bx\s*(\d+)/52\b", re.IGNORECASE), r"for \1 weeks"),
    (re.compile(r"\bx\s*(\d+)/12\b", re.IGNORECASE), r"for \1 months"),
]

FREQ_EQUIVALENTS: dict[str, list[str]] = {
    "od": ["once daily", "1 time daily", "once a day", "1-0-0"],
    "qd": ["once daily", "1 time daily", "once a day", "1-0-0"],
    "bd": ["twice daily", "2 times daily", "twice a day", "1-0-1"],
    "bid": ["twice daily", "2 times daily", "twice a day", "1-0-1"],
    "tds": ["3 times daily", "three times daily", "3 times a day", "1-1-1"],
    "tid": ["3 times daily", "three times daily", "3 times a day", "1-1-1"],
    "qds": ["4 times daily", "four times daily", "4 times a day"],
    "qid": ["4 times daily", "four times daily", "4 times a day"],
    "hs": ["at bedtime", "bedtime", "at night", "0-0-1"],
    "stat": ["immediately", "single dose"],
    "sos": ["as needed", "when needed", "prn"],
    "prn": ["as needed", "when needed", "sos"],
    "ac": ["before meals", "empty stomach"],
    "pc": ["after meals"],
}


FORM_WORDS_REGEX = re.compile(
    r"\b(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|susp(?:ension)?|inj(?:ection)?|amp(?:oule)?|vial|inhaler|drops?|soap\s*bar|bars?|soap|cream|ointment|gel|lotion|spray|shampoo|solution|soln|mouthwash|wash|powder|patch(?:es)?|suppositor(?:y|ies)|pessar(?:y|ies)|paste|foam|emulsion)\b",
    re.IGNORECASE,
)


def init_corrector():
    global _INDEX_INITIALIZED, _ALL_BRANDS, _ALL_GENERICS, _NAME_LOOKUP_LIST
    if _INDEX_INITIALIZED:
        return

    data_path = get_dataset_path()
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            medicines = json.load(f)

        name_set = set()
        for m in medicines:
            b_name = m.get("brand_name", "").strip()
            g_name = m.get("generic_name", "").strip()

            if b_name:
                b_key = b_name.lower()
                if b_key not in _ALL_BRANDS:
                    _ALL_BRANDS[b_key] = []
                _ALL_BRANDS[b_key].append(m)
                name_set.add(b_name)

            if g_name:
                if g_name.lower() not in _ALL_GENERICS:
                    _ALL_GENERICS[g_name.lower()] = []
                _ALL_GENERICS[g_name.lower()].append(m)
                name_set.add(g_name)

        _NAME_LOOKUP_LIST = sorted(list(name_set))
        _INDEX_INITIALIZED = True
        logger.info(f"Initialized Pharmaceutical Corrector with {len(_NAME_LOOKUP_LIST)} reference terms.")
    except Exception as exc:
        logger.error(f"Failed to init Pharmaceutical Corrector: {exc}")


def get_brand_record(brand_lower: str, preferred_form: str = "") -> Optional[dict[str, Any]]:
    records = _ALL_BRANDS.get(brand_lower)
    if not records:
        return None
    if isinstance(records, dict):
        return records
    if preferred_form:
        p_clean = preferred_form.lower()
        for r in records:
            if p_clean in (r.get("dosage_form") or "").lower():
                return r
    return records[0]


def clean_medicine_name(name: str) -> str:
    """Strip doctor prescription prefixes like Tab, Cap, Syp, leading numbers, and dosage form indicators."""
    if not name:
        return ""
    cleaned = name.strip()
    cleaned = PREFIX_REGEX.sub("", cleaned)
    cleaned = re.sub(r"^(?:[0-9]+[\.\)\-\:]|#\d+)\s*", "", cleaned)
    cleaned = FORM_WORDS_REGEX.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def normalize_strength(strength: str) -> str:
    """Normalize strength units and spacing (e.g. 500 mg -> 500mg, 1 g -> 1000mg)."""
    if not strength:
        return ""
    s = strength.strip().lower()
    s = re.sub(r"\s+", "", s)
    if s == "1g":
        return "1g"
    return s


def normalize_dosage_form(form: str, default: str = "") -> str:
    """Standardize dosage form strings."""
    if not form:
        return default
    clean = form.strip().lower()
    clean = re.sub(r"[^a-z]", "", clean)
    return FORM_NORMALIZATION_MAP.get(clean, default)


def prescription_form(name: str, raw_line: str, model_form: str) -> tuple[str, bool]:
    """Preserve explicit written product forms, including non-oral products.

    A model's generic Tablet default must not override a visible Bar/Cream/etc.
    Conflicting forms remain reviewable; absent evidence stays unknown.
    """
    written = f"{name} {raw_line}"
    patterns = (
        (r"\b(?:soap\s*bar|bars?|soap)\b", "Bar"),
        (r"\b(?:ointments?|oint)\b", "Ointment"),
        (r"\b(?:creams?|crm)\b", "Cream"),
        (r"\bgel\b", "Gel"),
        (r"\b(?:lotion|lot)\b", "Lotion"),
        (r"\bspray\b", "Spray"),
        (r"\bshampoo\b", "Shampoo"),
        (r"\b(?:solution|soln)\b", "Solution"),
        (r"\bmouthwash\b", "Mouthwash"),
        (r"\bwash\b", "Wash"),
        (r"\bpowder\b", "Powder"),
        (r"\bpatch(?:es)?\b", "Patch"),
        (r"\bsuppositor(?:y|ies)\b", "Suppository"),
        (r"\bpessar(?:y|ies)\b", "Pessary"),
        (r"\bpaste\b", "Paste"),
        (r"\bfoam\b", "Foam"),
        (r"\bemulsion\b", "Emulsion"),
        (r"\b(?:inj(?:ection)?|amp(?:oule)?|vial)\b", "Injection"),
        (r"\b(?:inh(?:aler)?|rotacaps?|puffs?)\b", "Inhaler"),
        (r"\b(?:drops?|gtts?)\b", "Drops"),
        (r"\b(?:susp(?:ension)?)\b", "Suspension"),
        (r"\b(?:syp|syrup)\b", "Syrup"),
        (r"\b(?:cap(?:sule)?s?)\b", "Capsule"),
        (r"\b(?:tab(?:let)?s?)\b", "Tablet"),
    )
    forms = [form for pattern, form in patterns if re.search(pattern, written, re.IGNORECASE)]
    normalized = normalize_dosage_form(model_form, default="")
    if forms:
        return forms[0], len(set(forms)) > 1 or bool(normalized and normalized != forms[0])
    return normalized, not bool(normalized)


def expand_dosage_instructions(instructions: str, frequency: str = "") -> str:
    """Expand Latin clinical abbreviations into plain conversational directions without duplication."""
    combined = (instructions or "").strip()
    freq_clean = (frequency or "").strip().lower()

    if freq_clean:
        already_has_freq = freq_clean in combined.lower()
        if not already_has_freq and freq_clean in FREQ_EQUIVALENTS:
            for eq in FREQ_EQUIVALENTS[freq_clean]:
                if eq in combined.lower():
                    already_has_freq = True
                    break

        if not already_has_freq:
            combined = f"{combined} {frequency}".strip()

    if not combined:
        return ""

    expanded = combined
    for pattern, replacement in SHORTHAND_EXPANSIONS:
        expanded = pattern.sub(replacement, expanded)

    expanded = re.sub(r"\s+", " ", expanded).strip()
    return expanded


def correct_and_normalize_candidate(
    name: str,
    strength: str = "",
    form: str = "",
    frequency: str = "",
    instructions: str = "",
    confidence: float = 0.85,
    raw_line: str = "",
    clinical_purpose: str = "",
) -> dict[str, Any]:
    """Normalize a transcription and offer catalog spelling suggestions separately."""
    init_corrector()

    cleaned_name = clean_medicine_name(name)
    if not cleaned_name:
        written_form, form_uncertain = prescription_form(name, raw_line, form)
        return {
            "raw_text": raw_line or "",
            "confidence": 0.0,
            "is_verified": False,
            "matched_medicine": None,
            "detected_brand": None,
            "detected_generic": None,
            "detected_strength": "",
            "detected_form": written_form,
            "form_conflict": bool(written_form and form_uncertain),
            "dosage_instruction": None,
            "raw_line": raw_line or "",
            "needs_confirmation": True,
        }

    # Extract inline strength if name contains it (e.g. 'Panadol 500mg' -> name: 'Panadol', strength: '500mg')
    inline_strength_match = re.search(
        r"(?<!\w)(\d+(?:\.\d+)?\s*(?:mcg|mg|ml|iu|g|%)(?:\s*/\s*(?:\d+(?:\.\d+)?\s*)?(?:mcg|mg|ml|iu|g))?)(?!\w)",
        cleaned_name, re.IGNORECASE)
    strength_uncertain = False
    if inline_strength_match:
        written_strength = inline_strength_match.group(1)
        strength_uncertain = bool(strength and normalize_strength(strength) != normalize_strength(written_strength))
        if not strength:
            strength = written_strength
        cleaned_name = (cleaned_name[:inline_strength_match.start()] + cleaned_name[inline_strength_match.end():]).strip()

    norm_strength = normalize_strength(strength)
    norm_form, form_uncertain = prescription_form(name, raw_line, form)
    best_name = cleaned_name
    best_score = 0.0
    is_brand = False
    generic_name = None
    needs_confirmation = form_uncertain or strength_uncertain

    if _NAME_LOOKUP_LIST:
        lower_name = cleaned_name.lower()
        matched_rec = get_brand_record(lower_name, preferred_form=norm_form)
        if matched_rec:
            best_name = matched_rec["brand_name"]
            best_score = 100.0
            is_brand = True
            generic_name = matched_rec.get("generic_name")
        elif lower_name in _ALL_GENERICS:
            generic_name = cleaned_name.title()
            best_name = generic_name
            best_score = 100.0
        elif process is not None and fuzz is not None:
            fuzzy_res = process.extractOne(cleaned_name, _NAME_LOOKUP_LIST, scorer=fuzz.ratio)
            if fuzzy_res:
                matched_candidate_name, score, _ = fuzzy_res
                if score >= 82.0:
                    logger.debug("OCR catalog spelling suggestion available (similarity %.1f)", score)
                    best_name = matched_candidate_name
                    best_score = score
                    matched_fuzzy_rec = get_brand_record(matched_candidate_name.lower(), preferred_form=norm_form)
                    if matched_fuzzy_rec:
                        is_brand = True
                        generic_name = matched_fuzzy_rec.get("generic_name")
                    elif matched_candidate_name.lower() in _ALL_GENERICS:
                        generic_name = matched_candidate_name
                elif score >= 65.0:
                    needs_confirmation = True
                    best_score = score

    # OCR legibility and catalog similarity are different signals.
    # Never inflate the model's reported legibility because a name matches a catalog.
    try:
        final_conf = float(confidence)
        if not 0 <= final_conf <= 1:
            final_conf = 0.0
    except (ValueError, TypeError):
        final_conf = 0.0
    corrected = best_name.casefold() != cleaned_name.casefold()
    needs_confirmation = needs_confirmation or corrected or final_conf < 0.8
    suggestion = best_name if corrected else None
    if corrected:
        # A close catalog spelling is not evidence of what the doctor wrote.
        # Preserve the model's name and do not attach the suggested drug's generic.
        best_name = cleaned_name
        generic_name = None
        is_brand = False

    tokens = [best_name]
    if norm_strength:
        tokens.append(norm_strength)
    if norm_form and norm_form.lower() not in [t.lower() for t in tokens]:
        tokens.append(norm_form)
    clean_raw_text = " ".join(tokens).strip()

    expanded_instr = expand_dosage_instructions(instructions, frequency)

    return {
        "raw_text": clean_raw_text,
        "confidence": round(final_conf, 2),
        "original_name": cleaned_name,
        "correction_suggestion": suggestion,
        "match_confidence": round(best_score / 100, 2) if best_score else None,
        "is_verified": False,
        "matched_medicine": None,
        "detected_brand": best_name if (is_brand or not generic_name) else None,
        "detected_generic": generic_name,
        "detected_strength": norm_strength,
        "detected_form": norm_form,
        "form_conflict": bool(norm_form and form_uncertain),
        "dosage_instruction": expanded_instr or None,
        "raw_line": raw_line or clean_raw_text,
        "needs_confirmation": needs_confirmation,
        "clinical_purpose": clinical_purpose or None,
    }
