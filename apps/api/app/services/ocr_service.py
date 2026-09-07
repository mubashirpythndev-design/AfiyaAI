"""Afiya AI — Clinical Prescription OCR & Vision Extraction Service.
Combines local image preprocessing, clinical domain-specific multimodal vision prompts,
and pharmaceutical lexicon spell-correction for near-perfection prescription recognition.
Author / Developer: Mubashir (Lead Developer)
"""

import base64
import copy
import hashlib
import json
import logging
import re
import google.generativeai as genai

from app.config import settings
from app.services.image_preprocessor import preprocess_prescription_image
from app.services.pharmaceutical_corrector import correct_and_normalize_candidate

logger = logging.getLogger(__name__)

# In-memory deterministic cache for extracted prescription results keyed by image SHA-256
MAX_OCR_CACHE_ENTRIES = 500
_PRESCRIPTION_OCR_CACHE: dict[str, dict] = {}


def _cache_put(key: str, value: dict) -> None:
    """Store entry in cache, evicting oldest item if size limit is reached."""
    if len(_PRESCRIPTION_OCR_CACHE) >= MAX_OCR_CACHE_ENTRIES:
        try:
            first_key = next(iter(_PRESCRIPTION_OCR_CACHE))
            _PRESCRIPTION_OCR_CACHE.pop(first_key, None)
        except StopIteration:
            pass
    _PRESCRIPTION_OCR_CACHE[key] = copy.deepcopy(value)


def clear_ocr_cache() -> None:
    """Clear in-memory OCR cache (useful for testing or cache invalidation)."""
    _PRESCRIPTION_OCR_CACHE.clear()

CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT = """You are an expert Clinical Pharmacist and Medical Prescription Vision Specialist.
Carefully inspect this doctor's prescription image (which may contain messy cursive handwriting, clinical shorthand, and bilingual Urdu/English directions).

### CLINICAL EXTRACTION INSTRUCTIONS:
1. FOCUS STRICTLY ON THE MEDICATION / "Rx" SECTION:
   - Identify each prescribed drug or pharmaceutical product written by the physician.
   - Ignore hospital/clinic headers, doctor degrees, registration numbers, patient personal info (Name, Age, Gender), vitals (BP, Pulse, Temp), and lab test names.

2. EXTRACT MEDICINE ATTRIBUTES:
   For each prescribed medication, accurately determine:
   - "name": Clean brand name or active generic name ONLY (e.g., "Panadol", "Fradal-P", "Augmentin", "Brufen", "Disprin", "Grivak", "Caldree D", "Osia", "Risek", "Ponstan", "Calpol", "Flagyl"). Strip dosage form prefixes like "Tab", "Cap", "Syp", "Inj", "Susp".
   - "strength": Dosage strength with unit (e.g., "500mg", "625mg", "20mg", "40mg", "1g", "250mg/5ml"). If omitted or illegible, return "".
   - "form": Standardized form ("Tablet", "Capsule", "Syrup", "Suspension", "Inhaler", "Injection", "Drops", "Ointment", "Cream"). Default "Tablet".
   - "frequency": Clinical frequency ("OD" [once daily], "BD" [twice daily], "TDS" [3 times daily], "QDS" [4 times daily], "HS" [bedtime], "SOS" / "PRN" [as needed], "stat" [immediately]).
   - "instructions": Clear administration directions. Interpret Pakistani shorthand and Urdu notes:
     * "1+1" or "1-0-1" -> "1 tablet twice daily (morning & night)"
     * "1+1+1" or "1-1-1" -> "1 tablet 3 times daily (TDS)"
     * "1+0+0" or "روزانہ 1" -> "1 tablet once daily in the morning"
     * "0+0+1" -> "1 tablet at bedtime (HS)"
     * "نہار منہ" or "ناشتے سے پہلے" or "ac" -> "before breakfast / on an empty stomach"
     * "کھانے کے بعد" or "pc" -> "after meals"
     * "ضرورت پڑنے پر" or "SOS" -> "as needed for symptoms"
   - "clinical_purpose": Concise medical indication or drug class (e.g. "Pain relief & fever (Analgesic)", "Antibiotic for bacterial infection", "Gastric protection / Acid reduction (PPI)", "Calcium & Vitamin D supplement", "Joint health / Osteoarthritis support").
   - "raw_line": Exact handwritten line seen on paper.
   - "confidence": Float between 0.70 and 0.98 representing legibility.

3. OVERALL CLINICAL SUMMARY:
   Provide an overarching, empathetic "clinical_summary" explaining what condition the prescription appears to treat, how the prescribed medicines work together, general timing advice, and standard precautions.

### OUTPUT JSON SCHEMA:
Return ONLY a valid JSON object matching this schema:
{
  "clinical_summary": "Doctor's prescription for joint and pain management containing 4 medications. Take Osia before breakfast; take Fradal-P after meals for pain relief.",
  "candidates": [
    {
      "name": "Fradal-P",
      "strength": "",
      "form": "Tablet",
      "frequency": "BD",
      "instructions": "1 tablet twice daily after meals for 10 days",
      "clinical_purpose": "Pain relief (Analgesic)",
      "raw_line": "tab. Fradal-P 1+1",
      "confidence": 0.95
    }
  ]
}
"""

EXTRACTION_PROMPT = CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT


def detect_dosage_form(name: str, form_from_llm: str = "", instructions: str = "") -> str:
    """Accurately determine dosage form from doctor ink, LLM output, and directions."""
    combined = f"{name} {form_from_llm} {instructions}".lower()

    if re.search(r"\b(?:inj(?:ection)?|amp(?:oule)?|vial|i\.?v\.?|i\.?m\.?|infusion|drip)\b", combined):
        return "Injection"
    if re.search(r"\b(?:inh(?:aler)?|rotacap|puffs?|respules?|aerosol|inhalation)\b", combined):
        return "Inhaler"
    if re.search(r"\b(?:drops?|eye\s*drops?|ear\s*drops?|gtts?|nasal\s*spray)\b", combined):
        return "Drops"
    if re.search(r"\b(?:cap(?:sule)?s?)\b", combined):
        return "Capsule"
    if re.search(r"\b(?:syp|syrup|susp(?:ension)?|solution|elixir|liquid)\b", combined):
        return "Syrup"
    if re.search(r"\b(?:ointment|cream|gel|lotion)\b", combined):
        return "Cream"
    if re.search(r"\b(?:tab(?:let)?s?)\b", combined):
        return "Tablet"

    if form_from_llm:
        clean = form_from_llm.strip().capitalize()
        if clean in ("Injection", "Capsule", "Tablet", "Syrup", "Suspension", "Inhaler", "Drops", "Cream", "Ointment"):
            return clean

    return "Tablet"


async def extract_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Extract medicine candidates from a prescription image using Gemini Vision with automatic model fallback."""
    # Deterministic Cache: If exact same prescription image is scanned again, return identical result instantly
    image_hash = hashlib.sha256(image_bytes).hexdigest()
    if image_hash in _PRESCRIPTION_OCR_CACHE:
        logger.info(f"Returning deterministic cached OCR result for image SHA256: {image_hash[:12]}...")
        return copy.deepcopy(_PRESCRIPTION_OCR_CACHE[image_hash])

    # 1. Local computer vision preprocessing (orientation, contrast, shadow removal, ink sharpening)
    processed_bytes, effective_mime = preprocess_prescription_image(image_bytes, mime_type)

    genai.configure(api_key=settings.gemini_api_key)

    model_candidates = [
        "models/gemini-3.5-flash",
        "models/gemini-3.5-flash-lite",
        "models/gemini-3.1-flash-lite",
        "models/gemini-flash-lite-latest",
        settings.gemini_chat_model,
    ]
    models_to_try = list(dict.fromkeys([m for m in model_candidates if m]))

    image_part = {
        "mime_type": effective_mime,
        "data": base64.b64encode(processed_bytes).decode("utf-8"),
    }

    generation_config = genai.GenerationConfig(
        temperature=0.1,
        response_mime_type="application/json",
    )

    last_error = None
    response = None

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content([CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT, image_part], generation_config=generation_config)
            if response:
                break
        except Exception as err:
            logger.warning(f"OCR model '{model_name}' failed: {err}. Trying next fallback...")
            last_error = err

    if response is None:
        if last_error:
            logger.error(f"All OCR models failed. Last error: {last_error}")
            raise last_error
        return {
            "candidates": [],
            "raw_text": "No response received from OCR service.",
            "clinical_summary": None,
        }

    try:
        raw_text = ""
        try:
            if response and hasattr(response, "text") and response.text:
                raw_text = str(response.text).strip()
        except Exception as text_err:
            logger.warning(f"Failed to read response.text: {text_err}")
            try:
                if response and response.candidates and response.candidates[0].content.parts:
                    raw_text = "".join(
                        part.text for part in response.candidates[0].content.parts if hasattr(part, "text")
                    ).strip()
            except Exception:
                pass

        if not raw_text:
            return {
                "candidates": [],
                "raw_text": "No text could be extracted from the image.",
                "clinical_summary": None,
            }

        # Remove markdown code fences if present
        if "```" in raw_text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
            if match:
                raw_text = match.group(1).strip()
            else:
                raw_text = raw_text.replace("```json", "").replace("```", "").strip()

        candidates = []
        clinical_summary = ""
        try:
            extracted = json.loads(raw_text)
            if isinstance(extracted, dict):
                clinical_summary = str(extracted.get("clinical_summary") or extracted.get("summary") or "").strip()
                for key in ["candidates", "medicines", "drugs", "items", "prescriptions", "extracted_medicines"]:
                    if isinstance(extracted.get(key), list):
                        extracted = extracted[key]
                        break
                else:
                    extracted = [extracted]
            elif isinstance(extracted, list):
                clinical_summary = ""

            extracted_names = []
            if isinstance(extracted, list):
                for item in extracted:
                    if isinstance(item, dict):
                        name = str(item.get("name") or item.get("prescription_name") or item.get("medicine_name") or "").strip()
                        strength = str(item.get("strength") or "").strip()
                        form = str(item.get("form") or "").strip()
                        frequency = str(item.get("frequency") or "").strip()
                        instructions = str(
                            item.get("instructions") or item.get("directions") or item.get("dosage_instruction") or item.get("dosage") or ""
                        ).strip()
                        clinical_purpose = str(
                            item.get("clinical_purpose") or item.get("purpose") or item.get("use") or item.get("indication") or ""
                        ).strip()
                        raw_line = str(item.get("raw_line") or name).strip()
                        conf = float(item.get("confidence") or 0.88)
                    elif isinstance(item, str):
                        name = item.strip()
                        strength = ""
                        form = ""
                        frequency = ""
                        instructions = ""
                        clinical_purpose = ""
                        raw_line = item.strip()
                        conf = 0.80
                    else:
                        continue

                    if not name or name.lower() in ("illegible", "unknown", "unclear"):
                        continue

                    # Post-process, correct typos, normalize, and score
                    candidate_dict = correct_and_normalize_candidate(
                        name=name,
                        strength=strength,
                        form=form,
                        frequency=frequency,
                        instructions=instructions,
                        confidence=conf,
                        raw_line=raw_line,
                        clinical_purpose=clinical_purpose,
                    )

                    candidates.append(candidate_dict)
                    extracted_names.append(candidate_dict["raw_text"])

            clean_display_text = ", ".join(extracted_names) if extracted_names else raw_text
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse OCR JSON, using raw text: {raw_text[:200]}")
            clean_display_text = raw_text
            if raw_text:
                candidate_dict = correct_and_normalize_candidate(
                    name=raw_text,
                    confidence=0.4,
                    raw_line=raw_text,
                )
                candidates.append(candidate_dict)

        final_result = {
            "candidates": candidates,
            "raw_text": clean_display_text,
            "clinical_summary": clinical_summary or None,
        }
        _cache_put(image_hash, final_result)
        return final_result
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        raise
