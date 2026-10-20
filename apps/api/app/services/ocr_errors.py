"""Safe provider diagnostics: never expose provider payloads or prescription text."""
import asyncio
from dataclasses import dataclass

import httpx


class OCRQuotaCooldownError(RuntimeError):
    code = 429


class OCRServiceBusy(RuntimeError):
    code = 503
    error = "OCR_SERVICE_BUSY"

    def __init__(self):
        super().__init__("AI OCR models are temporarily busy. Please use our instant Pharmacist Concierge flow.")

    def payload(self) -> dict:
        return {"error": self.error, "message": str(self), "fallback_available": True}


@dataclass(frozen=True)
class OCRFailure:
    status: int | None
    category: str
    retryable: bool = False


def classify_ocr_error(exc: Exception) -> OCRFailure:
    code = getattr(exc, "code", None)
    if callable(code):
        code = code()
    if not isinstance(code, int):
        code = getattr(exc, "status_code", None)
    if not isinstance(code, int):
        code = None
    name = type(exc).__name__.lower()
    # Legacy SDK errors and existing quota circuit breaker compatibility.
    text = str(exc).lower()
    if code == 429 or "resourceexhausted" in name or "429" in text or "quota" in text:
        return OCRFailure(429, "quota")
    if code in {408, 504} or isinstance(exc, (asyncio.TimeoutError, httpx.TimeoutException)) or name == "deadlineexceeded":
        return OCRFailure(code, "timeout", True)
    if code in {500, 502, 503} or name in {"serviceunavailable", "internalservererror"}:
        return OCRFailure(code, "unavailable", True)
    if isinstance(exc, httpx.TransportError):
        return OCRFailure(code, "network", True)
    if code in {401, 402, 403}:
        return OCRFailure(code, "access")
    if code is not None and 400 <= code < 500:
        return OCRFailure(code, "configuration")
    if name == "ocrformaterror":
        return OCRFailure(code, "invalid_response", True)
    return OCRFailure(code, "unknown")
