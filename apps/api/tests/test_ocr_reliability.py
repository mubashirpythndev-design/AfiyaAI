"""Provider recovery and medication-product preservation, without network calls."""
import asyncio
import json
from unittest.mock import AsyncMock

import pytest
import httpx
from google.genai.errors import ClientError, ServerError
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from app.services import ai_runtime, ocr_service as service
from app.services.ocr_errors import classify_ocr_error, OCRServiceBusy
from app.services.ocr_parsing import merge_candidates, parse_ocr_response
from app.services.pharmaceutical_corrector import correct_and_normalize_candidate
from test_ocr_review import image_bytes, provider, response, row


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(service.settings, "ocr_auto_verify_clear", True)
    monkeypatch.setattr(service, "_RECENT_OCR_RESULTS", {})
    monkeypatch.setattr(service, "_DISK_CACHE_PATH", tmp_path / "cache.sqlite3")
    monkeypatch.setattr(service, "_PRESCRIPTION_OCR_CACHE", {})
    monkeypatch.setattr(service.settings, "gemini_ocr_model", "models/test-vision")
    monkeypatch.setattr(service.settings, "gemini_ocr_fallback_models", "")
    monkeypatch.setattr(ai_runtime, "AI_SLOTS", asyncio.Semaphore(1))
    ai_runtime.COOLDOWNS.clear()


def unavailable():
    return ServerError(503, {"error": {"message": "private patient text and secret-key", "status": "UNAVAILABLE"}})


@pytest.mark.asyncio
async def test_first_model_failure_recovers_on_fallback_and_audits(monkeypatch, caplog):
    # Alembic's fileConfig in earlier migration tests disables existing loggers.
    monkeypatch.setattr(service.logger, "disabled", False)
    caplog.set_level("WARNING", logger=service.logger.name)
    call = provider(monkeypatch, unavailable(), response([row()]), response([row()]))
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert call.await_count == 3 and result["verification_performed"]
    assert result["provider_attempts"] == 3
    assert "status=503" in caplog.text and "category=unavailable" in caplog.text
    assert "private patient" not in caplog.text and "secret-key" not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("code", [400, 401, 403, 404, 429])
async def test_hard_errors_move_once_to_each_fallback(monkeypatch, code):
    error = ClientError(code, {"error": {"message": "limit: 0"}})
    call = provider(monkeypatch, *[error for _ in service.OCR_MODEL_CHAIN])
    with pytest.raises(OCRServiceBusy):
        await service.extract_from_image(image_bytes(), "image/png")
    assert tuple(args.args[0] for args in call.call_args_list) == service.OCR_MODEL_CHAIN


@pytest.mark.asyncio
async def test_audit_failure_preserves_primary_and_caps_all_calls(monkeypatch):
    call = provider(monkeypatch, response([row()]), *[unavailable() for _ in range(4)])
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert result["candidates"][0]["original_name"] == "Panadol"
    assert result["review_required"] and not result["verification_performed"]
    assert call.await_count == 4 and result["provider_attempts"] == 4
    assert not service._PRESCRIPTION_OCR_CACHE


@pytest.mark.asyncio
async def test_cancel_fallback_releases_slot_and_prevents_another_call(monkeypatch):
    started=asyncio.Event()
    async def read(name,*args,**kwargs):
        if name==service.OCR_MODEL_CHAIN[0]:raise unavailable()
        started.set();await asyncio.sleep(10)
    call=AsyncMock(side_effect=read)
    monkeypatch.setattr(service,"generate_ocr_response",call)
    task=asyncio.create_task(service.extract_from_image(image_bytes(),"image/png"))
    await asyncio.wait_for(started.wait(),1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):await task
    assert call.await_count==2 and not ai_runtime.AI_SLOTS.locked()


@pytest.mark.asyncio
async def test_short_budget_stops_at_end_of_chain(monkeypatch):
    monkeypatch.setattr(service.settings, "ocr_total_timeout_seconds", .1)
    call = provider(monkeypatch, *[unavailable() for _ in service.OCR_MODEL_CHAIN])
    with pytest.raises(OCRServiceBusy):
        await service.extract_from_image(image_bytes(), "image/png")
    assert tuple(args.args[0] for args in call.call_args_list) == service.OCR_MODEL_CHAIN


@pytest.mark.asyncio
@pytest.mark.parametrize("code,phrase", [(503,"temporarily unavailable"), (504,"took too long"), (403,"model access"), (429,"quota")])
async def test_route_returns_safe_specific_errors(monkeypatch, code, phrase):
    from app.routers import ocr
    app = FastAPI(); app.include_router(ocr.router)
    error = (ServerError if code >= 500 else ClientError)(code, {"error": {"message": "private patient secret-key"}})
    monkeypatch.setattr(ocr, "extract_from_image", AsyncMock(side_effect=error))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.post("/api/ocr/extract", files={"image": ("test.png",image_bytes(),"image/png")})
    assert result.status_code == (429 if code == 429 else 503)
    assert phrase in result.json()["detail"]
    assert "secret-key" not in result.text and "private patient" not in result.text


@pytest.mark.parametrize("form", ["Bar","Cream","Lotion","Gel","Ointment","Shampoo","Spray","Solution","Wash","Mouthwash","Powder","Patch","Suppository","Pessary","Paste","Foam","Emulsion"])
def test_all_medication_forms_survive_normalization(form):
    candidate = correct_and_normalize_candidate(name="UnlistedProduct " + form, raw_line="UnlistedProduct " + form, form="", confidence=.95)
    assert candidate["detected_form"] == form
    assert candidate["original_name"] == "UnlistedProduct"
    assert candidate["raw_text"] == "UnlistedProduct " + form
    assert not candidate["is_verified"]


def test_overlapping_audit_lines_do_not_overwrite_same_candidate_twice():
    def parse(rows): return parse_ocr_response(json.dumps(response(rows)))["candidates"]
    first = parse([row("Alpha",box=[100,100,300,600]),row("Beta",box=[250,100,450,600])])
    audit = parse([row("Alpha",box=[150,100,350,600]),row("Gamma",box=[180,100,380,600])])
    merged = merge_candidates(first,audit)
    assert len(merged) == 2
    assert not merged[0].get("alternative_reading")
    assert merged[1]["alternative_reading"] == "Gamma 500mg Tablet"


@pytest.mark.parametrize("name,strength,expected", [("Example 250mg/5ml","","250mg/5ml"),("Example 2%","","2%"),("Example 500mg","500mg","500mg")])
def test_inline_strength_does_not_corrupt_product_name(name,strength,expected):
    candidate = correct_and_normalize_candidate(name=name,strength=strength,form="Solution",raw_line=name)
    assert candidate["original_name"] == "Example"
    assert candidate["detected_strength"] == expected
    assert candidate["raw_text"] == "Example " + expected + " Solution"


def test_form_without_name_remains_unreadable_not_a_valid_product():
    result = parse_ocr_response(json.dumps(response([{"name":"Cream", "raw_line":"cream ???", "confidence":.99}])))
    candidate = result["candidates"][0]
    assert candidate["unreadable"] and candidate["confidence"] == 0
    assert candidate["detected_form"] == "Cream" and not result["coverage_complete"]


def test_boolean_provider_fields_are_not_names_or_legibility_scores():
    result = parse_ocr_response(json.dumps(response([{"name":True,"confidence":True}, {"name":"UnlistedProduct", "confidence":True}])))
    assert result["candidates"][0]["unreadable"]
    assert all(c["confidence"] == 0 and c["needs_confirmation"] for c in result["candidates"])


@pytest.mark.parametrize("error,category,retry", [
    (ClientError(402, {"error":{"message":"No credits"}}), "access", False),
    (ServerError(504, {"error":{"message":"Deadline"}}), "timeout", True),
    (httpx.RemoteProtocolError("Connection closed"), "network", True),
    (asyncio.TimeoutError(), "timeout", True),
])
def test_error_categories_cover_transport_and_billing(error,category,retry):
    failure = classify_ocr_error(error)
    assert failure.category == category and failure.retryable is retry
