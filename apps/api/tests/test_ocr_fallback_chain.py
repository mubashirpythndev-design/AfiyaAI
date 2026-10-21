"""Ordered model failover and the exact concierge error contract; no live requests."""
import asyncio
import time
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from google.genai.errors import ClientError, ServerError
from app.services import ocr_service as service, ai_runtime
from app.services.ocr_errors import OCRServiceBusy
from app.services.ocr_models import OCR_MODEL_CHAIN
from test_ocr_review import image_bytes, provider, response, row

CHAIN=("gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-3.8-flash")

@pytest.fixture(autouse=True)
def isolated(monkeypatch,tmp_path):
    monkeypatch.setattr(service,"_DISK_CACHE_PATH",tmp_path/"cache.sqlite3")
    for name in ("_PRESCRIPTION_OCR_CACHE","_RECENT_OCR_RESULTS","_IN_FLIGHT"):
        monkeypatch.setattr(service,name,{})
    monkeypatch.setattr(service.settings,"gemini_ocr_model","old-environment-model")
    monkeypatch.setattr(service.settings,"gemini_ocr_fallback_models","old-fallback")
    monkeypatch.setattr(ai_runtime,"AI_SLOTS",asyncio.Semaphore(1))
    ai_runtime.COOLDOWNS.clear()

@pytest.mark.asyncio
@pytest.mark.parametrize("success_index",range(len(CHAIN)))
async def test_every_fallback_reachable_in_exact_order(monkeypatch,success_index):
    assert OCR_MODEL_CHAIN==CHAIN
    call=provider(monkeypatch,*[ServerError(503,{"error":{"message":"busy"}}) for _ in range(success_index)],response([row()]))
    result=await service.extract_from_image(image_bytes(),"image/png",scan_mode="fast")
    assert tuple(c.args[0] for c in call.call_args_list)==CHAIN[:success_index+1]
    assert result["provider_attempts"]==success_index+1
    assert result["candidates"] and result["review_required"]

@pytest.mark.asyncio
@pytest.mark.parametrize("kind",["503","429","general","404"])
async def test_all_failures_produce_safe_busy_exception(monkeypatch,kind,caplog):
    def error():
        if kind=="general":return RuntimeError("private patient secret-key")
        cls=ServerError if kind=="503" else ClientError
        return cls(int(kind),{"error":{"message":"private patient secret-key"}})
    call=provider(monkeypatch,*[error() for _ in CHAIN])
    with pytest.raises(OCRServiceBusy) as failure:
        await service.extract_from_image(image_bytes(),"image/png",scan_mode="fast")
    assert tuple(c.args[0] for c in call.call_args_list)==CHAIN
    assert failure.value.payload()=={"error":"OCR_SERVICE_BUSY","message":"AI OCR models are temporarily busy. Please use our instant Pharmacist Concierge flow.","fallback_available":True}
    assert not service._RECENT_OCR_RESULTS and not service._PRESCRIPTION_OCR_CACHE
    assert "private patient" not in caplog.text and "secret-key" not in caplog.text
    if kind=="429":
        with pytest.raises(OCRServiceBusy):
            await service.extract_from_image(image_bytes(),"image/png",force_refresh=True,scan_mode="fast")
        assert call.await_count==len(CHAIN)  # Exhausted models are skipped until cooldown expires.

@pytest.mark.asyncio
async def test_all_model_timeouts_share_overall_deadline(monkeypatch):
    monkeypatch.setattr(service,"MIN_OCR_REQUEST_TIMEOUT_SECONDS",0)
    monkeypatch.setattr(service.settings,"ocr_auto_timeout_seconds",.2)
    async def hang(*args,**kwargs):await asyncio.sleep(5)
    call=AsyncMock(side_effect=hang);monkeypatch.setattr(service,"generate_ocr_response",call)
    started=time.monotonic()
    with pytest.raises(OCRServiceBusy):await service.extract_from_image(image_bytes(),"image/png",scan_mode="fast")
    assert tuple(c.args[0] for c in call.call_args_list)==CHAIN
    assert time.monotonic()-started<1 and not ai_runtime.AI_SLOTS.locked()

@pytest.mark.asyncio
async def test_endpoint_returns_exact_top_level_503_payload(monkeypatch):
    from app.routers import ocr
    app=FastAPI();app.include_router(ocr.router)
    call=provider(monkeypatch,*[ServerError(503,{"error":{"message":"busy"}}) for _ in CHAIN])
    async with AsyncClient(transport=ASGITransport(app=app),base_url="http://test") as client:
        result=await client.post("/api/ocr/extract",files={"image":("rx.png",image_bytes(),"image/png")})
    assert result.status_code==503 and result.json()==OCRServiceBusy().payload()
    assert call.await_count==len(CHAIN) and "detail" not in result.json()

@pytest.mark.asyncio
async def test_legacy_short_limits_still_allow_35_seconds_for_every_model(monkeypatch):
    from types import SimpleNamespace
    clock = [0.0]
    monkeypatch.setattr(service, "time", SimpleNamespace(monotonic=lambda: clock[0], time=time.time))
    for setting in ("ocr_request_timeout_seconds", "ocr_total_timeout_seconds", "ocr_auto_timeout_seconds",
                    "ocr_auto_request_timeout_seconds", "ocr_retry_timeout_seconds"):
        monkeypatch.setattr(service.settings, setting, 12.0)
    async def times_out(*args, **kwargs):
        timeout = kwargs["timeout_seconds"]
        assert timeout >= 35.0
        clock[0] += timeout
        raise asyncio.TimeoutError()
    call = AsyncMock(side_effect=times_out)
    monkeypatch.setattr(service, "generate_ocr_response", call)
    with pytest.raises(OCRServiceBusy):
        await service.extract_from_image(image_bytes(), "image/png", scan_mode="fast")
    assert tuple(c.args[0] for c in call.call_args_list) == CHAIN
    assert 105 <= clock[0] <= 120
