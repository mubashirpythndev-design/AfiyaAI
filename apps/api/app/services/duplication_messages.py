"""Static duplication warnings; no diagnosis, prescribing or generated claims."""
EN = {
    "same_generic": "These entries contain the same stored generic ({group}). Taking them together may duplicate treatment. Consult your doctor or pharmacist before changing medicines.",
    "same_class": "These different generics share the stored therapeutic category ({group}). This is a screening alert, not proof of an unsafe combination. Consult your doctor or pharmacist.",
    "found": "Possible therapeutic duplication found. A doctor or pharmacist should review the medicine list.",
    "clear": "No duplication found among confidently identified medicines. This does not establish that the combination is safe.",
    "disclaimer": "Screening uses stored generic/category data, not a complete interaction check or medical advice. Do not change treatment on this result alone; consult your doctor or pharmacist. Unresolved medicines were not assessed.",
}
UR = {
    "same_generic": "ان دواؤں میں ایک ہی محفوظ جنرک ({group}) درج ہے۔ ساتھ لینے سے علاج دہرایا جا سکتا ہے۔ دوا بدلنے سے پہلے ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔",
    "same_class": "ان مختلف جنرکس کی محفوظ علاجی کیٹیگری ({group}) ایک ہے۔ یہ ابتدائی جانچ کا انتباہ ہے، غیر محفوظ امتزاج کا ثبوت نہیں۔ ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔",
    "found": "ممکنہ علاجی تکرار ملی ہے۔ ڈاکٹر یا فارماسسٹ سے دواؤں کی فہرست چیک کروائیں۔",
    "clear": "شناخت شدہ دواؤں میں تکرار نہیں ملی۔ اس سے امتزاج کا محفوظ ہونا ثابت نہیں ہوتا۔",
    "disclaimer": "یہ جانچ محفوظ جنرک اور کیٹیگری پر مبنی ہے، مکمل تعاملات کی جانچ یا طبی مشورہ نہیں۔ صرف اس نتیجے پر علاج تبدیل نہ کریں؛ ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔ غیر شناخت شدہ دوائیں جانچی نہیں گئیں۔",
}
ROMAN_UR = {
    "same_generic": "In entries mein aik hi stored generic ({group}) hai. Sath lene se treatment duplicate ho sakta hai. Dawa badalne se pehle doctor ya pharmacist se mashwara karein.",
    "same_class": "In mukhtalif generics ki stored therapeutic category ({group}) aik hai. Yeh screening alert hai, unsafe combination ka saboot nahi. Doctor ya pharmacist se mashwara karein.",
    "found": "Mumkin therapeutic duplication mili hai. Doctor ya pharmacist se dawaon ki list check karwaein.",
    "clear": "Confidently identified dawaon mein duplication nahi mili. Is se combination ka safe hona sabit nahi hota.",
    "disclaimer": "Yeh stored generic/category ki screening hai, mukammal interaction check ya medical advice nahi. Sirf is result par treatment tabdeel na karein; doctor ya pharmacist se mashwara karein. Unresolved dawaein assess nahi huin.",
}


def localize(key: str, lang: str = "en", **values: str) -> str:
    return {"en": EN, "ur": UR, "roman_ur": ROMAN_UR}.get(lang, EN)[key].format(**values)
