"""Localized messages for the alert-check endpoint (spec 07 / spec 09 §10).

Static string catalog for EN / Urdu / Roman-Urdu. The status and every alert
fact come only from ``drap_alerts`` DB rows — the LLM is never involved and
never decides authenticity (spec 08/09 §10).

The disclaimer is ALWAYS attached and always states the Feature B safety
line: "No alert found does NOT guarantee authenticity" (spec 09 §10). When
the matched alert rows are demo rows, the DEMO DATA note is appended.
"""

EN = {
    "no_alert": (
        "No active DRAP alert was found for this medicine in our records."
    ),
    "alert_found": (
        "An active alert matches this medicine and batch number. Please "
        "consult your pharmacist or doctor before further use, and report "
        "the product to DRAP."
    ),
    "possible_verify": (
        "An alert exists for this medicine, but we could not confirm it "
        "matches your specific batch. Possible match — please verify with "
        "your pharmacist or DRAP."
    ),
    "needs_confirmation": (
        "We could not confidently identify this medicine. Please confirm "
        "which one you mean from the candidates."
    ),
    "no_match": (
        "We could not identify this medicine in the verified database. "
        "Please check the spelling or try the brand or generic name."
    ),
    "demo_note": (
        "Note: the matched alert row(s) are DEMO DATA seeded for testing — "
        "not a real DRAP notice."
    ),
    "disclaimer": (
        "No alert found does NOT guarantee authenticity. Verify with your "
        "pharmacist and report suspicious products to DRAP."
    ),
}

UR = {
    "no_alert": (
        "اس دوا کے لیے ہمارے ریکارڈ میں کوئی فعال DRAP الرٹ نہیں ملا۔"
    ),
    "alert_found": (
        "اس دوا اور بیچ نمبر کے لیے ایک فعال الرٹ میچ ہوا ہے۔ براہ کرم مزید "
        "استعمال سے پہلے اپنے فارماسسٹ یا ڈاکٹر سے مشورہ کریں اور پروڈکٹ کی "
        "DRAP کو اطلاع دیں۔"
    ),
    "possible_verify": (
        "اس دوا کے لیے ایک الرٹ موجود ہے، لیکن ہم تصدیق نہیں کر سکے کہ وہ آپ "
        "کے مخصوص بیچ سے میچ کرتا ہے۔ یہ ممکنہ میچ ہے — براہ کرم اپنے "
        "فارماسسٹ یا DRAP سے تصدیق کریں۔"
    ),
    "needs_confirmation": (
        "ہم اس دوا کی پوری طرح شناخت نہیں کر سکے۔ براہ کرم فہرست میں سے تصدیق "
        "کریں کہ آپ کی مراد کون سی دوا ہے۔"
    ),
    "no_match": (
        "ہم اس دوا کو تصدیق شدہ ڈیٹابیس میں شناخت نہیں کر سکے۔ براہ کرم املا "
        "چیک کریں یا برانڈ یا جنرک نام آزمائیں۔"
    ),
    "demo_note": (
        "نوٹ: میچ ہونے والا الرٹ ڈیمو ڈیٹا ہے (ٹیسٹنگ کے لیے شامل کیا گیا) — "
        "یہ حقیقی DRAP نوٹس نہیں ہے۔"
    ),
    "disclaimer": (
        "الرٹ نہ ملنا اصل ہونے کی ضمانت نہیں ہے۔ اپنے فارماسسٹ سے تصدیق کریں "
        "اور مشکوک پروڈکٹس کی DRAP کو اطلاع دیں۔"
    ),
}

ROMAN_UR = {
    "no_alert": (
        "Is dawai ke liye hamare records mein koi active DRAP alert nahi mila."
    ),
    "alert_found": (
        "Is dawai aur batch number ke liye ek active alert match hua hai. "
        "Barah-e-karam mazeed istemal se pehle apne pharmacist ya doctor se "
        "mashwara karein aur product ki DRAP ko report karein."
    ),
    "possible_verify": (
        "Is dawai ke liye ek alert mojood hai, lekin hum confirm nahi kar "
        "sake ke wo aap ke specific batch se match karta hai. Possible match "
        "hai — barah-e-karam pharmacist ya DRAP se verify karein."
    ),
    "needs_confirmation": (
        "Hum is dawai ko puri tarah identify nahi kar sake. Barah-e-karam "
        "candidates mein se confirm karein ke aap ka matlab kaun si dawai hai."
    ),
    "no_match": (
        "Hum is dawai ko verified database mein identify nahi kar sake. "
        "Barah-e-karam spelling check karein ya brand ya generic name try karein."
    ),
    "demo_note": (
        "Note: match hone wala alert row DEMO DATA hai (testing ke liye "
        "seeded) — ye haqeeqi DRAP notice nahi hai."
    ),
    "disclaimer": (
        "Alert na milna asli (authentic) hone ki zamanat NAHI hai. Apne "
        "pharmacist se tasdeeq karein aur mashkook products DRAP ko report karein."
    ),
}

_CATALOGS = {"en": EN, "ur": UR, "roman_ur": ROMAN_UR}


def normalize_lang(lang: str | None) -> str:
    """Map user-supplied language codes to catalog keys (default: en)."""
    key = (lang or "en").strip().lower().replace("-", "_")
    if key in ("ur", "urdu"):
        return "ur"
    if key in ("roman_ur", "romanur", "roman urdu".replace(" ", "_")):
        return "roman_ur"
    return "en"


def localize(lang: str, key: str, **kwargs) -> str:
    """Render a catalog message for the given language, filling placeholders."""
    catalog = _CATALOGS.get(normalize_lang(lang), EN)
    template = catalog.get(key) or EN[key]
    return template.format(**kwargs) if kwargs else template
