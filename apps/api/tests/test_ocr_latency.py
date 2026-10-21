"""Interactive latency, quota-saving reuse and concurrency contracts."""
import asyncio
import time
from types import SimpleNamespace
import json
from unittest.mock import AsyncMock

import pytest
from google.genai.errors import ServerError
from app.services.ocr_errors import OCRServiceBusy
from app.services import ai_runtime, ocr_service as service
from test_ocr_review import image_bytes, response, row, provider


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "_DISK_CACHE_PATH", tmp_path / "cache.sqlite3")
    monkeypatch.setattr(service, "_PRESCRIPTION_OCR_CACHE", {})
    monkeypatch.setattr(service, "_RECENT_OCR_RESULTS", {})
    monkeypatch.setattr(service, "_IN_FLIGHT", {})
    monkeypatch.setattr(service.settings, "gemini_ocr_model", "models/test-latency")
    monkeypatch.setattr(service.settings, "gemini_ocr_fallback_models", "")
    monkeypatch.setattr(service.settings, "ocr_auto_verify_clear", False)
    monkeypatch.setattr(ai_runtime, "AI_SLOTS", asyncio.Semaphore(1))
    ai_runtime.COOLDOWNS.clear()


@pytest.mark.asyncio
async def test_clear_auto_uses_one_call_but_still_requires_human_review(monkeypatch):
    call = provider(monkeypatch, response([row()]))
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert call.await_count == 1 and not result["verification_performed"]
    assert result["review_required"] and result["coverage_status"] == "review_required"
    assert not result["candidates"][0]["is_verified"]
    assert any("no completed independent" in warning for warning in result["warnings"])
    assert 0 < call.call_args.kwargs["timeout_seconds"] <= 40


@pytest.mark.asyncio
async def test_uncertain_auto_and_thorough_still_get_blind_coverage(monkeypatch):
    payload = response([row(confidence=.85)])
    call = provider(monkeypatch, *([payload] * 6))
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert result["verification_performed"] and call.await_count >= 2
    assert call.call_args_list[1].kwargs["timeout_seconds"] <= 35
    result = await service.extract_from_image(image_bytes(), "image/png", scan_mode="thorough")
    assert result["verification_performed"]


@pytest.mark.asyncio
async def test_review_cache_reuses_only_identical_inputs_and_preserves_flags(monkeypatch):
    payload = response([row()]); call = provider(monkeypatch, payload, payload, payload, payload)
    data = image_bytes()
    first = await service.extract_from_image(data,"image/png")
    first["candidates"][0]["is_verified"] = True
    again = await service.extract_from_image(data,"image/png")
    assert call.await_count == 1 and again["review_required"]
    assert not again["candidates"][0]["is_verified"]
    for entry in service._RECENT_OCR_RESULTS.values(): entry["cached_at"] -= 301
    await service.extract_from_image(data,"image/png")
    assert call.await_count == 2
    await service.extract_from_image(data,"image/png",force_refresh=True)
    assert call.await_count == 4


@pytest.mark.asyncio
async def test_duplicate_concurrent_uploads_share_calls_but_not_mutable_results(monkeypatch):
    started = asyncio.Event(); release = asyncio.Event()
    async def read(*args,**kwargs):
        started.set(); await release.wait()
        return SimpleNamespace(text=json.dumps(response([row()])),candidates=[])
    call = AsyncMock(side_effect=read); monkeypatch.setattr(service,"generate_ocr_response",call)
    data = image_bytes()
    a = asyncio.create_task(service.extract_from_image(data,"image/png"))
    await started.wait()
    b = asyncio.create_task(service.extract_from_image(data,"image/png"))
    await asyncio.sleep(.01); release.set()
    first,second = await asyncio.gather(a,b)
    assert call.await_count == 1 and not service._IN_FLIGHT
    first["candidates"][0]["raw_text"] = "changed"
    assert second["candidates"][0]["raw_text"] != "changed"


@pytest.mark.asyncio
async def test_one_cancelled_waiter_does_not_cancel_other_upload(monkeypatch):
    started = asyncio.Event(); release = asyncio.Event()
    async def read(*args,**kwargs):
        started.set(); await release.wait()
        return SimpleNamespace(text=json.dumps(response([row()])),candidates=[])
    call = AsyncMock(side_effect=read); monkeypatch.setattr(service,"generate_ocr_response",call)
    data = image_bytes()
    a = asyncio.create_task(service.extract_from_image(data,"image/png"))
    await started.wait()
    b = asyncio.create_task(service.extract_from_image(data,"image/png"))
    await asyncio.sleep(.01); a.cancel()
    with pytest.raises(asyncio.CancelledError): await a
    release.set(); result = await b
    assert result["candidates"] and call.await_count == 1
    assert not service._IN_FLIGHT and not ai_runtime.AI_SLOTS.locked()


@pytest.mark.asyncio
async def test_overload_fallback_has_document_processing_headroom_and_no_cached_failure(monkeypatch):
    error = ServerError(503,{"error":{"message":"busy"}})
    call = provider(monkeypatch,*[error for _ in service.OCR_MODEL_CHAIN])
    with pytest.raises(OCRServiceBusy): await service.extract_from_image(image_bytes(),"image/png")
    assert call.await_count == len(service.OCR_MODEL_CHAIN)
    assert call.call_args_list[0].kwargs["timeout_seconds"] <= 40
    assert call.call_args_list[1].kwargs["timeout_seconds"] <= 35
    assert not service._RECENT_OCR_RESULTS and not service._IN_FLIGHT


@pytest.mark.asyncio
async def test_interactive_overall_budget_cancels_slow_provider(monkeypatch):
    monkeypatch.setattr(service,"MIN_OCR_REQUEST_TIMEOUT_SECONDS",0)
    monkeypatch.setattr(service.settings,"ocr_auto_timeout_seconds",.15)
    async def slow(*args,**kwargs): await asyncio.sleep(10)
    call = AsyncMock(side_effect=slow); monkeypatch.setattr(service,"generate_ocr_response",call)
    start = time.monotonic()
    with pytest.raises(OCRServiceBusy): await service.extract_from_image(image_bytes(),"image/png")
    assert time.monotonic() - start < 2 and 1 <= call.await_count <= len(service.OCR_MODEL_CHAIN)
    assert not ai_runtime.AI_SLOTS.locked() and not service._IN_FLIGHT


@pytest.mark.asyncio
async def test_timeout_does_not_start_a_duplicate_remote_job(monkeypatch):
    monkeypatch.setattr(service,"OCR_REQUEST_TIMEOUT_SECONDS",.08)
    monkeypatch.setattr(service,"MIN_OCR_REQUEST_TIMEOUT_SECONDS",0)
    monkeypatch.setattr(service.settings,"ocr_auto_request_timeout_seconds",.08)
    async def slow(*args,**kwargs): await asyncio.sleep(10)
    call = AsyncMock(side_effect=slow); monkeypatch.setattr(service,"generate_ocr_response",call)
    start = time.monotonic()
    with pytest.raises(OCRServiceBusy): await service.extract_from_image(image_bytes(),"image/png")
    assert call.await_count <= len(service.OCR_MODEL_CHAIN) and time.monotonic() - start < 2
    assert len({args.args[0] for args in call.call_args_list}) == call.await_count
    assert not ai_runtime.AI_SLOTS.locked() and not service._IN_FLIGHT


@pytest.mark.asyncio
async def test_timed_out_model_is_not_reused_for_audit(monkeypatch):
    monkeypatch.setattr(service.settings,"gemini_ocr_fallback_models","models/test-backup")
    monkeypatch.setattr(service.settings,"ocr_auto_verify_clear",True)
    call = provider(monkeypatch,asyncio.TimeoutError(),response([row()]),response([row()]))
    result = await service.extract_from_image(image_bytes(),"image/png")
    assert result["verification_performed"] and result["review_required"]
    assert [args.args[0] for args in call.call_args_list] == [service.OCR_MODEL_CHAIN[0],service.OCR_MODEL_CHAIN[1],service.OCR_MODEL_CHAIN[1]]


@pytest.mark.asyncio
async def test_unavailable_primary_is_not_reprobed_after_fallback_succeeds(monkeypatch):
    monkeypatch.setattr(service.settings,"gemini_ocr_fallback_models","models/test-backup")
    monkeypatch.setattr(service.settings,"ocr_auto_verify_clear",True)
    error = ServerError(503,{"error":{"message":"high demand"}})
    call = provider(monkeypatch,error,response([row()]),response([row()]))
    result = await service.extract_from_image(image_bytes(),"image/png")
    assert call.await_count == result["provider_attempts"] == 3
    assert [args.args[0] for args in call.call_args_list] == [service.OCR_MODEL_CHAIN[0],service.OCR_MODEL_CHAIN[1],service.OCR_MODEL_CHAIN[1]]
    assert result["models_used"] == [service.OCR_MODEL_CHAIN[1]]
    assert result["verification_performed"] and result["review_required"]
    assert not result["candidates"][0]["is_verified"]


@pytest.mark.asyncio
async def test_zero_product_first_reading_gets_coverage_check(monkeypatch):
    call = provider(monkeypatch,response([]),response([row()]))
    result = await service.extract_from_image(image_bytes(),"image/png")
    assert call.await_count == 2 and result["verification_performed"]
    assert len(result["candidates"]) == 1 and result["review_required"]


@pytest.mark.asyncio
async def test_immediate_reupload_does_not_join_cancelled_extraction(monkeypatch):
    started = asyncio.Event(); cleaning = asyncio.Event(); release = asyncio.Event()
    calls = 0
    async def read(*args,**kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            started.set()
            try: await asyncio.Event().wait()
            except asyncio.CancelledError:
                cleaning.set(); await release.wait(); raise
        return SimpleNamespace(text=json.dumps(response([row()])),candidates=[])
    monkeypatch.setattr(service,"generate_ocr_response",read)
    data = image_bytes()
    old = asyncio.create_task(service.extract_from_image(data,"image/png"))
    await started.wait(); old.cancel(); await cleaning.wait()
    new = asyncio.create_task(service.extract_from_image(data,"image/png"))
    await asyncio.sleep(.01); release.set()
    with pytest.raises(asyncio.CancelledError): await old
    result = await new
    assert calls == 2 and result["candidates"] and not service._IN_FLIGHT
