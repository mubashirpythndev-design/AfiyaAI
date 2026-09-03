"""Afiya AI — Disease, Illness & Symptom Medicine Advisory Service.

Grounds all condition-to-medicine inquiries in the authoritative 'when_to_use'
dataset from DRAP-registered medicines across all 11 therapeutic categories.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any, Optional

from app.models.schemas import SourceSchema

logger = logging.getLogger(__name__)

def get_dataset_path(filename: str = "afiya_medicine_comparison_dataset_clean.json") -> Path:
    """Safely locate the dataset file across local, container, and cloud environments."""
    # 1. Check current working directory and subdirectories
    for base in [Path.cwd(), Path.cwd() / "data", Path.cwd() / "apps" / "api", Path.cwd() / "apps" / "api" / "data"]:
        candidate = base / filename
        if candidate.is_file():
            return candidate

    # 2. Walk up parent directories from current file safely without fixed indexing
    current = Path(__file__).resolve()
    for parent in current.parents:
        for sub in [parent, parent / "data", parent / "apps" / "api", parent / "apps" / "api" / "data"]:
            candidate = sub / filename
            if candidate.is_file():
                return candidate

    # 3. Fallback
    return Path(filename)


# In-memory dataset cache
_MEDICINES_DATA: list[dict[str, Any]] = []


def load_dataset() -> list[dict[str, Any]]:
    """Load the verified DRAP dataset containing 'when_to_use' information."""
    global _MEDICINES_DATA
    if _MEDICINES_DATA:
        return _MEDICINES_DATA

    data_file = get_dataset_path()
    if not data_file.exists():
        logger.warning(f"DRAP clean dataset not found at {data_file}")
        return []

    try:
        with open(data_file, "r", encoding="utf-8") as f:
            _MEDICINES_DATA = json.load(f)
        logger.info(f"Loaded {len(_MEDICINES_DATA)} medicines with medical info for disease advisory.")
    except Exception as e:
        logger.error(f"Failed to load medicine dataset from {data_file}: {e}")
        _MEDICINES_DATA = []

    return _MEDICINES_DATA


# Comprehensive Thesaurus covering all 11 therapeutic categories in the dataset
DISEASE_THESAURUS = [
    {
        "category": "Anti-diabetic",
        "condition_en": "Type 2 Diabetes Mellitus & Blood Sugar Control",
        "condition_ur": "ذیابیطس / شوگر کا علاج",
        "condition_ru": "Sugar (Type 2 Diabetes) aur PCOS",
        "keywords": [
            "diabetes", "diabetic", "sugar", "blood sugar", "type 2 diabetes",
            "type 2 sugar", "glucose", "high sugar", "pcos", "insulin resistance",
            "hyperglycemia", "sugar control", "sugar ki bimari", "sugar ka ilaj",
        ],
        "primary_generics": ["Metformin", "Glimepiride", "Gliclazide", "Sitagliptin + Metformin"],
        "common_brands": ["Glucophage", "Amaryl", "Diamicron", "Janumet"],
    },
    {
        "category": "Anti-hypertensive",
        "condition_en": "High Blood Pressure (Hypertension), Angina & Heart Health",
        "condition_ur": "ہائی بلڈ پریشر اور دل کی بیماریاں",
        "condition_ru": "High Blood Pressure, Angina aur Dil ke Masail",
        "keywords": [
            "hypertension", "high blood pressure", "blood pressure", "high bp",
            "bp barhna", "bp high", "bp ka ilaj", "blood pressure ki medicine",
            "angina", "heart disease", "heart failure", "cardiac", "arrhythmia",
            "irregular heartbeat", "dil ki bimari", "dil ki dhadkan", "seene mein dard",
        ],
        "primary_generics": ["Amlodipine", "Bisoprolol", "Losartan potassium", "Atenolol"],
        "common_brands": ["Norvasc", "Concor", "Eziday", "Tenormin"],
    },
    {
        "category": "Bronchodilator / Respiratory",
        "condition_en": "Asthma, Breathing Difficulty & COPD",
        "condition_ur": "دمہ اور سانس کی تکلیف (Asthma / COPD)",
        "condition_ru": "Dama (Asthma), Saans ki Takleef aur COPD",
        "keywords": [
            "asthma", "dama", "dame", "copd", "wheezing", "shortness of breath",
            "breathing difficulty", "chest tightness", "saans lene mein dushwari",
            "saans ki takleef", "seene ki jakdan", "inhaler", "bronchospasm",
            "asthma attack", "dame ka attack", "saans phoolna",
        ],
        "primary_generics": ["Salbutamol", "Budesonide + Formoterol", "Montelukast", "Beclometasone dipropionate"],
        "common_brands": ["Ventolin", "Symbicort", "Singulair", "Clenil"],
    },
    {
        "category": "Lipid-lowering Agent",
        "condition_en": "High Cholesterol, Triglycerides & Heart Attack Prevention",
        "condition_ur": "ہائی کولیسٹرول اور دل کی حفاظت",
        "condition_ru": "High Cholesterol aur Dil ki Bimari se Bachao",
        "keywords": [
            "cholesterol", "high cholesterol", "hyperlipidemia", "lipid", "triglycerides",
            "blood fats", "cardiovascular disease", "artery blockage", "atherosclerosis",
            "cholesterol control", "cholesterol kam karne", "dil ki hifazat",
        ],
        "primary_generics": ["Atorvastatin", "Rosuvastatin"],
        "common_brands": ["Lipitor", "Crestor", "Atorva", "Rovista"],
    },
    {
        "category": "Antibiotic (Broad Spectrum)",
        "condition_en": "Bacterial Infections (Chest, Throat, UTI, Ear, Sinus, Skin)",
        "condition_ur": "بیکٹیریل انفیکشن (گلا، کان، پیشاب کی نالی، سینہ)",
        "condition_ru": "Bacterial Infections (Galay, Kaan, Saans, Pishab ki Nali, Jild)",
        "keywords": [
            "bacterial infection", "bacterial", "infection", "bacterial bimari",
            "uti", "urinary tract infection", "pishab ki nali", "bladder infection",
            "ear infection", "kaan ka dard", "kaan ki infection", "throat infection",
            "gale ki infection", "strep throat", "tonsillitis", "pharyngitis",
            "chest infection", "bronchitis", "pneumonia", "sinus infection",
            "sinusitis", "sinus", "typhoid", "skin infection", "jild ki infection",
            "h pylori", "h. pylori", "gonorrhea", "chlamydia",
        ],
        "primary_generics": ["Amoxicillin + Clavulanic acid", "Amoxicillin", "Azithromycin", "Clarithromycin", "Ciprofloxacin", "Levofloxacin", "Cefixime"],
        "common_brands": ["Augmentin", "Amoxil", "Zithromax", "Klaricid", "Ciproxin", "Cefspan"],
    },
    {
        "category": "Antacid / Anti-ulcer",
        "condition_en": "Stomach Acidity, Heartburn, GERD & Peptic Ulcers",
        "condition_ur": "معدے کی تیزابیت، سینے کی جلن اور السر",
        "condition_ru": "Mede ki Tezabiyat, Seene ki Jalan, GERD aur Ulcer",
        "keywords": [
            "acidity", "heartburn", "acid reflux", "gerd", "stomach ulcer",
            "peptic ulcer", "ulcer", "gastric", "gastritis", "tezabiat",
            "seene mein jalan", "seene ki jalan", "mede ka ulcer", "stomach burning",
            "pet mein jalan", "mede ki takleef", "hyperacidity",
        ],
        "primary_generics": ["Omeprazole", "Esomeprazole", "Pantoprazole"],
        "common_brands": ["Risek", "Nexum", "Zopent", "Losec"],
    },
    {
        "category": "Antihistamine / Anti-allergy",
        "condition_en": "Allergies, Sneezing, Runny Nose, Itching & Hives",
        "condition_ur": "الرجی، چھینکیں، خارش اور نزلہ",
        "condition_ru": "Allergy, Chhenkein, Nazla, Jild ki Kharish aur Hives",
        "keywords": [
            "allergy", "allergic", "allergies", "sneezing", "chheenk", "chheenkain",
            "runny nose", "nazla", "zukam", "itching", "kharish", "rash", "hives",
            "urticaria", "watery eyes", "hay fever", "allergic rhinitis", "skin allergy",
            "jild ki kharish",
        ],
        "primary_generics": ["Cetirizine", "Fexofenadine"],
        "common_brands": ["Rigix", "Zyrtec", "Telfast", "Softin"],
    },
    {
        "category": "Antiemetic / GI Tract",
        "condition_en": "Nausea, Vomiting, Motion Sickness & Bloating",
        "condition_ur": "متلی، الٹی، پیٹ کا پھولنا اور سفر کی بیماری",
        "condition_ru": "Matli, Ulti, Motion Sickness aur Mede ka Bhari pan",
        "keywords": [
            "nausea", "vomiting", "ulti", "matli", "motion sickness",
            "travel sickness", "bloating", "stomach fullness", "indigestion",
            "bad hazmi", "safar ki ulti", "ulti rokne",
        ],
        "primary_generics": ["Domperidone", "Dimenhydrinate"],
        "common_brands": ["Motilium", "Gravinate"],
    },
    {
        "category": "Antiemetic / GI Tract",
        "condition_en": "Diarrhea, Amoebic Dysentery & Intestinal Infections",
        "condition_ur": "پیچش، دست اور آنتوں کی انفیکشن",
        "condition_ru": "Pechis (Dysentery), Dast, Loose Motion aur Aanton ka Infection",
        "keywords": [
            "diarrhea", "loose motion", "dast", "dysentery", "pechis",
            "amoebic dysentery", "pet kharab", "food poisoning", "intestinal infection",
            "aanton ki infection", "amoeba",
        ],
        "primary_generics": ["Metronidazole", "Metronidazole + Diloxanide furoate"],
        "common_brands": ["Flagyl", "Entamizole"],
    },
    {
        "category": "Analgesic / Antipyretic",
        "condition_en": "Headache & Migraine",
        "condition_ur": "سر درد اور آدھے سر کا درد (مائیگرین)",
        "condition_ru": "Sar Dard aur Migraine (Aadhe sar ka dard)",
        "keywords": [
            "headache", "head ache", "head pain", "migraine", "sar dard",
            "sar me dard", "sar mein dard", "sar ghoomna", "aadhe sar ka dard",
        ],
        "primary_generics": ["Paracetamol", "Ibuprofen"],
        "common_brands": ["Panadol", "Calpol", "Febrol", "Brufen"],
    },
    {
        "category": "Analgesic / Antipyretic",
        "condition_en": "Fever & High Temperature",
        "condition_ur": "بخار اور جسم کی حرارت",
        "condition_ru": "Bukhar aur Jism ki Hararat",
        "keywords": [
            "fever", "high temperature", "bukhar", "bukhaar", "hararat", "tap",
            "feverish", "bukhar utarne",
        ],
        "primary_generics": ["Paracetamol", "Ibuprofen", "Aspirin (Acetylsalicylic acid)"],
        "common_brands": ["Panadol", "Febrol", "Brufen", "Disprin"],
    },
    {
        "category": "Analgesic / Antipyretic",
        "condition_en": "Body Pain, Muscle Aches, Joint Pain & Arthritis",
        "condition_ur": "جسم کا درد، پٹھوں کا درد اور جوڑوں کا درد",
        "condition_ru": "Jism ka Dard, Pathon ka Dard, Jodon ka Dard aur Sujan",
        "keywords": [
            "body pain", "body ache", "muscle pain", "jism mein dard", "badan dard",
            "kamar dard", "back pain", "joint pain", "jodon ka dard", "arthritis",
            "inflammation", "swelling", "soojan", "sujan", "pathon ka khinchao",
        ],
        "primary_generics": ["Ibuprofen", "Paracetamol", "Mefenamic acid"],
        "common_brands": ["Brufen", "Ponstan", "Panadol"],
    },
    {
        "category": "Analgesic / Antipyretic",
        "condition_en": "Toothache & Dental Pain",
        "condition_ur": "دانت کا درد اور مسوڑھوں کی تکلیف",
        "condition_ru": "Daant ka Dard aur Masooron ki Takleef",
        "keywords": [
            "toothache", "tooth pain", "teeth pain", "dant dard", "daant dard",
            "daant mein dard", "dant mein dard", "dental pain", "gum pain",
        ],
        "primary_generics": ["Mefenamic acid", "Paracetamol", "Ibuprofen"],
        "common_brands": ["Ponstan", "Brufen", "Panadol"],
    },
    {
        "category": "Analgesic / Antipyretic",
        "condition_en": "Menstrual Cramps & Period Pain",
        "condition_ur": "مخصوص ایام کا درد (Menstrual Pain)",
        "condition_ru": "Makhsoos Ayam ka Dard aur Cramps",
        "keywords": [
            "menstrual cramps", "period pain", "menstrual pain", "dysmenorrhea",
            "makhsoos ayam", "haiz ka dard", "period cramps",
        ],
        "primary_generics": ["Mefenamic acid", "Ibuprofen"],
        "common_brands": ["Ponstan", "Brufen"],
    },
    {
        "category": "Analgesic / Antipyretic",
        "condition_en": "Blood Clot Prevention & Stroke / Heart Attack Prophylaxis",
        "condition_ur": "خون پتلا کرنا اور ہارٹ اٹیک / فالج سے بچاؤ",
        "condition_ru": "Khoon Jamne se Rokna aur Dil ki Hifazat",
        "keywords": [
            "blood clot", "blood clots", "blood thinner", "stroke prevention",
            "heart attack prevention", "khoon patla", "khoon jamna",
        ],
        "primary_generics": ["Aspirin (Acetylsalicylic acid)"],
        "common_brands": ["Disprin", "Ascard", "Loprin"],
    },
]


def find_medicines_for_condition(message: str) -> tuple[str, list[dict[str, Any]], str]:
    """Find verified medicines and 'when_to_use' information for any disease/illness mentioned.

    Returns:
        tuple of (condition_name, list_of_matching_medicine_dicts, formatted_context_str)
    """
    msg_lower = message.lower()
    dataset = load_dataset()

    matched_thesaurus_entry: Optional[dict[str, Any]] = None
    best_score = 0

    # 1. Match against Disease Thesaurus
    for entry in DISEASE_THESAURUS:
        score = 0
        for kw in entry["keywords"]:
            if re.search(r"" + re.escape(kw) + r"", msg_lower) or kw in msg_lower:
                score += len(kw)
        if score > best_score:
            best_score = score
            matched_thesaurus_entry = entry

    # 2. If thesaurus matched, collect corresponding medicines from the dataset
    matching_meds: list[dict[str, Any]] = []
    condition_name = ""

    if matched_thesaurus_entry:
        condition_name = matched_thesaurus_entry["condition_en"]
        target_generics = [g.lower() for g in matched_thesaurus_entry["primary_generics"]]

        for item in dataset:
            gen_name = item.get("generic_name", "").lower()
            if any(tg in gen_name or gen_name in tg for tg in target_generics):
                matching_meds.append(item)

    # 3. Fallback: Full-Text search across dataset 'when_to_use' fields
    if not matching_meds:
        words = [w for w in re.findall(r"[a-zA-Z]{3,}", msg_lower) if w not in {
            "what", "which", "medicine", "should", "take", "having", "have", "with",
            "from", "this", "that", "user", "doctor", "please", "tell", "give", "need",
            "dawa", "dawai", "lein", "karein", "hona", "hota", "hoti", "hain", "kya",
            "disease", "illness", "suffering"
        }]

        matched_items = []
        for item in dataset:
            med_info = item.get("medical_info", {}).get("when_to_use", {})
            en_use = med_info.get("en", "").lower()
            ru_use = med_info.get("roman_urdu", "").lower()
            cat = item.get("category", "").lower()

            hit_count = sum(1 for w in words if w in en_use or w in ru_use or w in cat)
            if hit_count > 0:
                matched_items.append((hit_count, item))

        if matched_items:
            matched_items.sort(key=lambda x: x[0], reverse=True)
            matching_meds = [x[1] for x in matched_items[:6]]
            condition_name = matching_meds[0].get("category", "Reported Health Condition")

    if not matching_meds:
        return "", [], ""

    # Build comprehensive, structured medical context with when_to_use facts
    lines = [
        f"Verified Database Medicines Indicated for: {condition_name}",
        "Clinical 'When to Use' and Approved Indications from Authoritative DRAP Records:",
    ]

    seen_generics: set[str] = set()
    sample_meds = []
    for med in matching_meds:
        gen = med.get("generic_name", "")
        brand = med.get("brand_name", "")
        strength = med.get("strength", "")
        form = med.get("dosage_form", "")
        mfg = med.get("manufacturer", "")
        price = med.get("unit_price_pkr", "N/A")
        cat = med.get("category", "")
        when_to_use = med.get("medical_info", {}).get("when_to_use", {})
        en_use = when_to_use.get("en", "")
        ru_use = when_to_use.get("roman_urdu", "")

        sample_meds.append(med)
        if gen not in seen_generics:
            seen_generics.add(gen)
            lines.append(f"\n* Active Generic Molecule: {gen} (Category: {cat})")
            if en_use:
                lines.append(f"  - Official Clinical 'When to Use' (EN): {en_use}")
            if ru_use:
                lines.append(f"  - Official Clinical 'When to Use' (Roman Urdu): {ru_use}")
            lines.append(f"  - Featured Verified Brand: {brand} {strength} {form} by {mfg} (Est. Price: Rs. {price}/unit)")

    return condition_name, sample_meds[:6], "\n".join(lines)


def get_sources_for_condition(medicines: list[dict[str, Any]]) -> list[SourceSchema]:
    """Generate provenance sources for the medicines returned in condition advisory."""
    sources: list[SourceSchema] = []
    seen = set()
    for med in medicines:
        brand = med.get("brand_name")
        if brand and brand not in seen:
            seen.add(brand)
            sources.append(
                SourceSchema(
                    name=f"{brand} (DRAP Reference)",
                    url="https://e.dra.gov.pk/public/price",
                    source_type="reference_regulatory",
                )
            )
    return sources
