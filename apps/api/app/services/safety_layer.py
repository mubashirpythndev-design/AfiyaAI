"""Afiya AI — Safety & Legitimacy Verification Layer.
Author / Developer: Mubashir (Lead Developer)

Pillars:
1. DRAP Legitimacy Verification (Active registration, counterfeit protection)
2. Look-Alike / Sound-Alike (LASA) Collision Detector with Generic Immunity
3. Self-Medication Risk Tiers (Tier 1: OTC, Tier 2: Caution, Tier 3: Prescription Only)
"""

import logging
import re
from typing import Optional, Any
from rapidfuzz.distance import Levenshtein

logger = logging.getLogger(__name__)

# Known confusable medicine pairs with DIFFERENT generic formulations (High-Hazard LASA)
CONFUSABLE_PAIRS: list[tuple[str, str]] = [
    ("losec", "lasix"),          # Omeprazole (Stomach) vs Furosemide (Diuretic/BP)
    ("ceftum", "cefspan"),        # Cefuroxime vs Cefixime (Different generation cephalosporins)
    ("norvasc", "navidoxine"),    # Amlodipine (Hypertension) vs Meclizine/B6 (Anti-emetic)
    ("epival", "epilim"),        # Sodium valproate vs Sodium valproate/valproic acid (Dosing diffs)
    ("zantac", "xanax"),          # Ranitidine (Antacid) vs Alprazolam (Benzodiazepine/Sedative)
    ("celebrex", "celexa"),      # Celecoxib (NSAID) vs Citalopram (SSRI Antidepressant)
    ("arinate", "arinac"),        # Artesunate (Antimalarial) vs Ibuprofen+Pseudoephedrine (Cold/Flu)
    ("tegretol", "toradol"),      # Carbamazepine (Anticonvulsant) vs Ketorolac (Potent NSAID)
    ("seroquel", "serzone"),      # Quetiapine (Antipsychotic) vs Nefazodone (Antidepressant)
]


def calculate_soundex(token: str) -> str:
    """Pure-Python Soundex implementation for phonetic similarity matching."""
    token = re.sub(r"[^A-Za-z]", "", token).upper()
    if not token:
        return "0000"

    mapping = {
        "B": "1", "F": "1", "P": "1", "V": "1",
        "C": "2", "G": "2", "J": "2", "K": "2", "Q": "2", "S": "2", "X": "2", "Z": "2",
        "D": "3", "T": "3",
        "L": "4",
        "M": "5", "N": "5",
        "R": "6",
    }

    first_letter = token[0]
    encoded = [first_letter]

    prev_code = mapping.get(first_letter, "0")
    for char in token[1:]:
        code = mapping.get(char, "0")
        if code != "0" and code != prev_code:
            encoded.append(code)
            prev_code = code
        elif code == "0":
            prev_code = "0"
        if len(encoded) == 4:
            break

    while len(encoded) < 4:
        encoded.append("0")

    return "".join(encoded[:4])


def evaluate_drap_status(med: Any) -> dict:
    """Assess DRAP registration legitimacy."""
    if not med:
        return {
            "status": "NOT_FOUND",
            "is_verified": False,
            "badge": "Unverified / Not in DRAP Registry",
            "registration_number": None,
            "warning": (
                "This medicine was not confirmed in the DRAP active registry. "
                "Exercise caution against counterfeit or unregistered products. "
                "Verify with a licensed pharmacy before purchase."
            ),
            "urdu_warning": (
                "یہ دوا DRAP کی فعال فہرست میں تصدیق شدہ نہیں ہے۔ "
                "جعلی یا غیر رجسٹرڈ ادویات سے بچنے کے لیے کسی مستند فارماسسٹ سے تصدیق کریں۔"
            ),
        }

    # Extract registration info
    reg_info = getattr(med, "registration_info", None)
    if isinstance(med, dict):
        reg_info = med.get("registration_info")

    status = med.get("source_verification_status") if isinstance(med, dict) else getattr(med, "source_verification_status", None)
    verified = bool(reg_info and status == "verified_active")
    return {
        "status": "VERIFIED_ACTIVE" if verified else "CATALOG_MATCH",
        "is_verified": verified,
        "badge": "Registration verified" if verified else "Catalog match — verification pending",
        "registration_number": reg_info or None,
        "warning": None if verified else "Stored reference only. Active registration and package authenticity have not been independently confirmed.",
        "urdu_warning": None if verified else "یہ ڈیٹابیس کا حوالہ ہے۔ فعال رجسٹریشن اور پیک کی تصدیق ابھی باقی ہے۔",
    }


def evaluate_risk_tier(med: Any) -> dict:
    """Categorize medicine into Self-Medication Risk Tiers.
    Tier 1 (Low Risk - OTC)
    Tier 2 (Moderate Risk - OTC Caution / Combinations)
    Tier 3 (High Risk - Prescription Only / Rx)
    """
    if not med:
        return {
            "tier": 2,
            "label": "Tier 2 (Moderate Risk - Unconfirmed)",
            "color": "amber",
            "advisory": "Unconfirmed product: consult a registered pharmacist before self-administering.",
            "advisory_urdu": "غیر تصدیق شدہ دوا: خود استعمال کرنے سے پہلے فارماسسٹ سے مشورہ کریں۔",
        }

    brand = (getattr(med, "brand_name", "") or (med.get("brand_name") if isinstance(med, dict) else "")).lower()
    generic = (getattr(med, "generic_name", "") or (med.get("generic_name") if isinstance(med, dict) else "")).lower()
    category = (getattr(med, "category", "") or (med.get("category") if isinstance(med, dict) else "")).lower().replace("-", "")

    # Tier 3 indicators (High Risk - Rx Only)
    tier_3_keywords = [
        "antibiotic", "cephalosporin", "quinolone", "penicillin", "macrolide",
        "cefixime", "cefuroxime", "ciprofloxacin", "azithromycin", "amoxicillin",
        "cardiovascular", "antihypertensive", "amlodipine", "atenolol", "furosemide",
        "bisoprolol", "losartan", "gliclazide", "sitagliptin", "diuretic", "antidiabetic", "insulin", "metformin", "glimepiride",
        "psychotropic", "sedative", "benzodiazepine", "alprazolam", "valproate",
        "carbamazepine", "anticonvulsant", "steroid", "dexamethasone", "prednisolone"
    ]
    for kw in tier_3_keywords:
        if kw in generic or kw in category or kw in brand:
            return {
                "tier": 3,
                "label": "Tier 3 (High Risk - Prescription Only)",
                "color": "red",
                "advisory": "Strict Prescription Medicine (Rx). Do not self-administer without a doctor's valid prescription.",
                "advisory_urdu": "یہ دوا صرف ڈاکٹر کے نسخے پر استعمال کریں۔ خود ادویات سے پرہیز کریں۔",
            }

    # Tier 2 indicators (Moderate Risk - Caution)
    tier_2_keywords = [
        "nsaid", "ibuprofen", "mefenamic", "diclofenac", "naproxen",
        "omeprazole", "esomeprazole", "proton pump", "gastric", "anti-ulcer",
        "combination", "pseudoephedrine", "antispasmodic"
    ]
    for kw in tier_2_keywords:
        if kw in generic or kw in category or kw in brand:
            return {
                "tier": 2,
                "label": "Tier 2 (Moderate Risk - OTC Caution)",
                "color": "amber",
                "advisory": "Use with caution. Avoid prolonged use or exceeding recommended dosage; check for stomach or kidney sensitivity.",
                "advisory_urdu": "احتیاط سے استعمال کریں۔ زیادہ مقدار یا مسلسل استعمال سے پرہیز کریں۔",
            }

    if generic not in {"paracetamol"}:
        return {
            "tier": 2, "label": "Risk classification unavailable", "color": "amber",
            "advisory": "Ask a licensed pharmacist; absence of a high-risk keyword does not establish OTC status.",
            "advisory_urdu": "خطرے کی درجہ بندی دستیاب نہیں۔ مستند فارماسسٹ سے تصدیق کریں۔",
        }
    # Explicit low-risk reference only; never infer OTC for an unknown product.
    return {
        "tier": 1,
        "label": "Tier 1 (Low Risk - OTC)",
        "color": "green",
        "advisory": "Generally safe for short-term over-the-counter self-care as directed on packaging.",
        "advisory_urdu": "عام علامات کے لیے ہدایت کے مطابق عارضی طور پر استعمال کے لیے محفوظ ہے۔",
    }


def check_lasa_collision(
    query: str,
    matched_med: Any,
    all_medicines: list[Any],
) -> Optional[dict]:
    """Detect Look-Alike / Sound-Alike collisions.
    CRITICAL RULE: If candidate and match have the SAME generic active molecule
    (e.g., Panadol vs Calpol, both Paracetamol), this is a safe substitution, NOT a LASA collision.
    Collision is only flagged if names are phonetically/orthographically confusable AND have DIFFERENT generic formulas.
    """
    if not query or not matched_med:
        return None

    clean_query = re.sub(r"[^\w\s]", "", query).lower().strip()
    query_tokens = clean_query.split()
    primary_query_token = query_tokens[0] if query_tokens else clean_query

    matched_brand = getattr(matched_med, "brand_name", "") or (
        matched_med.get("brand_name", "") if isinstance(matched_med, dict) else ""
    )
    matched_generic = getattr(matched_med, "generic_name", "") or (
        matched_med.get("generic_name", "") if isinstance(matched_med, dict) else ""
    )
    clean_matched_brand = re.sub(r"[^\w\s]", "", matched_brand).lower().strip()
    clean_matched_generic = matched_generic.lower().strip()

    # Step 1: Check curated high-hazard pairs first
    for a, b in CONFUSABLE_PAIRS:
        matched_pair = False
        target_token = None
        if a in primary_query_token or primary_query_token in a:
            target_token = b
            matched_pair = True
        elif b in primary_query_token or primary_query_token in b:
            target_token = a
            matched_pair = True

        if matched_pair and target_token:
            # Look for confusable candidate in medicine pool
            for other_med in all_medicines:
                other_brand = getattr(other_med, "brand_name", "") or (
                    other_med.get("brand_name", "") if isinstance(other_med, dict) else ""
                )
                other_generic = getattr(other_med, "generic_name", "") or (
                    other_med.get("generic_name", "") if isinstance(other_med, dict) else ""
                )
                clean_other_brand = re.sub(r"[^\w\s]", "", other_brand).lower().strip()
                clean_other_generic = other_generic.lower().strip()

                if target_token in clean_other_brand or clean_other_brand in target_token:
                    # GENERIC IMMUNITY CHECK:
                    if clean_matched_generic and clean_matched_generic == clean_other_generic:
                        # Same generic active ingredient -> Safe substitution, NOT a collision!
                        return None

                    # Different generic ingredient -> High-hazard collision detected!
                    logger.warning(
                        f"LASA collision detected between queried '{query}' ({matched_brand} - {matched_generic}) "
                        f"and confusable '{other_brand}' ({other_generic})"
                    )
                    return {
                        "confirmation_required": True,
                        "query": query,
                        "candidate_a": {
                            "id": str(getattr(matched_med, "id", "") or matched_med.get("id", "")),
                            "brand_name": matched_brand,
                            "generic_name": matched_generic,
                            "strength": getattr(matched_med, "strength", "") or matched_med.get("strength", ""),
                            "dosage_form": getattr(matched_med, "dosage_form", "") or matched_med.get("dosage_form", ""),
                            "category": getattr(matched_med, "category", "") or matched_med.get("category", ""),
                        },
                        "candidate_b": {
                            "id": str(getattr(other_med, "id", "") or other_med.get("id", "")),
                            "brand_name": other_brand,
                            "generic_name": other_generic,
                            "strength": getattr(other_med, "strength", "") or other_med.get("strength", ""),
                            "dosage_form": getattr(other_med, "dosage_form", "") or other_med.get("dosage_form", ""),
                            "category": getattr(other_med, "category", "") or other_med.get("category", ""),
                        },
                        "warning_message": (
                            f"Potential Look-Alike / Sound-Alike (LASA) collision between '{matched_brand}' ({matched_generic}) "
                            f"and '{other_brand}' ({other_generic}). They treat completely different conditions. "
                            f"Please select your intended medicine before proceeding."
                        ),
                        "urdu_warning_message": (
                            f"خبردار: '{matched_brand}' اور '{other_brand}' کے نام ملتے جلتے ہیں لیکن دونوں کا فارمولا بالکل مختلف ہے۔ "
                            f"براہ کرم آگے بڑھنے سے پہلے اپنی مطلوبہ دوا منتخب کریں۔"
                        ),
                    }

    # Step 2: Algorithmic Phonetic + Levenshtein Check against all other medicines
    query_soundex = calculate_soundex(primary_query_token)

    for other_med in all_medicines:
        other_brand = getattr(other_med, "brand_name", "") or (
            other_med.get("brand_name", "") if isinstance(other_med, dict) else ""
        )
        clean_other_brand = re.sub(r"[^\w\s]", "", other_brand).lower().strip()
        if not clean_other_brand or clean_other_brand == clean_matched_brand:
            continue

        other_generic = getattr(other_med, "generic_name", "") or (
            other_med.get("generic_name", "") if isinstance(other_med, dict) else ""
        )
        clean_other_generic = other_generic.lower().strip()

        # GENERIC IMMUNITY: If same generic formula, skip (safe alternative)
        if clean_matched_generic and clean_matched_generic == clean_other_generic:
            continue

        other_soundex = calculate_soundex(clean_other_brand)
        lev_dist = Levenshtein.distance(clean_matched_brand, clean_other_brand)

        # Collision criteria: matching Soundex AND small edit distance
        if (query_soundex == other_soundex and lev_dist <= 2 and len(clean_matched_brand) >= 4) or (
            lev_dist == 1 and len(clean_matched_brand) >= 5
        ):
            logger.warning(
                f"Algorithmic LASA collision: '{matched_brand}' vs '{other_brand}' (Soundex: {query_soundex}, Dist: {lev_dist})"
            )
            return {
                "confirmation_required": True,
                "query": query,
                "candidate_a": {
                    "id": str(getattr(matched_med, "id", "") or matched_med.get("id", "")),
                    "brand_name": matched_brand,
                    "generic_name": matched_generic,
                    "strength": getattr(matched_med, "strength", "") or matched_med.get("strength", ""),
                    "dosage_form": getattr(matched_med, "dosage_form", "") or matched_med.get("dosage_form", ""),
                    "category": getattr(matched_med, "category", "") or matched_med.get("category", ""),
                },
                "candidate_b": {
                    "id": str(getattr(other_med, "id", "") or other_med.get("id", "")),
                    "brand_name": other_brand,
                    "generic_name": other_generic,
                    "strength": getattr(other_med, "strength", "") or other_med.get("strength", ""),
                    "dosage_form": getattr(other_med, "dosage_form", "") or other_med.get("dosage_form", ""),
                    "category": getattr(other_med, "category", "") or other_med.get("category", ""),
                },
                "warning_message": (
                    f"Confusable drug alert: '{matched_brand}' ({matched_generic}) sounds or looks like '{other_brand}' ({other_generic}). "
                    f"Please confirm your intended medication."
                ),
                "urdu_warning_message": (
                    f"توجہ فرمائیں: '{matched_brand}' اور '{other_brand}' کی آواز اور ہجے ملتے جلتے ہیں۔ "
                    f"براہ کرم اپنی مطلوبہ دوا کی تصدیق کریں۔"
                ),
            }

    return None
