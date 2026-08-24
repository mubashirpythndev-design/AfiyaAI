"""Localized messages for the price-check endpoint (spec 07 / spec 09 §10).

Static string catalog for EN / Urdu / Roman-Urdu. Templates only ever
interpolate DB-sourced values (amounts, MRP) — never LLM output (spec 08).
The disclaimer is ALWAYS attached and always carries the freshness warning:
"MRP change ho sakti hai — latest DRAP notification se verify karein".
"""

EN = {
    "overcharged": (
        "You were charged Rs. {amount} MORE than the DRAP-notified MRP "
        "of Rs. {mrp} for this pack."
    ),
    "ok_at_mrp": (
        "The price you paid is exactly at the DRAP-notified MRP of Rs. {mrp}."
    ),
    "below_mrp": (
        "You paid Rs. {amount} LESS than the DRAP-notified MRP of Rs. {mrp}."
    ),
    "no_data": (
        "We do not have a DRAP-notified MRP for this medicine and pack "
        "size yet, so no comparison was made."
    ),
    "currency_mismatch": (
        "Price comparison is only available for PKR (DRAP-notified prices) "
        "right now, so no comparison was made."
    ),
    "needs_confirmation": (
        "We could not confidently identify this medicine. Please confirm "
        "which one you mean from the candidates."
    ),
    "no_match": (
        "We could not identify this medicine in the verified database. "
        "Please check the spelling or try the brand or generic name."
    ),
    "specify_pack": (
        "This medicine has more than one pack size ({packs}). Please tell "
        "us which pack you bought before we compare the price."
    ),
    "disclaimer": (
        "MRP can change via new DRAP notifications (SRO) — verify from the "
        "latest DRAP notification. This is not legal advice."
    ),
}

UR = {
    "overcharged": (
        "آپ سے اس پیک کی سرکاری ایم آر پی (Rs. {mrp}) سے Rs. {amount} زیادہ لیے گئے ہیں۔"
    ),
    "ok_at_mrp": (
        "آپ نے جو قیمت ادا کی وہ DRAP کی مقررہ ایم آر پی (Rs. {mrp}) کے بالکل برابر ہے۔"
    ),
    "below_mrp": (
        "آپ نے ایم آر پی (Rs. {mrp}) سے Rs. {amount} کم ادا کیے۔"
    ),
    "no_data": (
        "اس دوا اور پیک سائز کے لیے ہمارے پاس ابھی DRAP کی مقررہ ایم آر پی "
        "موجود نہیں، اس لیے کوئی موازنہ نہیں کیا گیا۔"
    ),
    "currency_mismatch": (
        "قیمت کا موازنہ فی الحال صرف PKR (DRAP کی مقررہ قیمتوں) کے لیے دستیاب ہے، "
        "اس لیے کوئی موازنہ نہیں کیا گیا۔"
    ),
    "needs_confirmation": (
        "ہم اس دوا کی پوری طرح شناخت نہیں کر سکے۔ براہ کرم فہرست میں سے تصدیق "
        "کریں کہ آپ کی مراد کون سی دوا ہے۔"
    ),
    "no_match": (
        "ہم اس دوا کو تصدیق شدہ ڈیٹابیس میں شناخت نہیں کر سکے۔ براہ کرم املا "
        "چیک کریں یا برانڈ یا جنرک نام آزمائیں۔"
    ),
    "specify_pack": (
        "اس دوا کا ایک سے زیادہ پیک سائز ہے ({packs})۔ قیمت کا موازنہ کرنے سے "
        "پہلے براہ کرم بتائیں کہ آپ نے کون سا پیک خریدا۔"
    ),
    "disclaimer": (
        "ایم آر پی تبدیل ہو سکتی ہے — تازہ ترین DRAP نوٹیفکیشن سے تصدیق کریں۔ "
        "یہ قانونی مشورہ نہیں ہے۔"
    ),
}

ROMAN_UR = {
    "overcharged": (
        "Aap se is pack ki MRP (Rs. {mrp}) se Rs. {amount} zyada liye gaye."
    ),
    "ok_at_mrp": (
        "Aap ne jo price di wo DRAP notified MRP (Rs. {mrp}) ke barabar hai."
    ),
    "below_mrp": (
        "Aap ne MRP (Rs. {mrp}) se Rs. {amount} kam diye."
    ),
    "no_data": (
        "Is dawai aur pack size ke liye hamare paas abhi DRAP notified MRP "
        "mojood nahi, is liye koi comparison nahi ki gayi."
    ),
    "currency_mismatch": (
        "Price comparison filhaal sirf PKR (DRAP notified prices) ke liye "
        "available hai, is liye koi comparison nahi ki gayi."
    ),
    "needs_confirmation": (
        "Hum is dawai ko puri tarah identify nahi kar sake. Barah-e-karam "
        "candidates mein se confirm karein ke aap ka matlab kaun si dawai hai."
    ),
    "no_match": (
        "Hum is dawai ko verified database mein identify nahi kar sake. "
        "Barah-e-karam spelling check karein ya brand ya generic name try karein."
    ),
    "specify_pack": (
        "Is dawai ka ek se zyada pack size hai ({packs}). Price compare karne "
        "se pehle barah-e-karam batayein ke aap ne kaun sa pack khareeda."
    ),
    "disclaimer": (
        "MRP change ho sakti hai — latest DRAP notification se verify karein. "
        "Ye legal advice nahi."
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
