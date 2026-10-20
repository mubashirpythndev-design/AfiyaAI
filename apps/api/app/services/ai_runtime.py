"""Bound AI concurrency and honor quota cooldowns across chat and audio."""
import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar
from app.config import settings

COOLDOWNS: dict[str, float] = {}
AI_SLOTS = asyncio.Semaphore(4)
Result = TypeVar("Result")

def available(model: str) -> bool:
    return COOLDOWNS.get(model, 0) <= time.monotonic()

def record_failure(model: str, exc: Exception) -> None:
    text = str(exc).lower()
    if "429" in text or "quota" in text or "resourceexhausted" in type(exc).__name__.lower():
        COOLDOWNS[model] = time.monotonic() + 60

async def bounded_call(call: Callable[[], Awaitable[Result]], *, timeout_seconds: float | None = None) -> Result:
    async with AI_SLOTS:
        return await asyncio.wait_for(call(), timeout=(settings.ai_timeout_seconds if timeout_seconds is None else timeout_seconds) + 1)
