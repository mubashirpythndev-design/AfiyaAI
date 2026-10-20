"""Controlled timing tests for slow OCR and busy shared AI slots."""
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from google.api_core.exceptions import DeadlineExceeded
from app.services.ocr_errors import OCRServiceBusy
from app.services import ocr_service as service, ai_runtime
from test_ocr_review import image_bytes, response, row

@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    # Scale processing windows for controlled sub-second timing tests.
    monkeypatch.setattr(service,"MIN_OCR_REQUEST_TIMEOUT_SECONDS",0)
    monkeypatch.setattr(service.settings,"ocr_auto_verify_clear",True)
    monkeypatch.setattr(service,"_RECENT_OCR_RESULTS",{})
    monkeypatch.setattr(service.settings,"gemini_ocr_model","models/test-primary")
    monkeypatch.setattr(service.settings,"gemini_ocr_fallback_models","models/test-fallback")
    monkeypatch.setattr(service,"_DISK_CACHE_PATH",tmp_path/"cache.sqlite3")
    monkeypatch.setattr(service,"_PRESCRIPTION_OCR_CACHE",{})
    monkeypatch.setattr(ai_runtime,"AI_SLOTS",asyncio.Semaphore(1))
    monkeypatch.setattr(service.settings,"ai_timeout_seconds",.005)
    monkeypatch.setattr(service.settings,"ocr_request_timeout_seconds",.12)
    monkeypatch.setattr(service.settings,"ocr_total_timeout_seconds",.8)
    ai_runtime.COOLDOWNS.clear()

def success(): return SimpleNamespace(text=json.dumps(response([row()])),candidates=[])

def model(call): return SimpleNamespace(generate_content_async=call)

@pytest.mark.asyncio
async def test_slow_ocr_has_own_timeout_and_no_sdk_retries(monkeypatch):
    async def slow(*args,**kwargs):
        assert .1 < kwargs["timeout_seconds"] <= .12
        await asyncio.sleep(.04)
        return success()
    call=AsyncMock(side_effect=slow)
    monkeypatch.setattr(service,"generate_ocr_response",call)
    result=await service.extract_from_image(image_bytes(),"image/png")
    assert result["provider_attempts"]==2 and result["verification_performed"]
    assert call.await_count==2

@pytest.mark.asyncio
async def test_queue_wait_does_not_use_provider_processing_deadline(monkeypatch):
    monkeypatch.setattr(service.settings,"ocr_request_timeout_seconds",.2)
    slots=ai_runtime.AI_SLOTS
    await slots.acquire()
    async def slow(*args,**kwargs):
        await asyncio.sleep(.04); return success()
    call=AsyncMock(side_effect=slow)
    monkeypatch.setattr(service,"generate_ocr_response",call)
    task=asyncio.create_task(service.extract_from_image(b"queue-test","image/jpeg",scan_mode="fast"))
    await asyncio.sleep(.25); slots.release()
    result=await task
    assert result["provider_attempts"]==1 and call.await_count==1

@pytest.mark.asyncio
async def test_deadline_failure_falls_back_with_configured_timeout(monkeypatch):
    failed=AsyncMock(side_effect=DeadlineExceeded("provider deadline"))
    fallback=AsyncMock(return_value=success())
    names=[]
    async def select(name,*args,**kwargs):
        names.append(name)
        return await (failed if name==service.OCR_MODEL_CHAIN[0] else fallback)(*args,**kwargs)
    monkeypatch.setattr(service,"generate_ocr_response",select)
    result=await service.extract_from_image(image_bytes(),"image/png",scan_mode="fast")
    assert result["provider_attempts"]==2 and fallback.await_count==1
    assert fallback.call_args.kwargs["timeout_seconds"] > 0

@pytest.mark.asyncio
async def test_total_deadline_cancels_slow_call_and_releases_slot(monkeypatch):
    monkeypatch.setattr(service.settings,"ocr_total_timeout_seconds",.03)
    call=AsyncMock(side_effect=lambda *a,**k: None)
    async def hangs(*args,**kwargs): await asyncio.sleep(1); return success()
    call.side_effect=hangs
    monkeypatch.setattr(service,"generate_ocr_response",call)
    with pytest.raises(OCRServiceBusy):
        await service.extract_from_image(image_bytes(),"image/png",scan_mode="fast")
    assert 1 <= call.await_count <= len(service.OCR_MODEL_CHAIN) and not ai_runtime.AI_SLOTS.locked()
    assert not service._PRESCRIPTION_OCR_CACHE

@pytest.mark.asyncio
async def test_failed_coverage_keeps_primary_as_review_required(monkeypatch):
    call=AsyncMock(side_effect=[success(),DeadlineExceeded("slow"),DeadlineExceeded("slow"),DeadlineExceeded("slow")])
    monkeypatch.setattr(service,"generate_ocr_response",call)
    result=await service.extract_from_image(image_bytes(),"image/png")
    assert result["candidates"] and result["review_required"] and result["warnings"]
    assert not service._PRESCRIPTION_OCR_CACHE

@pytest.mark.asyncio
async def test_chat_retains_its_original_limit(monkeypatch):
    # The OCR override must not raise deadlines for other AI endpoints.
    monkeypatch.setattr(service.settings,"ai_timeout_seconds",.01)
    async def slow(): await asyncio.sleep(2)
    with pytest.raises(asyncio.TimeoutError): await ai_runtime.bounded_call(slow)
    assert not ai_runtime.AI_SLOTS.locked()

@pytest.mark.asyncio
async def test_api_timeout_returns_helpful_retry_response(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from app.routers import ocr
    app=FastAPI();app.include_router(ocr.router)
    async def fails(*args,**kwargs): raise DeadlineExceeded("do not expose provider details")
    monkeypatch.setattr(ocr,"extract_from_image",fails)
    async with AsyncClient(transport=ASGITransport(app=app),base_url="http://test") as client:
        result=await client.post("/api/ocr/extract",files={"image":("test.png",image_bytes(),"image/png")})
    assert result.status_code==503 and result.headers["Retry-After"]=="5"
    assert "took too long" in result.json()["detail"] and "provider details" not in result.text
