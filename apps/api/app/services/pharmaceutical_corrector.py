"""Afiya AI — Pharmaceutical Spell Corrector & Clinical Normalizer for OCR.
Validates and snaps optical cursive typos to verified DRAP brands and generic molecules,
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
    "eye drop": "Drops",
    "ear drop": "Drops",
    "cream": "Cream",
    "ointment": "Ointment",
    "gel": "Gel",
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
                _ALL_BRANDS[b_name.lower()] = m
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


def clean_medicine_name(name: str) -> str:
    """Strip doctor prescription prefixes like Tab, Cap, Syp, and leading numbers."""
    if not name:
        return ""
    cleaned = name.strip()
    cleaned = PREFIX_REGEX.sub("", cleaned)
    cleaned = re.sub(r"^(?:[0-9]+[\.\)\-\:]|#\d+)\s*", "", cleaned)
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


def normalize_dosage_form(form: str, default: str = "Tablet") -> str:
    """Standardize dosage form strings."""
    if not form:
        return default
    clean = form.strip().lower()
    clean = re.sub(r"[^a-z]", "", clean)
    return FORM_NORMALIZATION_MAP.get(clean, default)


def expand_dosage_instructions(instructions: str, frequency: str = "") -> str:
    """Expand Latin clinical abbreviations into plain conversational directions."""
    combined = instructions or ""
    if frequency and frequency.lower() not in combined.lower():
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
) -> dict[str, Any]:
    """Snap cursive handwriting typos to verified DRAP records, normalize, and score."""
    init_corrector()

    cleaned_name = clean_medicine_name(name)
    if not cleaned_name:
        return {
            "raw_text": raw_line or "",
            "confidence": 0.3,
            "is_verified": False,
            "matched_medicine": None,
            "detected_brand": None,
            "detected_generic": None,
            "detected_strength": "",
            "detected_form": "Tablet",
            "dosage_instruction": None,
            "raw_line": raw_line or "",
            "needs_confirmation": True,
        }

    # Extract inline strength if name contains it (e.g. 'Panadol 500mg' -> name: 'Panadol', strength: '500mg')
    inline_strength_match = re.search(r"(\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu|%))", cleaned_name, re.IGNORECASE)
    if inline_strength_match and not strength:
        strength = inline_strength_match.group(1)
        cleaned_name = re.sub(r"" + re.escape(inline_strength_match.group(0)) + r"", "", cleaned_name).strip()

    norm_strength = normalize_strength(strength)
    norm_form = normalize_dosage_form(form)

    best_name = cleaned_name
    best_score = 0.0
    is_brand = False
    generic_name = None
    needs_confirmation = False

    if _NAME_LOOKUP_LIST:
        lower_name = cleaned_name.lower()
        if lower_name in _ALL_BRANDS:
            matched_rec = _ALL_BRANDS[lower_name]
            best_name = matched_rec["brand_name"]
            best_score = 100.0
            is_brand = True
            generic_name = matched_rec.get("generic_name")
            if not norm_strength and matched_rec.get("strength"):
                norm_strength = normalize_strength(matched_rec["strength"])
            if not form and matched_rec.get("dosage_form"):
                norm_form = normalize_dosage_form(matched_rec["dosage_form"])
        elif lower_name in _ALL_GENERICS:
            generic_name = cleaned_name.title()
            best_name = generic_name
            best_score = 100.0
        elif process is not None and fuzz is not None:
            fuzzy_res = process.extractOne(cleaned_name, _NAME_LOOKUP_LIST, scorer=fuzz.ratio)
            if fuzzy_res:
                matched_candidate_name, score, _ = fuzzy_res
                if score >= 82.0:
                    logger.info(f"OCR Typo Corrected: '{cleaned_name}' -> '{matched_candidate_name}' (Score: {score:.1f})")
                    best_name = matched_candidate_name
                    best_score = score
                    if matched_candidate_name.lower() in _ALL_BRANDS:
                        matched_rec = _ALL_BRANDS[matched_candidate_name.lower()]
                        is_brand = True
                        generic_name = matched_rec.get("generic_name")
                        if not norm_strength and matched_rec.get("strength"):
                            norm_strength = normalize_strength(matched_rec["strength"])
                        if not form and matched_rec.get("dosage_form"):
                            norm_form = normalize_dosage_form(matched_rec["dosage_form"])
                    elif matched_candidate_name.lower() in _ALL_GENERICS:
                        generic_name = matched_candidate_name
                elif score >= 65.0:
                    needs_confirmation = True
                    best_score = score

    if best_score >= 95.0:
        final_conf = max(confidence, 0.95)
    elif best_score >= 82.0:
        final_conf = max(confidence, 0.88)
    elif best_score >= 65.0:
        final_conf = min(max(confidence, 0.65), 0.80)
        needs_confirmation = True
    else:
        final_conf = confidence if (confidence and 0.40 <= confidence <= 0.95) else 0.70
        needs_confirmation = True

    tokens = [best_name]
    if norm_strength:
        tokens.append(norm_strength)
    if norm_form:
        tokens.append(norm_form)
    clean_raw_text = " ".join(tokens).strip()

    expanded_instr = expand_dosage_instructions(instructions, frequency)

    return {
        "raw_text": clean_raw_text,
        "confidence": round(final_conf, 2),
        "is_verified": False,
        "matched_medicine": None,
        "detected_brand": best_name if (is_brand or not generic_name) else None,
        "detected_generic": generic_name,
        "detected_strength": norm_strength,
        "detected_form": norm_form,
        "dosage_instruction": expanded_instr or None,
        "raw_line": raw_line or clean_raw_text,
        "needs_confirmation": needs_confirmation,
    }
