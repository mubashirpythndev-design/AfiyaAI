"""Explicit, billable local model comparison on a consented prescription.

No expected medicine names are supplied to models. Reports readings/latency,
not accuracy: a pharmacist-labelled reference set is required for that claim.
Run from apps/api so its existing .env is loaded; never prints credentials.
"""
import argparse
import asyncio
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from app.services.ocr_provider import generate_ocr_response
from app.services.ocr_parsing import parse_ocr_response
from app.services.ocr_images import inspect_image
from app.services.ocr_service import VERIFY_PROMPT, _response_text, extract_from_image
from app.config import settings


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--models", default="gemini-4-argon,gemini-3.1-pro-preview,gemini-3.8-flash")
    parser.add_argument("--runs", type=int, choices=[1, 2], default=1)
    parser.add_argument("--timeout", type=float, default=90, help="Per-call deadline for isolated model checks (1..90 seconds)")
    parser.add_argument("--pipeline", action="store_true", help="Run the configured production pipeline instead of isolated model calls")
    parser.add_argument("--allow-cache", action="store_true", help="Use normal interactive scan policy, including short result reuse, instead of forcing a fresh coverage scan")
    args = parser.parse_args()
    if not 1 <= args.timeout <= 90:
        parser.error("--timeout must be between 1 and 90 seconds")
    image = args.image.read_bytes()
    if len(image) > 10 * 1024 * 1024:
        parser.error("Image must be under 10 MB")
    inspect_image(image)
    mime = {".png":"image/png", ".webp":"image/webp"}.get(args.image.suffix.lower(), "image/jpeg")
    models = list(dict.fromkeys(m.strip() for m in args.models.split(",") if m.strip()))
    if len(models) > 3 or not models:
        parser.error("Choose between one and three model IDs")
    successes = 0
    for iteration in range(args.runs):
        for model in (["configured-pipeline"] if args.pipeline else models):
            start = time.monotonic()
            try:
                if args.pipeline:
                    result = await extract_from_image(image, mime, force_refresh=not args.allow_cache)
                else:
                    reply = await generate_ocr_response(model, image, mime, VERIFY_PROMPT, timeout_seconds=args.timeout)
                    result = parse_ocr_response(_response_text(reply))
                rows = [{k:c.get(k) for k in ("original_name", "raw_text", "detected_form", "detected_strength",
                                              "correction_suggestion", "alternative_reading", "confidence")}
                        for c in result["candidates"]]
                report = {"model":model, "run":iteration+1, "elapsed_seconds":round(time.monotonic()-start,2),
                          "medicine_line_count":result.get("medicine_line_count"), "candidates":rows,
                          "models_used":result.get("models_used"), "provider_attempts":result.get("provider_attempts"),
                          "review_required":result.get("review_required"), "coverage_status":result.get("coverage_status"),
                          "verification_performed":result.get("verification_performed"), "warnings":result.get("warnings")}
                successes += 1
            except Exception as exc:
                message = str(exc)
                if settings.gemini_api_key:
                    message = message.replace(settings.gemini_api_key, "[redacted]")
                report = {"model":model, "run":iteration+1, "elapsed_seconds":round(time.monotonic()-start,2),
                          "error_type":type(exc).__name__, "status_code":getattr(exc,"code",None),
                          "free_tier_quota": "free_tier" in message.lower(), "detail":message[:1200]}
            print(json.dumps(report, ensure_ascii=True), flush=True)
    if not successes:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
