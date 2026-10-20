"""Supported SDK request contract; no live network calls."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx
import pytest
from app.services import ocr_provider as provider
from app.config import Settings


def fake_client(monkeypatch, call):
    captured = {}
    class AsyncClient:
        models = SimpleNamespace(generate_content=call)
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            captured["closed"] = True
    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(aio=AsyncClient())
    monkeypatch.setattr(provider.genai, "Client", create)
    return captured


@pytest.mark.asyncio
async def test_ocr_sdk_uses_high_resolution_reasoning_and_one_attempt(monkeypatch):
    reply = SimpleNamespace(text="{}")
    call = AsyncMock(return_value=reply)
    captured = fake_client(monkeypatch, call)
    monkeypatch.setattr(provider.settings, "ocr_thinking_level", "medium")
    assert await provider.generate_ocr_response("models/gemini-3.5-flash-lite", b"pixels", "image/png", "Read ink", timeout_seconds=.45) is reply
    assert captured["closed"]
    assert captured["http_options"].timeout == 35000
    assert captured["http_options"].retry_options.attempts == 1
    args = call.call_args.kwargs
    assert args["model"] == "gemini-3.5-flash-lite"
    assert args["contents"][0] == "Read ink"
    assert args["contents"][1].inline_data.data == b"pixels"
    assert args["config"].media_resolution.value == "MEDIA_RESOLUTION_HIGH"
    assert args["config"].thinking_config.thinking_level.value == "MEDIUM"
    assert args["config"].temperature is None and args["config"].top_p is None
    assert args["config"].max_output_tokens == 32768
    assert args["config"].automatic_function_calling.disable


@pytest.mark.asyncio
async def test_transport_timeout_normalized_and_connection_closed(monkeypatch):
    call = AsyncMock(side_effect=httpx.ReadTimeout("slow"))
    captured = fake_client(monkeypatch, call)
    with pytest.raises(asyncio.TimeoutError):
        await provider.generate_ocr_response("gemini-3.5-flash-lite", b"pixels", "image/png", "Read", timeout_seconds=.01)
    assert captured["closed"] and call.await_count == 1


@pytest.mark.asyncio
async def test_cancellation_closes_client_without_retry(monkeypatch):
    entered = asyncio.Event()
    async def wait(**kwargs):
        entered.set()
        await asyncio.sleep(10)
    call = AsyncMock(side_effect=wait)
    captured = fake_client(monkeypatch, call)
    task = asyncio.create_task(provider.generate_ocr_response("gemini-3.5-flash-lite", b"pixels", "image/png", "Read", timeout_seconds=1))
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert captured["closed"] and call.await_count == 1


def test_ocr_model_is_independent_of_chat_configuration():
    config = Settings(_env_file=None, gemini_chat_model="chat-only-model")
    from app.services.ocr_models import OCR_MODEL_CHAIN
    assert (config.gemini_ocr_model,*config.gemini_ocr_fallback_models.split(",")) == OCR_MODEL_CHAIN
