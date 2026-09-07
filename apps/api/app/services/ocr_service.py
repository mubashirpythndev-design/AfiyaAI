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

CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT = """You are an expert Clinical Pharmacist and Medical Prescription OCR Specialist.
Carefully inspect this doctor's prescription image (which may contain messy cursive handwriting, hospital headers, patient vitals, clinical abbreviations, and doctor stamps).

### CLINICAL INSTRUCTIONS & RULES:
1. FOCUS STRICTLY ON THE MEDICATION / "Rx" SECTION:
   - Identify each prescribed drug / medicine item written by the physician.
   - Ignore clinic/hospital headers, doctor names, degrees (MBBS, FCPS, MD), PMDC/PMC registration numbers, and clinic addresses.
   - Ignore patient personal information (Name, Age, Gender, Date).
   - Ignore patient physical vitals (e.g., BP: 120/80, Pulse: 72, Temp: 98.6F, Wt: 65kg, SpO2: 98%).
   - Ignore diagnosis / chief complaint notes (e.g., "Acute URTI", "GERD", "Hypertension", "T2DM", "Fever").
   - Ignore laboratory test orders (e.g., "CBC", "Urine R/E", "LFTs", "Serum Creatinine", "Chest X-Ray", "Ultrasound").

2. MEDICATION EXTRACTION & DECOMPOSITION:
   For every prescribed medication, extract:
   - "name": Clean brand name OR active generic name ONLY (e.g., "Fradal-P", "Grivak", "Caldree D", "Osia", "Panadol", "Augmentin", "Risek", "Brufen", "Rocephin", "Toradol"). Strip dosage form prefixes like "Tab", "Cap", "Syp", "Susp", "Inj", "Inh", "Drops".
   - "strength": The dosage strength with unit (e.g., "500mg", "625mg", "20mg", "1g", "30mg", "120ml"). If not specified or illegible, return "".
   - "form": Standardized dosage form ("Tablet", "Capsule", "Syrup", "Suspension", "Inhaler", "Injection", "Drops", "Ointment", "Cream"). If not specified, infer from context or return "Tablet".
   - "frequency": Common clinical frequency abbreviation if written ("OD" [once daily], "BD" or "BID" [twice daily], "TDS" or "TID" [3 times daily], "QDS" [4 times daily], "HS" [bedtime], "SOS" or "PRN" [as needed], "stat" [immediately]).
   - "instructions": Full patient administration directions (e.g., "1 tablet twice daily (BD)", "1 tablet once daily (OD)", "1 capsule once daily (OD)"). Understand Pakistani/Latin shorthand and Urdu notes ("1+1" means BD / twice daily, "روزانہ 1" means OD / once daily).
   - "raw_line": The exact text or handwritten words as seen on the prescription line.
   - "confidence": Float between 0.60 and 0.95 representing how clearly and legibly the medicine name was written.

3. OPTICAL ERROR & CURSIVE TOLERANCE:
   - Account for common cursive handwriting ambiguities: "P" vs "F", "u" vs "n", "m" vs "w", "R" vs "B", "1" vs "l", "5" vs "S", "Gr" vs "Qw".
   - If a word is partially obscured or very messy, provide your best clinical reading and reflect it in the confidence score.
   - Do NOT invent or hallucinate drugs that are not on the paper.

### OUTPUT FORMAT:
Return ONLY a valid JSON array of objects. NO markdown formatting outside the JSON, NO conversational text.
[
  {
    "name": "Fradal-P",
    "strength": "",
    "form": "Tablet",
    "frequency": "BD",
    "instructions": "1 tablet twice daily 2 times daily (BD)",
    "raw_line": "1 - Tab. Fradal - P 1+1",
    "confidence": 0.65
  }
]
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
        settings.gemini_chat_model,
        "models/gemini-3.6-flash",
        "models/gemini-3.7-flash",
        "models/gemini-3.1-flash-lite",
    ]
    models_to_try = list(dict.fromkeys(model_candidates))

    image_part = {
        "mime_type": effective_mime,
        "data": base64.b64encode(processed_bytes).decode("utf-8"),
    }

    generation_config = genai.GenerationConfig(
        temperature=0.0,
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
            }

        # Remove markdown code fences if present
        if "```" in raw_text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
            if match:
                raw_text = match.group(1).strip()
            else:
                raw_text = raw_text.replace("```json", "").replace("```", "").strip()

        candidates = []
        try:
            extracted = json.loads(raw_text)
            if isinstance(extracted, dict):
                for key in ["medicines", "drugs", "candidates", "items", "prescriptions", "extracted_medicines"]:
                    if isinstance(extracted.get(key), list):
                        extracted = extracted[key]
                        break
                else:
                    extracted = [extracted]

            extracted_names = []
            if isinstance(extracted, list):
                for item in extracted:
                    if isinstance(item, dict):
                        name = str(item.get("name") or item.get("prescription_name") or "").strip()
                        strength = str(item.get("strength") or "").strip()
                        form = str(item.get("form") or "").strip()
                        frequency = str(item.get("frequency") or "").strip()
                        instructions = str(
                            item.get("instructions") or item.get("directions") or item.get("dosage_instruction") or ""
                        ).strip()
                        raw_line = str(item.get("raw_line") or name).strip()
                        conf = float(item.get("confidence") or 0.85)
                    elif isinstance(item, str):
                        name = item.strip()
                        strength = ""
                        form = ""
                        frequency = ""
                        instructions = ""
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
        }
        _cache_put(image_hash, final_result)
        return final_result
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        raise
