"""Gemini-only entry point and the fixed SDK transport deadline; no live calls."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.services import ocr_provider, ocr_service as service, ai_runtime
from app.services.ocr_errors import OCRServiceBusy
from app.services.ocr_models import OCR_MODEL_CHAIN
from test_ocr_provider import fake_client
from test_ocr_review import image_bytes, provider, response, row


@pytest.mark.asyncio
@pytest.mark.parametrize("model", OCR_MODEL_CHAIN)
@pytest.mark.parametrize("caller_timeout", [12.0, 90.0])
async def test_sdk_transport_is_exactly_35_seconds_for_every_active_model(monkeypatch, model, caller_timeout):
    call = AsyncMock(return_value=SimpleNamespace(text="{}"))
    captured = fake_client(monkeypatch, call)
    await ocr_provider.generate_ocr_response(model, b"synthetic-image", "image/png", "Read ink", timeout_seconds=caller_timeout)
    assert captured["http_options"].timeout == 35000
    assert captured["http_options"].retry_options.attempts == 1
    assert call.call_args.kwargs["model"] == model


@pytest.mark.asyncio
async def test_service_enters_vision_directly_without_any_local_engine(monkeypatch, tmp_path):
    import builtins
    original_import = builtins.__import__
    def no_local_engine(name, *args, **kwargs):
        if name.startswith(("rapidocr", "onnxruntime")):
            raise AssertionError("Local OCR must never run")
        return original_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, "__import__", no_local_engine)
    for cache in ("_PRESCRIPTION_OCR_CACHE", "_RECENT_OCR_RESULTS", "_IN_FLIGHT"):
        monkeypatch.setattr(service, cache, {})
    monkeypatch.setattr(service, "_DISK_CACHE_PATH", tmp_path/"cache.sqlite3")
    monkeypatch.setattr(ai_runtime, "AI_SLOTS", asyncio.Semaphore(1))
    ai_runtime.COOLDOWNS.clear()
    call = provider(monkeypatch, response([row("Unknownmed")]))
    result = await service.extract_from_image(image_bytes(), "image/png", scan_mode="fast")
    assert call.await_count == 1 and call.call_args.args[0] == "gemini-3.8-flash"
    assert call.call_args.kwargs["timeout_seconds"] == 35.0
    assert result["candidates"][0]["original_name"] == "Unknownmed"
    assert not result["candidates"][0]["is_verified"]


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [asyncio.TimeoutError(), RuntimeError("private prescription secret")])
async def test_final_timeout_or_failure_uses_exact_busy_json(monkeypatch, error):
    from app.routers import ocr
    monkeypatch.setattr(ocr, "extract_from_image", AsyncMock(side_effect=error))
    app = FastAPI(); app.include_router(ocr.router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.post("/api/ocr/extract", files={"image": ("rx.png", image_bytes(), "image/png")})
    assert result.status_code == 503 and result.json() == OCRServiceBusy().payload()
    assert "private prescription" not in result.text and "secret" not in result.text
