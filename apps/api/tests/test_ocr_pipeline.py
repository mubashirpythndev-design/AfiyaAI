"""Afiya AI — Comprehensive OCR Pipeline Tests.
Tests image preprocessing, optical typo correction, doctor shorthand parsing,
clinical prescription decomposition, and schema integrity.
Author / Developer: Mubashir (Lead Developer)
"""

import io
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from PIL import Image

from app.services.image_preprocessor import preprocess_prescription_image
from app.services.pharmaceutical_corrector import (
    correct_and_normalize_candidate,
    clean_medicine_name,
    normalize_strength,
    normalize_dosage_form,
    expand_dosage_instructions,
)
from app.models.schemas import MedicineCandidate, OCRResponse
from app.services.ocr_service import _extract_cloud_from_image as extract_from_image


def test_image_preprocessor_valid_image():
    """Verify that a valid image is preprocessed and returned as high-quality JPEG."""
    img = Image.new("RGB", (600, 400), color=(240, 235, 220))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    raw_bytes = buf.getvalue()

    proc_bytes, mime = preprocess_prescription_image(raw_bytes, "image/jpeg")
    assert mime == "image/jpeg"
    assert len(proc_bytes) > 0

    # Verify output is valid image
    out_img = Image.open(io.BytesIO(proc_bytes))
    assert out_img.format == "JPEG"
    assert out_img.mode == "RGB"


def test_image_preprocessor_fallback_on_corrupt_bytes():
    """Verify that corrupt bytes fall back safely without raising an exception."""
    corrupt_bytes = b"not_a_valid_image_stream"
    proc_bytes, mime = preprocess_prescription_image(corrupt_bytes, "image/png")
    assert proc_bytes == corrupt_bytes
    assert mime == "image/png"


def test_clean_medicine_name_prefixes():
    """Verify that common doctor prefixes (Tab, Cap, Syp, Inj, Inh) and numbers are stripped."""
    assert clean_medicine_name("Tab. Panadol") == "Panadol"
    assert clean_medicine_name("Cap Risek") == "Risek"
    assert clean_medicine_name("Syp. Amoxil") == "Amoxil"
    assert clean_medicine_name("1. Augmentin") == "Augmentin"
    assert clean_medicine_name("2) Concor") == "Concor"
    assert clean_medicine_name("#3 Norvasc") == "Norvasc"


def test_normalize_strength_and_form():
    """Verify standard strength and dosage form normalization."""
    assert normalize_strength("500 mg") == "500mg"
    assert normalize_strength("100 mcg") == "100mcg"
    assert normalize_strength("1 g") == "1g"

    assert normalize_dosage_form("tabs") == "Tablet"
    assert normalize_dosage_form("caps") == "Capsule"
    assert normalize_dosage_form("syp") == "Syrup"
    assert normalize_dosage_form("inhaler") == "Inhaler"


def test_expand_dosage_instructions_tds_pc():
    """Verify expansion of clinical shorthand TDS, pc, and x 5/7."""
    text = "1 tab TDS pc x 5/7"
    expanded = expand_dosage_instructions(text)
    assert "3 times daily (TDS)" in expanded
    assert "after meals (pc)" in expanded
    assert "for 5 days" in expanded


def test_expand_dosage_instructions_bd_ac():
    """Verify expansion of clinical shorthand BD, ac, and x 14d."""
    text = "1 cap BD ac x 14d"
    expanded = expand_dosage_instructions(text)
    assert "2 times daily (BD)" in expanded
    assert "before meals (ac)" in expanded
    assert "for 14 days" in expanded


def test_expand_dosage_instructions_od_hs_sos():
    """Verify expansion of OD, HS (bedtime), and SOS (as needed)."""
    assert "once daily (OD)" in expand_dosage_instructions("1 tab OD")
    assert "at bedtime (HS)" in expand_dosage_instructions("1 tab HS")
    assert "as needed (SOS)" in expand_dosage_instructions("2 puffs SOS")


def test_pharmaceutical_corrector_exact_brand():
    """Verify exact brand match preserves extraction confidence and clean output."""
    res = correct_and_normalize_candidate(
        name="Panadol",
        strength="500mg",
        form="Tablet",
        frequency="TDS",
        instructions="1 tab TDS pc x 5/7",
        confidence=0.90,
    )
    assert res["raw_text"] == "Panadol 500mg Tablet"
    assert res["detected_brand"] == "Panadol"
    assert res["detected_generic"] == "Paracetamol"
    assert res["confidence"] == 0.90
    assert res["match_confidence"] == 1.0
    assert not res["needs_confirmation"]
    assert "3 times daily (TDS)" in res["dosage_instruction"]


def test_pharmaceutical_corrector_optical_typo_correction():
    """Keep optical readings while offering unverified catalog spelling suggestions."""
    # Panado1 with number 1
    res1 = correct_and_normalize_candidate(name="Panado1", strength="500mg", form="Tablet")
    assert res1["raw_text"] == "Panado1 500mg Tablet"
    assert res1["detected_brand"] == "Panado1"
    assert res1["correction_suggestion"] == "Panadol"
    assert res1["detected_generic"] is None
    assert res1["confidence"] == 0.85
    assert res1["needs_confirmation"]

    # Brvfen with 'v' instead of 'u'
    res2 = correct_and_normalize_candidate(name="Brvfen", strength="400mg", form="Tablet")
    assert res2["raw_text"] == "Brvfen 400mg Tablet"
    assert res2["detected_brand"] == "Brvfen"
    assert res2["correction_suggestion"] == "Brufen"
    assert res2["confidence"] == 0.85
    assert res2["needs_confirmation"]

    # Glvcophage
    res3 = correct_and_normalize_candidate(name="Glvcophage", strength="500mg", form="Tablet")
    assert res3["raw_text"] == "Glvcophage 500mg Tablet"
    assert res3["detected_brand"] == "Glvcophage"
    assert res3["correction_suggestion"] == "Glucophage"
    assert res3["confidence"] == 0.85
    assert res3["needs_confirmation"]


def test_medicine_candidate_schema_fields():
    """Verify MedicineCandidate schema serialization with enhanced fields."""
    candidate = MedicineCandidate(
        raw_text="Panadol 500mg Tablet",
        confidence=0.96,
        is_verified=True,
        detected_brand="Panadol",
        detected_generic="Paracetamol",
        detected_strength="500mg",
        detected_form="Tablet",
        dosage_instruction="1 tab 3 times daily (TDS) after meals (pc) for 5 days",
        raw_line="Tab Panadol 500mg 1 TDS pc x 5/7",
        needs_confirmation=False,
    )
    data = candidate.model_dump()
    assert data["detected_brand"] == "Panadol"
    assert data["dosage_instruction"] is not None
    assert data["confidence"] == 0.96

    response = OCRResponse(candidates=[candidate], raw_text="Panadol 500mg Tablet")
    assert len(response.candidates) == 1
    assert response.candidates[0].detected_generic == "Paracetamol"


@pytest.mark.asyncio
async def test_extract_from_image_mocked():
    """Verify end-to-end extract_from_image with simulated Gemini multimodal response."""
    fake_json = """[
        {"name": "Panado1", "strength": "500mg", "form": "Tablet", "frequency": "TDS", "instructions": "1 TDS pc x 5/7", "raw_line": "Tab Panado1 500mg TDS pc x 5/7", "confidence": 0.88},
        {"name": "Cap. Risek", "strength": "20mg", "form": "Capsule", "frequency": "OD", "instructions": "1 cap OD ac", "raw_line": "Cap Risek 20mg OD ac", "confidence": 0.92},
        {"name": "Inj. Rocephin", "strength": "1g", "form": "Injection", "frequency": "OD", "instructions": "1 vial IV OD", "raw_line": "Inj Rocephin 1g IV OD", "confidence": 0.95}
    ]"""

    img = Image.new("RGB", (400, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    fake_bytes = buf.getvalue()

    mock_resp = MagicMock()
    mock_resp.text = fake_json

    with patch("app.services.ocr_service.generate_ocr_response", new_callable=AsyncMock, return_value=mock_resp):
        result = await extract_from_image(fake_bytes, "image/jpeg")

    assert "candidates" in result
    assert len(result["candidates"]) == 3

    c1 = result["candidates"][0]
    assert c1["detected_brand"] == "Panado1"
    assert c1["raw_text"] == "Panado1 500mg Tablet"
    assert c1["correction_suggestion"] == "Panadol"
    assert c1["detected_form"] == "Tablet"
    assert "TDS" in c1["dosage_instruction"] or "3 times daily" in c1["dosage_instruction"]

    c2 = result["candidates"][1]
    assert c2["detected_brand"] == "Risek"
    assert c2["raw_text"] == "Risek 20mg Capsule"
    assert c2["detected_form"] == "Capsule"
    assert "OD" in c2["dosage_instruction"] or "once daily" in c2["dosage_instruction"]

    c3 = result["candidates"][2]
    assert c3["detected_brand"] == "Rocephin"
    assert c3["raw_text"] == "Rocephin 1g Injection"
    assert c3["detected_form"] == "Injection"
    assert "OD" in c3["dosage_instruction"] or "once daily" in c3["dosage_instruction"]


@pytest.mark.asyncio
async def test_deterministic_repeat_scan_cache(tmp_path, monkeypatch):
    """Verify that scanning the same image bytes repeatedly returns 100% identical cached results."""
    from app.services.ocr_service import clear_ocr_cache
    from app.services import ocr_service

    monkeypatch.setattr(ocr_service, "_DISK_CACHE_PATH", tmp_path / "ocr.sqlite3")
    monkeypatch.setattr(ocr_service, "_PRESCRIPTION_OCR_CACHE", {})
    clear_ocr_cache()
    image = Image.new("RGB", (1200, 1600), "white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    fake_bytes = buffer.getvalue()
    fake_json = """{"medicine_line_count":1,"coverage_complete":true,"candidates":[{"name": "Augmentin", "strength": "625mg", "form": "Tablet", "instructions": "1 tab BD", "confidence":0.9}]}"""

    mock_resp = MagicMock()
    mock_resp.text = fake_json

    with patch("app.services.ocr_service.generate_ocr_response", new_callable=AsyncMock, return_value=mock_resp) as mock_gen:
        res1 = await extract_from_image(fake_bytes, "image/jpeg", scan_mode="thorough")
        assert mock_gen.call_count == 2

        # Second scan of identical image must hit cache without invoking generative model
        res2 = await extract_from_image(fake_bytes, "image/jpeg", scan_mode="thorough")
        assert mock_gen.call_count == 2
        assert res1 == res2
