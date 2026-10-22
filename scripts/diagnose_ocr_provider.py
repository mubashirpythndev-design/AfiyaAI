"""Bounded, explicit provider diagnosis; no application settings are changed.

Run from apps/api. Makes one metadata call and up to three generation calls.
Stops if the tiny text or simple image baseline fails, avoiding blind retries.
Only the supplied image is uploaded; credentials/provider payloads are not logged.
"""
import argparse
import asyncio
import json
import io
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
from app.config import settings
from app.services.image_preprocessor import preprocess_prescription_image
from app.services.ocr_images import inspect_image
from app.services.ocr_errors import classify_ocr_error
from app.services.ocr_provider import ocr_generation_config
from app.services.ocr_service import CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT

SIMPLE_IMAGE_PROMPT = (
    'Transcribe all medication product names and written forms in every column of this image. '
    'Read the visible letters without completing unfamiliar brands from memory. '
    'Do not add clinical advice. Retain unreadable lines with name="". '
    'Return only JSON: {"items":[{"name":"...","form":"...","raw_line":"..."}]}.'
)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, nargs="?")
    parser.add_argument("--list-models", action="store_true", help="List Gemini text-generation model metadata without uploading an image or generating content")
    parser.add_argument("--full", action="store_true", help="Compare the full production prompt only after both baselines succeed")
    parser.add_argument("--synthetic-only", action="store_true", help="Read a tiny printed test image instead of uploading the prescription")
    args = parser.parse_args()
    if args.list_models:
        options = types.HttpOptions(timeout=10000,retry_options=types.HttpRetryOptions(attempts=1))
        async with genai.Client(api_key=settings.gemini_api_key,http_options=options).aio as client:
            async def inventory() -> list[str]:
                pager = await client.models.list(config={"page_size":1000})
                names = []
                async for model in pager:
                    if (model.name and model.name.startswith("models/gemini-")
                            and "generateContent" in (model.supported_actions or [])
                            and not any(word in model.name for word in ("tts","live","audio","image","embedding"))):
                        names.append(model.name)
                return names
            try:
                names = await asyncio.wait_for(inventory(),15)
            except Exception as exc:
                failure = classify_ocr_error(exc)
                print(json.dumps({"metadata_only":True,"error_type":type(exc).__name__,
                    "status":failure.status,"category":failure.category}),flush=True)
                raise SystemExit(1) from None
            print(json.dumps({"metadata_only":True,"models":sorted(names),
                "note":"Listing does not establish free quota or generation access."}),flush=True)
        return
    if args.image is None:
        parser.error("image is required unless --list-models is used")
    data = args.image.read_bytes()
    if len(data) > 10 * 1024 * 1024:
        parser.error("Image must be under 10 MB")
    inspect_image(data)
    mime = {".png":"image/png", ".webp":"image/webp"}.get(args.image.suffix.lower(), "image/jpeg")
    image, mime = preprocess_prescription_image(data, mime)
    model = settings.gemini_ocr_model.removeprefix("models/")
    print(json.dumps({"model":model, "thinking":settings.ocr_thinking_level, "settings_changed":False}), flush=True)

    async def stage(label: str, call, timeout: float) -> object | None:
        started = time.monotonic()
        try:
            result = await asyncio.wait_for(call(), timeout=timeout)
            report = {"stage":label, "elapsed_seconds":round(time.monotonic()-started,2), "transport_success":True}
            if label == "model_metadata":
                report["returned_model"] = result.name
            else:
                text = result.text or ""
                try:
                    payload = json.loads(text)
                except (TypeError, ValueError):
                    payload = None
                report["valid_json"] = isinstance(payload,dict)
                if isinstance(payload,dict):
                    rows = payload.get("items",payload.get("candidates"))
                    report["candidate_count"] = len(rows) if isinstance(rows,list) else None
                    if label == "tiny_text": report["expected_response"] = payload.get("ok") is True
                    if label == "synthetic_image": report["expected_response"] = " ".join(str(payload.get("text","")).split()).upper() == "TEST 123"
                report["finish_reason"] = str(result.candidates[0].finish_reason) if result.candidates else None
            print(json.dumps(report), flush=True)
            return result
        except Exception as exc:
            failure = classify_ocr_error(exc)
            print(json.dumps({"stage":label, "elapsed_seconds":round(time.monotonic()-started,2),
                "transport_success":False, "error_type":type(exc).__name__,
                "status":failure.status, "category":failure.category}), flush=True)
            return None

    options = types.HttpOptions(timeout=40000, retry_options=types.HttpRetryOptions(attempts=1))
    async with genai.Client(api_key=settings.gemini_api_key, http_options=options).aio as client:
        metadata = await stage("model_metadata",lambda:client.models.get(model=model),10)
        if metadata is None:
            raise SystemExit(1)
        def generate(contents: list):
            return client.models.generate_content(model=model,contents=contents,config=ocr_generation_config())
        if args.synthetic_only:
            probe = Image.new("RGB",(400,120),"white")
            ImageDraw.Draw(probe).text((20,30),"TEST 123",fill="black",font_size=40)
            buffer = io.BytesIO(); probe.save(buffer,"PNG")
            reply = await stage("synthetic_image",lambda:generate([
                'Transcribe the printed text. Return only JSON {"text":"..."}.',
                types.Part.from_bytes(data=buffer.getvalue(),mime_type="image/png")]),15)
            if reply is None: raise SystemExit(1)
            return
        tiny = await stage("tiny_text",lambda:generate(['Return only the JSON object {"ok":true}.']),15)
        if tiny is None:
            raise SystemExit(1)
        part = types.Part.from_bytes(data=image,mime_type=mime)
        simple = await stage("simple_image",lambda:generate([SIMPLE_IMAGE_PROMPT,part]),30)
        if simple is None:
            raise SystemExit(1)
        if args.full:
            full = await stage("production_prompt",lambda:generate([CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT,part]),40)
            if full is None:
                raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
