"""Local-first orchestration and real database resolution; cloud calls are mocked."""
import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.services import ocr_service as service
from app.services.local_rx_parser import _parse_rx_lines_to_medicines, join_text_fragments
from test_ocr_review import image_bytes


@pytest.fixture(autouse=True)
def isolate_local_job(monkeypatch):
    monkeypatch.setattr(service, "_LOCAL_JOB", None)


def local(*texts):
    return {"lines": [{"text": text, "confidence": .96, "bbox": [i*100, 0, i*100+80, 800]}
                      for i, text in enumerate(texts)], "local_elapsed_ms": 5.0,
            "image_width": 1200, "image_height": 1800}


@pytest.mark.asyncio
async def test_primary_returns_known_and_unknown_products_with_zero_cloud_calls(backfilled_db, monkeypatch):
    from sqlalchemy import select
    from app.db.database import Medicine, MrpReference, StoreInventory
    monkeypatch.setattr(service, "_read_local_lines", lambda *a: local("Patient Name: Demo", "Panadol 500mg Tablet", "Augmentin 625mg Tablet", "xyzmed 50mg Tablet"))
    cloud = AsyncMock(side_effect=AssertionError("Local success must not call Gemini"))
    monkeypatch.setattr(service, "_extract_cloud_from_image", cloud)
    monkeypatch.setattr(service.settings, "gemini_api_key", "configured-test-key")
    _, factory = backfilled_db
    async with factory() as db:
        panadol = (await db.execute(select(Medicine).where(Medicine.brand_name == "Panadol"))).scalars().first()
        db.add(StoreInventory(medicine_id=panadol.id, selling_price=250, stock_quantity=11))
        await db.flush()
        started = time.monotonic()
        result = await service.extract_from_image(image_bytes(), "image/png", db=db)
        assert time.monotonic() - started < 2
        assert result["engine"] == "rapidocr" and result["provider_attempts"] == 0
        assert len(result["candidates"]) == 3
        assert result["candidates"][0]["stock_quantity"] == 11
        from app.models.schemas import OCRResponse
        assert len(OCRResponse(**result).model_dump(mode="json")["candidates"]) == 3
        for candidate in result["candidates"][:2]:
            assert candidate["matched_medicine"]["id"]
            assert candidate["match_candidates"]
            mrp = (await db.execute(select(MrpReference).where(MrpReference.medicine_id == candidate["matched_medicine"]["id"]))).scalars().first()
            if mrp:
                assert candidate["notified_mrp"] == mrp.notified_mrp
            assert candidate["needs_confirmation"] and not candidate["is_verified"]
        unknown = result["candidates"][2]
        assert unknown["original_name"] == "xyzmed"
        assert unknown["matched_medicine"] is None and unknown["needs_confirmation"]
        assert "notified_mrp" not in unknown  # Unknown price is never synthesized.
    cloud.assert_not_awaited()


@pytest.mark.parametrize("text", ["Oilum Bar", "Unknownmed Lotion", "Newbrand Cream", "Newbrand 2% Gel", "Rx Unknownmed", "Unknownmed 1+0+1"])
def test_non_catalog_medication_forms_and_strengths_are_kept(text):
    candidates = _parse_rx_lines_to_medicines(local(text)["lines"])
    assert len(candidates) == 1 and candidates[0]["raw_line"] == text
    assert candidates[0]["needs_confirmation"] and candidates[0]["matched_medicine"] is None


@pytest.mark.parametrize("text", ["Dr. Demo", "Clinic: Demo", "Hospital", "Patient Name: Demo", "Age: 35", "Date: 2026-10-21", "Signature", "Page 1", "03001234567", "Take 1 tablet daily", "500mg"])
def test_non_medication_text_is_not_a_product(text):
    assert not _parse_rx_lines_to_medicines(local(text)["lines"], ["Panadol"])


def test_bare_database_tokens_are_preserved_without_inventing_a_strength():
    item = _parse_rx_lines_to_medicines(local("Panadol")["lines"], ["Panadol"])[0]
    assert item["detected_strength"] is None and item["detected_form"] is None


def test_fragments_join_nearby_strength_without_merging_columns():
    def row(left, right, text): return [[[left, 20], [right, 20], [right, 40], [left, 40]], text, .95]
    lines = join_text_fragments([row(10, 100, "Panadol"), row(110, 180, "500mg"), row(600, 750, "Oilum Bar")], 1000, 1000)
    assert [line["text"] for line in lines] == ["Panadol 500mg", "Oilum Bar"]


@pytest.mark.asyncio
async def test_cloud_only_runs_after_local_zero_and_only_with_key(monkeypatch):
    monkeypatch.setattr(service, "_read_local_lines", lambda *a: local())
    cloud = AsyncMock(return_value={"candidates": [{"raw_text": "Cloudmed", "unreadable": False}], "raw_text": "Cloudmed"})
    monkeypatch.setattr(service, "_extract_cloud_from_image", cloud)
    monkeypatch.setattr(service.settings, "gemini_api_key", "")
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert result["fallback_available"] and result["engine"] == "concierge"
    cloud.assert_not_awaited()
    monkeypatch.setattr(service.settings, "gemini_api_key", "configured-test-key")
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert result["engine"] == "gemini" and not result["fallback_available"]
    cloud.assert_awaited_once()


@pytest.mark.asyncio
async def test_exhausted_cloud_returns_http_200_concierge_payload(monkeypatch):
    from app.routers.ocr import router
    from app.services.ocr_errors import OCRServiceBusy
    monkeypatch.setattr(service, "_read_local_lines", lambda *a: local())
    monkeypatch.setattr(service.settings, "gemini_api_key", "configured-test-key")
    monkeypatch.setattr(service, "_extract_cloud_from_image", AsyncMock(side_effect=OCRServiceBusy()))
    app = FastAPI(); app.include_router(router)
    async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
        result = await client.post("/api/ocr/extract", files={"image": ("rx.png", image_bytes(), "image/png")})
    assert result.status_code == 200
    assert result.json()["fallback_available"] and result.json()["error"] == "OCR_SERVICE_BUSY"
    assert result.json()["candidates"] == []


@pytest.mark.asyncio
async def test_local_engine_failure_still_allows_cloud(monkeypatch):
    def unavailable(*a): raise ImportError("missing local package")
    monkeypatch.setattr(service, "_read_local_lines", unavailable)
    monkeypatch.setattr(service.settings, "gemini_api_key", "configured-test-key")
    monkeypatch.setattr(service, "_extract_cloud_from_image", AsyncMock(return_value={"candidates": [{"raw_text": "Product"}], "raw_text": "Product"}))
    assert (await service.extract_from_image(image_bytes()))["engine"] == "gemini"


def test_lazy_engine_is_loaded_once_and_uses_packaged_ppocr_v4(monkeypatch):
    import rapidocr_onnxruntime
    loads = []
    def create(**kwargs):
        loads.append(kwargs)
        return lambda image: ([], [])
    monkeypatch.setattr(rapidocr_onnxruntime, "RapidOCR", create)
    monkeypatch.setattr(service, "_RAPID_OCR", None)
    service._read_local_lines(image_bytes(), "image/png")
    service._read_local_lines(image_bytes(), "image/png")
    assert len(loads) == 1 and loads[0]["det_limit_type"] == "max"


def test_cloud_chain_contains_only_requested_active_models():
    assert service.OCR_MODEL_CHAIN == ("gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash")


@pytest.mark.asyncio
async def test_slow_native_job_has_bounded_wait_and_no_cloud_timeout(monkeypatch):
    import threading
    release = threading.Event()
    def slow(*args):
        release.wait(2)
        return local("Panadol 500mg Tablet")
    monkeypatch.setattr(service, "_read_local_lines", slow)
    monkeypatch.setattr(service, "LOCAL_OCR_BUDGET_SECONDS", .04)
    monkeypatch.setattr(service.settings, "gemini_api_key", "configured-test-key")
    cloud = AsyncMock(side_effect=AssertionError("No cloud wait after local budget exhaustion"))
    monkeypatch.setattr(service, "_extract_cloud_from_image", cloud)
    try:
        started = time.monotonic()
        result = await service.extract_from_image(image_bytes(), "image/png")
        assert time.monotonic()-started < .5 and result["fallback_available"]
        # A different upload must not queue another native job while this one runs.
        again = await service.extract_from_image(image_bytes()+b"different", "image/png")
        assert again["fallback_available"]
        cloud.assert_not_awaited()
    finally:
        release.set()
        await asyncio.wrap_future(service._LOCAL_JOB[1])


@pytest.mark.asyncio
async def test_completed_reading_reuses_text_but_fresh_scan_runs_again(monkeypatch):
    calls = []
    def read(*args):
        calls.append(1)
        return local("Unknownmed 50mg Tablet")
    monkeypatch.setattr(service, "_read_local_lines", read)
    first = await service.extract_from_image(image_bytes(), "image/png")
    first["candidates"][0]["raw_line"] = "changed by caller"
    again = await service.extract_from_image(image_bytes(), "image/png")
    assert len(calls) == 1 and again["candidates"][0]["raw_line"] != "changed by caller"
    await service.extract_from_image(image_bytes(), "image/png", force_refresh=True)
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_failed_native_jobs_are_not_cached(monkeypatch):
    calls = []
    def read(*args):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("native initialization failed")
        return local("Unknownmed 50mg Tablet")
    monkeypatch.setattr(service, "_read_local_lines", read)
    monkeypatch.setattr(service.settings, "gemini_api_key", "")
    assert (await service.extract_from_image(image_bytes(), "image/png"))["fallback_available"]
    assert (await service.extract_from_image(image_bytes(), "image/png"))["engine"] == "rapidocr"
    assert len(calls) == 2
