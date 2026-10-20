"""Image OCR transport using the supported Gemini SDK, isolated from chat."""
import asyncio
from google import genai
from google.genai import types
import httpx
from app.config import settings
from app.services.ocr_models import MIN_OCR_REQUEST_TIMEOUT_SECONDS


def ocr_generation_config(model_name: str = "") -> types.GenerateContentConfig:
    # Preserve provider sampling defaults for document extraction.
    return types.GenerateContentConfig(
        response_mime_type="application/json",
        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
        thinking_config=types.ThinkingConfig(thinking_level=settings.ocr_thinking_level),
        max_output_tokens=32768,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


async def generate_ocr_response(model_name: str, image: bytes, mime: str, prompt: str,
                                *, timeout_seconds: float) -> types.GenerateContentResponse:
    options = types.HttpOptions(timeout=int(max(MIN_OCR_REQUEST_TIMEOUT_SECONDS, timeout_seconds) * 1000),
                                retry_options=types.HttpRetryOptions(attempts=1))
    # The service owns retries, deadlines and concurrency; no hidden SDK retry loop.
    async with genai.Client(api_key=settings.gemini_api_key, http_options=options).aio as client:
        try:
            return await client.models.generate_content(
                model=model_name.removeprefix("models/"),
                contents=[prompt, types.Part.from_bytes(data=image, mime_type=mime)],
                config=ocr_generation_config(model_name),
            )
        except httpx.TimeoutException as exc:
            raise asyncio.TimeoutError("OCR provider deadline exceeded") from exc
