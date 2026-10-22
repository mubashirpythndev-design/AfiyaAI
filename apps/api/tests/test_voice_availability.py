"""Provider outages must not look like a successfully transcribed silent recording."""
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, UploadFile
import app.routers.chat as voice


def audio(data=b"local audio fixture"):
    return UploadFile(filename="sample.webm", file=BytesIO(data))


@pytest.mark.asyncio
async def test_voice_all_models_unavailable(monkeypatch):
    monkeypatch.setattr(voice, "available", lambda _: False)
    with pytest.raises(HTTPException) as failure:
        await voice.transcribe_voice(audio(), "en")
    assert failure.value.status_code == 503
    assert "type your question" in failure.value.detail


@pytest.mark.asyncio
async def test_voice_provider_timeout_is_retryable(monkeypatch):
    monkeypatch.setattr(voice, "available", lambda _: True)
    monkeypatch.setattr(voice, "record_failure", lambda *_: None)
    monkeypatch.setattr(voice, "bounded_call", AsyncMock(side_effect=TimeoutError("provider timeout")))
    with pytest.raises(HTTPException) as failure:
        await voice.transcribe_voice(audio(), "en")
    assert failure.value.status_code == 503
    assert "provider timeout" not in failure.value.detail


@pytest.mark.asyncio
async def test_voice_silence_after_fallback_is_success(monkeypatch):
    monkeypatch.setattr(voice, "available", lambda _: True)
    monkeypatch.setattr(voice, "record_failure", lambda *_: None)
    response = SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[SimpleNamespace(text="")]))])
    monkeypatch.setattr(voice, "bounded_call", AsyncMock(side_effect=[TimeoutError(), response]))
    assert await voice.transcribe_voice(audio(), "en") == {"transcript": ""}


@pytest.mark.asyncio
async def test_voice_empty_upload_does_not_call_provider(monkeypatch):
    provider = AsyncMock()
    monkeypatch.setattr(voice, "bounded_call", provider)
    assert await voice.transcribe_voice(audio(b""), "en") == {"transcript": ""}
    provider.assert_not_called()
