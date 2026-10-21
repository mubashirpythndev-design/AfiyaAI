"""Afiya AI — Clinical Prescription OCR & Vision Extraction Service.
Combines local image preprocessing, clinical domain-specific multimodal vision prompts,
and reviewable pharmaceutical lexicon suggestions.
Author / Developer: Mubashir (Lead Developer)
"""

import asyncio
import copy
import hashlib
import json
import logging
from pathlib import Path
import re
import time
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from app.services.ai_runtime import bounded_call, available, record_failure
from app.services.ocr_parsing import parse_ocr_response, merge_candidates, OCRFormatError
from app.services.ocr_images import inspect_image, crop_region, valid_box

from app.config import settings
from app.services.image_preprocessor import preprocess_prescription_image
from app.services.pharmaceutical_corrector import prescription_form
from app.services.ocr_provider import generate_ocr_response
from app.services.ocr_errors import classify_ocr_error, OCRQuotaCooldownError, OCRServiceBusy
from app.services.ocr_models import OCR_MODEL_CHAIN, MIN_OCR_REQUEST_TIMEOUT_SECONDS
from app.services.local_rx_parser import _parse_rx_lines_to_medicines, join_text_fragments

logger = logging.getLogger(__name__)

_RAPID_OCR: Any = None
_RAPID_OCR_LOCK = threading.Lock()
LOCAL_OCR_BUDGET_SECONDS = 1.5
_LOCAL_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="prescription-ocr")
_LOCAL_JOB_LOCK = threading.Lock()
_LOCAL_JOB: Any = None


async def _run_local_stage(image_bytes: bytes, mime_type: str, region: list[int] | None, force_refresh: bool) -> dict:
    """Bound user waiting without pretending that Python can cancel native ONNX work.

    Keep at most one native job, coalesce identical uploads, and reuse its actual
    text for five minutes. DB identities/prices are resolved afresh per request.
    """
    global _LOCAL_JOB
    started = time.monotonic()
    key = hashlib.sha256(image_bytes + json.dumps([mime_type, region]).encode()).hexdigest()
    with _LOCAL_JOB_LOCK:
        job = _LOCAL_JOB
        if job and not job[1].done() and job[0] != key:
            return {"lines": [], "local_elapsed_ms": 0.0, "local_budget_exhausted": True}
        if not job or job[0] != key or (job[1].done() and (force_refresh or job[1].exception() is not None or time.monotonic()-job[2] > 300)):
            job = (key, _LOCAL_EXECUTOR.submit(_read_local_lines, image_bytes, mime_type, region), time.monotonic())
            _LOCAL_JOB = job
    wrapped = asyncio.wrap_future(job[1])
    # A timed-out/disconnected request must not produce an unhandled future error
    # if the bounded background job later fails.
    wrapped.add_done_callback(lambda future: future.exception() if not future.cancelled() else None)
    try:
        return copy.deepcopy(await asyncio.wait_for(asyncio.shield(wrapped), LOCAL_OCR_BUDGET_SECONDS))
    except asyncio.TimeoutError:
        logger.warning("Local OCR exceeded %.1fs fast-scan window; pharmacist handoff available", LOCAL_OCR_BUDGET_SECONDS)
        return {"lines": [], "local_elapsed_ms": round((time.monotonic()-started)*1000, 1),
                "local_budget_exhausted": True}


def _read_local_lines(image_bytes: bytes, mime_type: str, region: list[int] | None = None) -> dict:
    """Run packaged PP-OCRv4 CPU weights off the event loop, without network access."""
    global _RAPID_OCR
    from app.services.ocr_images import open_prescription
    started = time.monotonic()
    original = open_prescription(image_bytes)
    original_size = original.size
    original.close()
    working = crop_region(image_bytes, region) if region else image_bytes
    processed, _ = preprocess_prescription_image(working, mime_type)
    with open_prescription(processed) as image:
        width, height = image.size
    # RapidOCR instances mutate detection settings during inference. Serialize both
    # lazy initialization and calls; cancellation cannot interrupt native ONNX work.
    with _RAPID_OCR_LOCK:
        if _RAPID_OCR is None:
            from rapidocr_onnxruntime import RapidOCR
            _RAPID_OCR = RapidOCR(intra_op_num_threads=4, inter_op_num_threads=1,
                                 det_limit_side_len=736, det_limit_type="max", max_side_len=1600)
        rows, _ = _RAPID_OCR(processed)
    lines = join_text_fragments(rows or [], width, height)
    if region:
        from app.services.ocr_images import map_box
        for line in lines:
            line["bbox"] = map_box(line["bbox"], region)
    return {"lines": lines, "image_width": original_size[0], "image_height": original_size[1],
            "local_elapsed_ms": round((time.monotonic()-started)*1000, 1)}


async def _resolve_local_candidates(candidates: list[dict], db: Any) -> None:
    """Attach stored identities/prices without changing the original transcription."""
    from sqlalchemy import select
    from app.db.database import MrpReference, StoreInventory
    from app.services.matching_service import match_medicine
    resolved = {}
    for candidate in candidates:
        query = " ".join(str(value) for value in (candidate["original_name"], candidate.get("detected_strength"),
                                                   candidate.get("detected_form")) if value)
        match = await match_medicine(query, db)
        medicine = match.get("medicine")
        choices = ([medicine] if medicine else []) + list(match.get("alternatives", []))
        candidate["match_candidates"] = [m.model_dump() if hasattr(m, "model_dump") else m for m in choices]
        candidate["match_confidence"] = match.get("confidence", 0)
        candidate["strength_assessment"] = match.get("strength_assessment")
        candidate["form_assessment"] = match.get("form_assessment")
        # A catalog match is not proof of handwriting accuracy or complete coverage.
        if medicine and not match.get("needs_confirmation") and match.get("confidence", 0) >= .85 and candidate["confidence"] >= .75:
            payload = medicine.model_dump() if hasattr(medicine, "model_dump") else medicine
            candidate["matched_medicine"] = payload
            candidate["detected_generic"] = payload["generic_name"]
            resolved.setdefault(payload["id"], []).append(candidate)
    if resolved:
        mrps = (await db.execute(select(MrpReference).where(MrpReference.medicine_id.in_(resolved))
                                .order_by(MrpReference.effective_date.desc(), MrpReference.created_at.desc()))).scalars().all()
        seen = set()
        for row in mrps:
            if row.medicine_id in seen:
                continue
            seen.add(row.medicine_id)
            for candidate in resolved[row.medicine_id]:
                candidate.update(notified_mrp=row.notified_mrp, pack_size=row.pack_size)
        inventory = (await db.execute(select(StoreInventory).where(StoreInventory.medicine_id.in_(resolved)))).scalars().all()
        for row in inventory:
            for candidate in resolved[row.medicine_id]:
                candidate["stock_quantity"] = row.stock_quantity


async def extract_from_image(image_bytes: bytes, mime_type: str = "image/jpeg", *, force_refresh: bool = False,
                             scan_mode: str = "auto", region: list[int] | None = None, db: Any = None) -> dict:
    """Local CPU first, configured cloud second, then a successful concierge handoff."""
    if scan_mode not in {"auto", "thorough", "fast"} or (region is not None and valid_box(region) is None):
        raise ValueError("Invalid scan mode or crop region")
    local = {"lines": [], "local_elapsed_ms": 0.0}
    try:
        local = await _run_local_stage(image_bytes, mime_type, region, force_refresh)
    except Exception as exc:
        logger.warning("Local OCR unavailable: error=%s", type(exc).__name__)
    names: list[str] = []
    if db is not None and local["lines"]:
        try:
            from sqlalchemy import select
            from app.db.database import Medicine
            medicines = (await db.execute(select(Medicine))).scalars().all()
            names = [name for med in medicines for name in (med.brand_name, med.generic_name, *(med.aliases or [])) if name]
        except Exception as exc:
            logger.warning("OCR catalog unavailable: error=%s", type(exc).__name__)
            db = None
    candidates = _parse_rx_lines_to_medicines(local["lines"], names)
    if candidates:
        result = _local_response(candidates, local)
        if db is not None:
            try:
                await _resolve_local_candidates(candidates, db)
            except Exception as exc:
                logger.warning("OCR catalog enrichment unavailable: error=%s", type(exc).__name__)
                result["warnings"].append("Catalog details could not be loaded. Review the transcribed medicines manually.")
        return result
    # Never add a long cloud timeout after the local fast-scan budget is exhausted.
    # Native work finishes in the single bounded worker and can serve a later retry.
    if not local.get("local_budget_exhausted") and settings.gemini_api_key.strip():
        try:
            cloud = await _extract_cloud_from_image(image_bytes, mime_type, force_refresh=force_refresh,
                                                     scan_mode=scan_mode, region=region)
            if any(not c.get("unreadable") for c in cloud.get("candidates", [])):
                return {**cloud, "engine": "gemini", "fallback_available": False,
                        "local_elapsed_ms": local["local_elapsed_ms"]}
        except Exception as exc:
            logger.warning("Cloud OCR exhausted: error=%s; pharmacist handoff available", type(exc).__name__)
    # Last resort only uses actual recognized text and exact database token overlap.
    partial = _parse_rx_lines_to_medicines(local["lines"], names, tokens_only=True)
    if partial:
        return _local_response(partial, local)
    return {**_local_response([], local), "error": "OCR_SERVICE_BUSY", "fallback_available": True,
            "message": "No readable medicine lines were confirmed. Send your prescription to the pharmacist for manual review.",
            "engine": "concierge", "models_used": []}


def _local_response(candidates: list[dict], local: dict) -> dict:
    return {"candidates": candidates, "raw_text": "\n".join(c["raw_line"] for c in candidates),
            "clinical_summary": None, "medicine_line_count": len(candidates),
            "coverage_status": "review_required", "verification_performed": False, "review_required": True,
            "warnings": ["Local OCR may miss handwritten lines. Compare every product, strength and form with the original image before confirming."],
            "image_width": local.get("image_width"), "image_height": local.get("image_height"),
            "models_used": ["PP-OCRv4"], "provider_attempts": 0, "engine": "rapidocr",
            "local_elapsed_ms": local["local_elapsed_ms"], "fallback_available": False}

# Persistent deterministic disk cache for extracted prescription results keyed by image SHA-256
MAX_OCR_CACHE_ENTRIES = 500
_DISK_CACHE_PATH = Path(settings.ocr_cache_path) if settings.ocr_cache_path else Path(__file__).resolve().parent.parent.parent / "data" / ".prescription_ocr_cache.sqlite3"


def _cache_connection():
    _DISK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DISK_CACHE_PATH, timeout=5)
    conn.execute("CREATE TABLE IF NOT EXISTS ocr_cache (image_hash TEXT PRIMARY KEY, result TEXT NOT NULL, inserted_at REAL NOT NULL)")
    return conn


def _load_disk_cache() -> dict[str, dict]:
    try:
        with _cache_connection() as conn:
            rows = conn.execute("SELECT image_hash, result FROM ocr_cache ORDER BY inserted_at DESC LIMIT ?", (MAX_OCR_CACHE_ENTRIES,)).fetchall()
        return {key: json.loads(value) for key, value in reversed(rows)}
    except Exception as err:
        logger.warning("OCR cache unavailable: %s", type(err).__name__)
        return {}


def _disk_cache_get(key: str) -> dict | None:
    try:
        with _cache_connection() as conn:
            row = conn.execute("SELECT result FROM ocr_cache WHERE image_hash = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else None
    except Exception:
        return None


def _save_disk_cache_entry(key: str, value: dict) -> None:
    try:
        with _cache_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO ocr_cache VALUES (?, ?, ?)", (key, json.dumps(value, ensure_ascii=False), time.time()))
            conn.execute("DELETE FROM ocr_cache WHERE image_hash NOT IN (SELECT image_hash FROM ocr_cache ORDER BY inserted_at DESC LIMIT ?)", (MAX_OCR_CACHE_ENTRIES,))
    except Exception as err:
        logger.warning("Could not save OCR cache: %s", type(err).__name__)


_PRESCRIPTION_OCR_CACHE: dict[str, dict] = _load_disk_cache()
_RECENT_OCR_RESULTS: dict[str, dict] = {}
_IN_FLIGHT: dict[str, dict] = {}

# In-memory circuit breaker to track models hitting 429 quota exhaustion.
# Skips exhausted models in 0.000s on subsequent scans until their cooldown expires.
_MODEL_COOLDOWNS: dict[str, float] = {}


def _cache_put(key: str, value: dict) -> None:
    """Store entry in memory and disk cache, evicting oldest item if size limit is reached."""
    if len(_PRESCRIPTION_OCR_CACHE) >= MAX_OCR_CACHE_ENTRIES:
        try:
            first_key = next(iter(_PRESCRIPTION_OCR_CACHE))
            _PRESCRIPTION_OCR_CACHE.pop(first_key, None)
        except StopIteration:
            pass
    _PRESCRIPTION_OCR_CACHE[key] = copy.deepcopy(value)
    _save_disk_cache_entry(key, value)


def clear_ocr_cache() -> None:
    """Clear in-memory and on-disk OCR cache and cooldowns (useful for testing or cache invalidation)."""
    _PRESCRIPTION_OCR_CACHE.clear()
    _RECENT_OCR_RESULTS.clear()
    _MODEL_COOLDOWNS.clear()
    try:
        with _cache_connection() as conn:
            conn.execute("DELETE FROM ocr_cache")
    except Exception as err:
        logger.warning(f"Could not delete OCR disk cache: {err}")

CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT = """You are an expert Clinical Pharmacist and Medical Prescription Vision Specialist.
Carefully inspect this doctor's prescription image (which may contain messy cursive handwriting, clinical shorthand, and bilingual Urdu/English directions).

### CLINICAL EXTRACTION INSTRUCTIONS:
1. INSPECT THE ENTIRE PAGE FOR MEDICATION LINES:
   - Include medicine entries in every column, left/right margins, and the bottom of the page.
   - Preserve every visible medicine line. If a medicine name is unreadable, return name="" and its raw_line/bbox; never silently omit it.
   - Count visible medicine lines including unreadable entries. Return medicine_line_count and coverage_complete.
   - For every candidate return line_id and bbox=[top,left,bottom,right], normalized to 0..1000 across this image.
   - Do not guess a medicine name to fill a missing line.
   - Identify each prescribed drug or pharmaceutical product, including topical lotions, bars, creams, shampoos, washes and other non-oral treatments. Non-tablet products count as medication lines too.
   - Ignore hospital/clinic headers, doctor degrees, registration numbers, patient personal info (Name, Age, Gender), vitals (BP, Pulse, Temp), and lab test names.

2. EXTRACT MEDICINE ATTRIBUTES:
   For each prescribed medication, accurately determine:
   - "name": Clean brand name or active generic name ONLY (e.g., "Panadol", "Fradal-P", "Augmentin", "Brufen", "Disprin", "Grivak", "Caldree D", "Osia", "Risek", "Ponstan", "Calpol", "Flagyl"). Strip dosage form prefixes like "Tab", "Cap", "Syp", "Inj", "Susp".
   - "strength": Dosage strength with unit (e.g., "500mg", "625mg", "20mg", "40mg", "1g", "250mg/5ml"). If omitted or illegible, return "".
   - "form": The form actually written ("Tablet", "Capsule", "Syrup", "Suspension", "Inhaler", "Injection", "Drops", "Ointment", "Cream", "Gel", "Lotion", "Bar", "Spray", "Shampoo", "Solution", "Wash", "Mouthwash", "Powder", "Patch", "Suppository", "Pessary", "Paste", "Foam", "Emulsion"). A soap/cleansing bar is "Bar", never "Tablet". If not written or unclear, return ""; never default to tablets or infer a form from a familiar brand.
   - Transcribe the visible brand letters before interpreting the product. Do not replace an unfamiliar brand with a more familiar similar-looking brand. Preserve spelling even when the product is absent from a medicine catalog. Do not expand or complete a partial name from memory.
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
   - "confidence": Float between 0.0 and 1.0 representing reported legibility, not a calibrated accuracy probability. Use 0 for unreadable names.

3. OVERALL CLINICAL SUMMARY:
   Provide an overarching, empathetic "clinical_summary" explaining what condition the prescription appears to treat, how the prescribed medicines work together, general timing advice, and standard precautions.

### OUTPUT JSON SCHEMA:
Return ONLY a valid JSON object matching this schema:
{
  "medicine_line_count": 1,
  "coverage_complete": true,
  "clinical_summary": "Doctor's prescription includes a pain medicine. Follow the doctor's written directions and precautions.",
  "candidates": [
    {
      "line_id": "line-1",
      "bbox": [200, 100, 280, 900],
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
    return prescription_form(name, instructions, form_from_llm)[0]

OCR_CACHE_VERSION = "stable-three-models-v8"
VERIFY_PROMPT = """Independently transcribe ALL medicine/product lines in this image, including margins, columns and the bottom. This is an image reading and coverage check, not clinical advice. Inspect the visible letters; do not substitute a familiar brand for an unfamiliar name, complete names from memory, or use clinical context to guess them. Include all prescribed medication products: oral medicines, topicals, lotions, soaps/cleansing bars, sprays, shampoos, solutions, washes, powders, patches, suppositories, pessaries, pastes, foams and emulsions. Return JSON with candidates (all visible medicine lines), medicine_line_count (including unreadable lines), coverage_complete, and no clinical summary. Each candidate has name, strength, form, raw_line, confidence (0..1 reported legibility), line_id and bbox [top,left,bottom,right] in 0..1000 coordinates. Names exclude form/strength. Form must follow the ink: Bar, Cream, Ointment, Gel, Lotion, Tablet, Capsule, Syrup, Suspension, Inhaler, Injection, Drops, Spray, Shampoo, Solution, Wash, Mouthwash, Powder, Patch, Suppository, Pessary, Paste, Foam or Emulsion; return "" if absent/unclear. Never default to Tablet. Retain unreadable lines with name="" and do not invent missing names. A valid JSON response alone does not prove completeness.
"""


def _needs_detail(candidate: dict) -> bool:
    name = re.sub(r"\W+", "", candidate.get("original_name") or "").casefold()
    line = re.sub(r"\W+", "", candidate.get("raw_line") or "").casefold()
    return bool(candidate.get("unreadable") or candidate.get("confidence", 0) < 0.8
                or candidate.get("correction_suggestion") or candidate.get("alternative_reading") or candidate.get("form_conflict")
                or not candidate.get("detected_form") or (name and line and name not in line))


def _response_text(response):
    try:
        reason = response.candidates[0].finish_reason
        if getattr(reason, "name", None) in {"MAX_TOKENS", "SAFETY", "RECITATION"}:
            raise OCRFormatError("OCR output was truncated or blocked; retry with another model.")
    except (AttributeError, IndexError, TypeError):
        pass
    try:
        return str(response.text).strip()
    except (AttributeError, ValueError):
        return "".join(p.text for p in response.candidates[0].content.parts if getattr(p,"text",None))


def _scan_key(image_bytes: bytes, mime_type: str, scan_mode: str, region: list[int] | None) -> str:
    fingerprint = json.dumps([OCR_CACHE_VERSION, CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT, VERIFY_PROMPT,
        OCR_MODEL_CHAIN, settings.ocr_thinking_level,
        settings.ocr_auto_verify_clear, mime_type, scan_mode, region], sort_keys=True).encode()
    return hashlib.sha256(image_bytes + fingerprint).hexdigest()


async def _extract_cloud_from_image(image_bytes: bytes, mime_type: str = "image/jpeg", *, force_refresh: bool = False,
                             scan_mode: str = "auto", region: list[int] | None = None) -> dict:
    """Coalesce identical concurrent uploads; keep intentional fresh scans fresh."""
    if force_refresh:
        return await _extract_from_image(image_bytes, mime_type, force_refresh=True, scan_mode=scan_mode, region=region)
    key = _scan_key(image_bytes, mime_type, scan_mode, region)
    entry = _IN_FLIGHT.get(key)
    if entry and (entry["task"].done() or entry["task"].cancelling()):
        # A remove/re-upload must not join the previous upload's cancellation.
        _IN_FLIGHT.pop(key, None)
        entry = None
    if entry is None:
        # Shared provider concurrency remains bounded even if this small dedupe
        # registry fills. Do not retain an unbounded number of image tasks.
        if len(_IN_FLIGHT) >= 32:
            return await _extract_from_image(image_bytes, mime_type, scan_mode=scan_mode, region=region)
        task = asyncio.create_task(_extract_from_image(image_bytes, mime_type, scan_mode=scan_mode, region=region))
        entry = {"task": task, "waiters": 0}
        _IN_FLIGHT[key] = entry
        def finished(done: asyncio.Task) -> None:
            if _IN_FLIGHT.get(key, {}).get("task") is done:
                _IN_FLIGHT.pop(key, None)
            if not done.cancelled():
                done.exception()  # Retrieve failures even if every caller left.
        task.add_done_callback(finished)
    entry["waiters"] += 1
    try:
        return copy.deepcopy(await asyncio.shield(entry["task"]))
    finally:
        entry["waiters"] -= 1
        if entry["waiters"] == 0 and not entry["task"].done():
            entry["task"].cancel()
            await asyncio.gather(entry["task"], return_exceptions=True)


async def _extract_from_image(image_bytes: bytes, mime_type: str = "image/jpeg", *, force_refresh: bool = False,
                             scan_mode: str = "auto", region: list[int] | None = None) -> dict:
    """Bounded extraction, coverage validation and targeted native-resolution retries."""
    if scan_mode not in {"auto", "thorough", "fast"}:
        raise ValueError("Invalid scan mode")
    if region is not None and valid_box(region) is None:
        raise ValueError("Invalid rescan region")
    model_candidates = list(OCR_MODEL_CHAIN)
    image_hash = _scan_key(image_bytes, mime_type, scan_mode, region)
    if not force_refresh:
        recent = _RECENT_OCR_RESULTS.get(image_hash)
        if recent and time.time() - recent.get("cached_at", 0) < 300:
            return copy.deepcopy(recent)
        cached = _PRESCRIPTION_OCR_CACHE.get(image_hash) or await asyncio.to_thread(_disk_cache_get,image_hash)
        if isinstance(cached, dict) and cached.get("cache_version") == OCR_CACHE_VERSION and time.time()-cached.get("cached_at",0) < 86400:
            return copy.deepcopy(cached)
    warnings = []
    try:
        image_info = await asyncio.to_thread(inspect_image,image_bytes)
        warnings.extend(image_info["warnings"])
    except Exception:
        image_info = {"width":None,"height":None,"warnings":[]}
    working_bytes = await asyncio.to_thread(crop_region,image_bytes,region) if region else image_bytes
    processed_bytes,effective_mime = await asyncio.to_thread(preprocess_prescription_image,working_bytes,mime_type)
    attempts = 0
    interactive = scan_mode != "thorough"
    total_budget = min(settings.ocr_total_timeout_seconds, settings.ocr_auto_timeout_seconds) if interactive else settings.ocr_total_timeout_seconds
    # Three 35-second processing windows plus scheduling headroom. Old environment
    # values must not silently restore the former short fallback deadlines.
    total_budget = max(total_budget, len(model_candidates) * MIN_OCR_REQUEST_TIMEOUT_SECONDS * 8 / 7)
    deadline = time.monotonic()+total_budget
    used_models = []
    blocked_models: dict[str, Exception] = {}

    async def read_image(data, mime, prompt, coordinate_region=None, *, review=False):
        nonlocal attempts
        last_error = None
        unavailable_in_read: dict[str, Exception] = {}
        # Initial extraction must be able to reach every ordered fallback.
        # Coverage/detail passes retain the existing four-call scan cap.
        limit = 4 if review else len(model_candidates)
        for index, model_name in enumerate(model_candidates):
            if model_name in blocked_models:
                last_error = blocked_models[model_name]
                continue
            if not available(model_name):
                last_error = OCRQuotaCooldownError("OCR provider quota cooldown")
                continue
            if attempts >= limit or time.monotonic() >= deadline: break
            attempt_started = time.monotonic()
            provider_timeout = None
            try:
                async def invoke():
                    nonlocal attempts, provider_timeout
                    remaining = deadline-time.monotonic()
                    if remaining <= 0:
                        raise asyncio.TimeoutError("OCR scan deadline reached before provider call")
                    attempts += 1
                    provider_timeout = min(settings.ocr_request_timeout_seconds, remaining)
                    if interactive:
                        provider_timeout = min(provider_timeout, settings.ocr_auto_review_timeout_seconds if review else settings.ocr_auto_request_timeout_seconds)
                    # Reserve processing time for every remaining eligible model,
                    # so one timeout cannot consume the entire fallback window.
                    remaining_models = sum(name not in blocked_models and available(name)
                                           for name in model_candidates[index:])
                    if index > 0:
                        provider_timeout = min(provider_timeout, settings.ocr_retry_timeout_seconds)
                    provider_timeout = min(max(MIN_OCR_REQUEST_TIMEOUT_SECONDS, provider_timeout),
                                           remaining * .95 / max(1, remaining_models))
                    return await asyncio.wait_for(
                        generate_ocr_response(model_name,data,mime,prompt,timeout_seconds=provider_timeout),
                        timeout=provider_timeout,
                    )
                remaining = deadline-time.monotonic()
                if remaining <= 0:
                    raise asyncio.TimeoutError("OCR scan deadline reached")
                response = await asyncio.wait_for(
                    bounded_call(invoke, timeout_seconds=remaining),
                    timeout=remaining,
                )
                parsed = parse_ocr_response(_response_text(response),coordinate_region)
                # Coverage/detail checks never re-probe a model that failed.
                for failed_name, failed_error in unavailable_in_read.items():
                    if failed_name != model_name:
                        blocked_models[failed_name] = failed_error
                used_models.append(model_name)
                return parsed
            except Exception as exc:
                record_failure(model_name,exc)
                last_error = exc
                failure = classify_ocr_error(exc)
                if failure.category in {"unavailable", "network"}:
                    unavailable_in_read[model_name] = exc
                blocked_models[model_name] = exc
                logger.warning("OCR attempt failed: model=%s error=%s status=%s category=%s attempt=%s elapsed=%.1fs provider_timeout=%s",
                    model_name,type(exc).__name__,failure.status,failure.category,attempts,time.monotonic()-attempt_started,
                    round(provider_timeout,1) if provider_timeout is not None else "not-started")
        raise OCRServiceBusy() from last_error

    parsed = await read_image(processed_bytes,effective_mime,CLINICAL_PRESCRIPTION_EXTRACTION_PROMPT,region)
    candidates = parsed["candidates"]
    expected = parsed["medicine_line_count"]
    verification_performed = False
    coverage_complete = parsed["coverage_complete"]
    uncertain = any(_needs_detail(c) for c in candidates)
    needs_check = (scan_mode == "thorough" or settings.ocr_auto_verify_clear or force_refresh
                   or not candidates or not coverage_complete or uncertain or bool(warnings)
                   or any(c.get("confidence", 0) < .9 or c.get("needs_confirmation") for c in candidates))
    if scan_mode != "fast" and needs_check:
        try:
            # Use the oriented original pixels instead of the contrast-enhanced JPEG.
            original_view = await asyncio.to_thread(crop_region, working_bytes, [0,0,1000,1000])
            audit = await read_image(original_view,"image/png",VERIFY_PROMPT,region,review=True)
            verification_performed = True
            candidates = merge_candidates(candidates,audit["candidates"])
            expected = max(x for x in [expected,audit["medicine_line_count"]] if x is not None) if expected is not None or audit["medicine_line_count"] is not None else None
            if expected is not None and len([c for c in candidates if not c.get("unreadable")]) >= expected:
                candidates = [c for c in candidates if not str(c.get("line_id","")).startswith("missing-")]
            coverage_complete = audit["coverage_complete"] and expected == len(candidates)
        except Exception as exc:
            warnings.append("Coverage check could not finish. Review the full prescription or retry the scan.")
            coverage_complete = False
    # Only uncertain areas get expensive original-resolution crop retries.
    if scan_mode != "fast" and image_info["width"] and attempts < 4 and (not coverage_complete or any(_needs_detail(c) for c in candidates)):
        boxes = []
        for candidate in sorted(candidates, key=lambda c: (
                not bool(c.get("alternative_reading")), not bool(c.get("unreadable")), c.get("confidence", 0))):
            box = candidate.get("bbox")
            if box and _needs_detail(candidate) and box not in boxes: boxes.append(box)
        if not boxes and not region:
            boxes = [[0,0,550,1000],[450,0,1000,1000]]
        for box in boxes[:2]:
            if attempts >= 4: break
            try:
                crop = await asyncio.to_thread(crop_region,image_bytes,box)
                recovered = await read_image(crop,"image/png",VERIFY_PROMPT+"Read only this crop. Its boundaries are not the full prescription.",box,review=True)
                candidates = merge_candidates(candidates,recovered["candidates"],corroborate=True)
            except Exception:
                warnings.append("A detail rescan could not finish. Review that region manually.")
    if expected is not None and len([c for c in candidates if not c.get("unreadable")]) >= expected:
        candidates = [c for c in candidates if not str(c.get("line_id","")).startswith("missing-")]
    fallback_used = any(name != model_candidates[0] for name in used_models)
    if fallback_used:
        warnings.append("The preferred OCR model was unavailable for part of this scan. A configured fallback was used; carefully review all medicine names against the image.")
    review_required = not coverage_complete or not candidates or any(c.get("needs_confirmation") or _needs_detail(c) for c in candidates)
    review_required = review_required or fallback_used
    if not verification_performed:
        review_required = True
        warnings.append("This scan has no completed independent coverage reading. Confirm every product against the image; use a detailed rescan for additional checks.")
    if expected is None or expected != len(candidates): review_required = True
    if review_required: warnings.append("Compare every medicine line with the original prescription before saving. Missing or unclear entries need review.")
    for candidate in candidates:
        candidate.pop("_alternative_candidate", None)
    result = {"candidates":candidates,"raw_text":", ".join(c["raw_text"] for c in candidates),"clinical_summary":parsed["clinical_summary"],
              "medicine_line_count":expected,"coverage_status":"review_required" if review_required else ("coverage_checked" if verification_performed else "self_reported"),
              "verification_performed":verification_performed,"review_required":review_required,"warnings":list(dict.fromkeys(warnings)),
              "image_width":image_info["width"],"image_height":image_info["height"],"models_used":list(dict.fromkeys(used_models)),
              "provider_attempts":attempts,"cache_version":OCR_CACHE_VERSION,"cached_at":time.time()}
    if not review_required:
        await asyncio.to_thread(_cache_put,image_hash,result)
    elif (coverage_complete and candidates and not fallback_used
          and not any(c.get("unreadable") or c.get("confidence", 0) < .8 or c.get("form_conflict") for c in candidates)):
        # A short, memory-only reuse window reduces repeat quota consumption.
        # Keep all review flags, alternatives and warnings; never cache failures.
        if len(_RECENT_OCR_RESULTS) >= MAX_OCR_CACHE_ENTRIES:
            _RECENT_OCR_RESULTS.pop(next(iter(_RECENT_OCR_RESULTS)))
        _RECENT_OCR_RESULTS[image_hash] = copy.deepcopy(result)
    return result
