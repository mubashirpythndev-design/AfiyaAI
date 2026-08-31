"""Afiya AI — Prescription OCR & Vision Extraction Service.
Author / Developer: Mubashir (Lead Developer)
"""

import base64
import json
import logging
import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are a prescription OCR assistant. Carefully read this prescription image and extract all medicine names, strengths, and dosage forms you can identify.

Return your response as a JSON array with this exact format:
[
  {"name": "medicine name as written", "strength": "e.g. 500mg", "form": "e.g. Tablet, Capsule, Syrup, Injection, Cream, Inhaler"},
]

Rules:
- Only extract medicine/drug names that you can clearly identify
- Include the strength (e.g., 500mg, 10mg) if visible
- Include the dosage form if visible
- If you cannot read something clearly, still include it but mark it as uncertain
- Do NOT invent medicine names
- Do NOT include patient information, doctor names, or dates
- Return ONLY the JSON array, no other text
"""


async def extract_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Extract medicine candidates from a prescription image using Gemini Vision with automatic model fallback."""
    genai.configure(api_key=settings.gemini_api_key)
    
    # Priority cascade of models for high quota and reliability
    model_candidates = [
        settings.gemini_chat_model,
        "models/gemini-3.5-flash-lite",
        "models/gemini-3.1-flash-lite",
        "models/gemini-flash-lite-latest",
        "models/gemini-3.6-flash",
    ]
    # Remove duplicates while preserving order
    models_to_try = list(dict.fromkeys(model_candidates))

    image_part = {
        "mime_type": mime_type,
        "data": base64.b64encode(image_bytes).decode("utf-8"),
    }

    last_error = None
    response = None

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content([EXTRACTION_PROMPT, image_part])
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
        if raw_text.startswith("```"):
            parts = raw_text.split("```")
            if len(parts) > 1:
                raw_text = parts[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        candidates = []
        try:
            extracted = json.loads(raw_text)
            if isinstance(extracted, dict):
                for key in ["medicines", "drugs", "candidates", "items", "prescriptions"]:
                    if isinstance(extracted.get(key), list):
                        extracted = extracted[key]
                        break
                else:
                    extracted = [extracted]

            extracted_names = []
            if isinstance(extracted, list):
                for item in extracted:
                    if isinstance(item, dict):
                        name = str(item.get("name") or "").strip()
                        strength = str(item.get("strength") or "").strip()
                        form = str(item.get("form") or "").strip()
                    elif isinstance(item, str):
                        name = item.strip()
                        strength = ""
                        form = ""
                    else:
                        continue

                    parts = [p for p in [name, strength, form] if p]
                    raw = " ".join(parts).strip()
                    if raw:
                        extracted_names.append(raw)
                    confidence = 0.85 if name else 0.3
                    candidates.append({
                        "raw_text": raw or name,
                        "confidence": confidence,
                        "is_verified": False,
                        "matched_medicine": None,
                    })

            clean_display_text = ", ".join(extracted_names) if extracted_names else raw_text
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract names from raw text
            logger.warning(f"Failed to parse OCR JSON, using raw text: {raw_text[:200]}")
            clean_display_text = raw_text
            if raw_text:
                candidates.append({
                    "raw_text": raw_text,
                    "confidence": 0.4,
                    "is_verified": False,
                    "matched_medicine": None,
                })

        return {
            "candidates": candidates,
            "raw_text": clean_display_text,
        }
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        raise

