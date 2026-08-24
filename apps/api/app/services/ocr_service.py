"""OCR service using Gemini Vision to extract medicine names from prescription images."""

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
    """Extract medicine candidates from a prescription image using Gemini Vision."""
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_chat_model)

    try:
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_bytes).decode("utf-8"),
        }
        response = model.generate_content([EXTRACTION_PROMPT, image_part])

        raw_text = response.text.strip()
        # Remove markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        candidates = []
        try:
            extracted = json.loads(raw_text)
            for item in extracted:
                name = item.get("name", "")
                strength = item.get("strength", "")
                form = item.get("form", "")
                raw = f"{name} {strength} {form}".strip()
                confidence = 0.8 if name else 0.3
                candidates.append({
                    "raw_text": raw,
                    "confidence": confidence,
                    "is_verified": False,
                    "matched_medicine": None,
                })
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract names from raw text
            logger.warning(f"Failed to parse OCR JSON, using raw text: {raw_text[:200]}")
            if raw_text:
                candidates.append({
                    "raw_text": raw_text,
                    "confidence": 0.4,
                    "is_verified": False,
                    "matched_medicine": None,
                })

        return {
            "candidates": candidates,
            "raw_text": raw_text,
        }
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        raise
