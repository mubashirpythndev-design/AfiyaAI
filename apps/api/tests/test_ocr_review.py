"""OCR coverage and recovery contracts; mocked provider, no accuracy claims."""
import asyncio
import io
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from PIL import Image, ImageDraw
from app.services import ocr_service as service, ai_runtime
from app.services.ocr_parsing import parse_ocr_response, merge_candidates, OCRFormatError
from app.services.ocr_images import crop_region, valid_box, map_box, inspect_image
from app.services.image_preprocessor import preprocess_prescription_image

@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    # These contracts explicitly exercise the thorough coverage behavior.
    monkeypatch.setattr(service.settings, "ocr_auto_verify_clear", True)
    monkeypatch.setattr(service, "_RECENT_OCR_RESULTS", {})
    monkeypatch.setattr(service.settings, "gemini_ocr_model", "models/old-primary")
    monkeypatch.setattr(service.settings, "gemini_ocr_fallback_models", "models/old-fallback")
    monkeypatch.setattr(service, "_DISK_CACHE_PATH", tmp_path / "ocr.sqlite3")
    monkeypatch.setattr(service, "_PRESCRIPTION_OCR_CACHE", {})
    ai_runtime.COOLDOWNS.clear()
    monkeypatch.setattr(ai_runtime, "AI_SLOTS", asyncio.Semaphore(4))

def image_bytes():
    image = Image.new("RGB", (1200, 1800), "white")
    ImageDraw.Draw(image).rectangle((50,100,1100,200), fill="black")
    buf = io.BytesIO(); image.save(buf,"PNG")
    return buf.getvalue()

def response(rows, count=None, complete=True, summary="original summary"):
    return {"candidates":rows,"medicine_line_count": len(rows) if count is None else count,
            "coverage_complete":complete,"clinical_summary":summary}

def row(name="Panadol", confidence=.92, box=None):
    return {"name":name,"strength":"500mg","form":"Tablet","raw_line":name,"confidence":confidence,"bbox":box}

def provider(monkeypatch, *payloads):
    def wrap(p):
        if isinstance(p,Exception): return p
        return SimpleNamespace(text=json.dumps(p), candidates=[])
    call=AsyncMock(side_effect=[wrap(p) for p in payloads])
    monkeypatch.setattr(service,"generate_ocr_response",call)
    return call

@pytest.mark.parametrize("name",["", "unknown", "illegible", "unreadable", "unclear"])
def test_unreadable_retained(name):
    result=parse_ocr_response(json.dumps(response([row(name)],count=2)))
    assert len(result["candidates"])==2
    assert all(c["unreadable"] and c["confidence"]==0 and c["needs_confirmation"] for c in result["candidates"])
    assert not result["coverage_complete"]

@pytest.mark.parametrize("confidence",[None,-1,2,"not a number",float("nan")])
def test_invalid_confidence_not_boosted(confidence):
    candidate=parse_ocr_response(json.dumps(response([row(confidence=confidence)])))["candidates"][0]
    assert candidate["confidence"]==0 and candidate["needs_confirmation"]

def test_unknown_brand_and_correction_retained():
    candidates=parse_ocr_response(json.dumps(response([row("ZzzUnknownProduct",.3),row("Panado1",.4)])))["candidates"]
    assert candidates[0]["original_name"]=="ZzzUnknownProduct" and candidates[0]["confidence"]==.3
    assert candidates[1]["original_name"]=="Panado1" and candidates[1]["confidence"]==.4
    assert candidates[1]["correction_suggestion"] and candidates[1]["needs_confirmation"]

@pytest.mark.parametrize("payload",["{",'{}','{"candidates":"bad"}',json.dumps({"candidates":[{}]*81})])
def test_malformed_not_accepted(payload):
    with pytest.raises(OCRFormatError): parse_ocr_response(payload)

def test_merge_recovers_and_flags_conflict_without_collapsing_repeated_names():
    old=parse_ocr_response(json.dumps(response([row("",0,[100,100,200,500]),row("Panadol",.9,[300,100,400,500])])))["candidates"]
    new=parse_ocr_response(json.dumps(response([row("Panadol",.9,[100,100,200,500]),row("Brufen",.9,[300,100,400,500]),row("Panadol",.9,[600,100,700,500])])))["candidates"]
    merged=merge_candidates(old,new)
    assert len(merged)==3 and not merged[0]["unreadable"]
    assert merged[1]["detected_brand"]=="Panadol" and merged[1]["alternative_reading"]=="Brufen 500mg Tablet"
    assert all(c["needs_confirmation"] for c in merged)

def test_image_geometry_and_native_crop():
    data=image_bytes(); crop=crop_region(data,[100,200,600,700])
    with Image.open(io.BytesIO(crop)) as image: assert image.size==(600,900)
    assert map_box([0,0,1000,1000],[100,200,600,700])==[100,200,600,700]
    assert valid_box([0,0,.2,1]) is None
    assert valid_box([False,0,100,100]) is None
    assert inspect_image(data)["warnings"]==[]

def test_preprocessing_preserves_detail_without_fake_upscale():
    for size, expected in [((600,400),(600,400)),((4000,2000),(3072,1536))]:
        buf=io.BytesIO(); Image.new("RGB",size,"white").save(buf,"PNG")
        processed,_=preprocess_prescription_image(buf.getvalue(),"image/png")
        with Image.open(io.BytesIO(processed)) as image: assert image.size==expected

@pytest.mark.asyncio
async def test_clear_scan_cached_and_fresh_scan_bypasses(monkeypatch):
    payload=response([row()]); call=provider(monkeypatch,payload,payload,payload,payload)
    data=image_bytes()
    first=await service.extract_from_image(data,"image/png")
    second=await service.extract_from_image(data,"image/png")
    assert first==second and call.call_count==2
    fresh=await service.extract_from_image(data,"image/png",force_refresh=True)
    assert call.call_count==4 and fresh["verification_performed"]
    assert fresh["clinical_summary"]=="original summary"

@pytest.mark.asyncio
async def test_missing_margin_line_recovered_and_summary_preserved(monkeypatch):
    first=response([row(box=[100,100,200,500])],count=2,complete=False)
    audit=response([row(box=[100,100,200,500]),row("Brufen",box=[850,700,950,990])],summary="must not replace")
    call=provider(monkeypatch,first,audit)
    result=await service.extract_from_image(image_bytes(),"image/png")
    assert len(result["candidates"])==2 and call.call_count==2
    assert result["clinical_summary"]=="original summary" and result["review_required"]
    assert not service._PRESCRIPTION_OCR_CACHE

@pytest.mark.asyncio
async def test_malformed_primary_uses_fallback(monkeypatch):
    call=AsyncMock(side_effect=[SimpleNamespace(text="{",candidates=[]),SimpleNamespace(text=json.dumps(response([row()])),candidates=[]),SimpleNamespace(text=json.dumps(response([row()])),candidates=[])])
    monkeypatch.setattr(service,"generate_ocr_response",call)
    result=await service.extract_from_image(image_bytes(),"image/png")
    assert result["provider_attempts"]==3 and len(result["candidates"])==1

@pytest.mark.asyncio
async def test_partial_results_not_cached_and_call_budget_bounded(monkeypatch):
    partial=response([row("",0,[100,100,200,500])],complete=False)
    call=provider(monkeypatch,*([partial]*8))
    data=image_bytes()
    for _ in range(2):
        result=await service.extract_from_image(data,"image/png")
        assert result["provider_attempts"]<=4 and result["review_required"] and result["candidates"][0]["unreadable"]
    assert call.call_count>4 and not service._PRESCRIPTION_OCR_CACHE

@pytest.mark.asyncio
async def test_detail_crop_coordinates_mapped_back(monkeypatch):
    partial=response([row("",0,[100,100,200,500])],complete=False)
    recovered=response([row("Panadol",box=[0,0,1000,1000])])
    provider(monkeypatch,partial,partial,recovered)
    result=await service.extract_from_image(image_bytes(),"image/png")
    assert result["candidates"][0]["bbox"]==[100,100,200,500]
    assert not result["candidates"][0]["unreadable"] and result["review_required"]

@pytest.mark.asyncio
async def test_failed_audit_retains_primary(monkeypatch):
    provider(monkeypatch,response([row(confidence=.4)]),RuntimeError("failed"),RuntimeError("failed"),RuntimeError("failed"))
    result=await service.extract_from_image(image_bytes(),"image/png")
    assert result["candidates"][0]["confidence"]==.4 and result["review_required"] and result["warnings"]

def test_truncated_output_rejected():
    candidate=SimpleNamespace(finish_reason=SimpleNamespace(name="MAX_TOKENS"))
    with pytest.raises(OCRFormatError): service._response_text(SimpleNamespace(text="{}",candidates=[candidate]))


@pytest.mark.asyncio
async def test_unreadable_verification_of_confident_name_triggers_detail_review(monkeypatch):
    box = [100,100,200,500]
    first = response([row("Oilum", .98, box)])
    unreadable = response([row("", 0, box)], complete=False)
    crop = response([row("Oilum", .9, [0,0,1000,1000])])
    call = provider(monkeypatch, first, unreadable, crop)
    result = await service.extract_from_image(image_bytes(), "image/png")
    candidate = result["candidates"][0]
    assert call.await_count == 3
    assert candidate["original_name"] == "Oilum"
    assert candidate["needs_confirmation"] and candidate["alternative_reading"]
    assert result["review_required"] and not candidate["is_verified"]
    assert not service._PRESCRIPTION_OCR_CACHE


def test_unreadable_review_retains_existing_conflict_and_original_transcription():
    box = [100,100,200,500]
    first = parse_ocr_response(json.dumps(response([row("Oilum", .98, box)])))["candidates"]
    second = parse_ocr_response(json.dumps(response([row("Oilatum", .9, box)])))["candidates"]
    unreadable = parse_ocr_response(json.dumps(response([row("", 0, box)], complete=False)))["candidates"]
    conflict = merge_candidates(first, second)
    merged = merge_candidates(conflict, unreadable)
    assert len(merged) == 1 and merged[0]["original_name"] == "Oilum"
    assert merged[0]["alternative_reading"] == conflict[0]["alternative_reading"]
    assert merged[0]["needs_confirmation"] and service._needs_detail(merged[0])


@pytest.mark.parametrize("name,line,model_form,expected,conflict", [
    ("Oilum", "Oilum Bar", "Tablet", "Bar", True),
    ("Oilum Bar", "Oilum Bar", "Bar", "Bar", False),
    ("Unlisted soap", "Unlisted soap", "", "Bar", False),
    ("Fucidin Cream", "Fucidin Cream", "Tablet", "Cream", True),
    ("Unlisted ointment", "Unlisted ointment", "", "Ointment", False),
    ("Unlisted gel", "Unlisted gel", "", "Gel", False),
    ("Unlisted lotion", "Unlisted lotion", "", "Lotion", False),
    ("Oilatum", "Oilatum tablet", "Tablet", "Tablet", False),
    ("Panadol", "Panadol", "", "", False),
    ("Unlisted", "Unlisted", "unknown", "", False),
])
def test_prescription_forms_do_not_default_or_come_from_catalog(name, line, model_form, expected, conflict):
    from app.services.pharmaceutical_corrector import correct_and_normalize_candidate
    candidate = correct_and_normalize_candidate(name=name, raw_line=line, form=model_form, confidence=.95)
    assert candidate["detected_form"] == expected
    assert candidate["form_conflict"] is conflict
    assert candidate["is_verified"] is False
    if conflict or not expected:
        assert candidate["needs_confirmation"]
    if expected == "Bar":
        assert "Tablet" not in candidate["raw_text"]
        assert candidate["raw_text"].count("Bar") == 1


def test_similar_unsupported_names_remain_distinct_not_hardcoded_aliases():
    from app.services.pharmaceutical_corrector import correct_and_normalize_candidate
    for name in ("Oilum", "Oilatum"):
        candidate = correct_and_normalize_candidate(name=name, form="Bar", raw_line=name + " Bar")
        assert candidate["original_name"] == name
        assert candidate["detected_brand"] == name
        assert candidate["raw_text"] == name + " Bar"


def test_catalog_correction_does_not_hide_different_image_readings():
    first = parse_ocr_response(json.dumps(response([row("Panado1", box=[100,100,200,500])])))["candidates"]
    second = parse_ocr_response(json.dumps(response([row("Panadol", box=[100,100,200,500])])))["candidates"]
    assert first[0]["raw_text"] != second[0]["raw_text"]
    assert first[0]["correction_suggestion"] == "Panadol"
    merged = merge_candidates(first, second)
    assert merged[0]["original_name"] == "Panado1"
    assert merged[0]["alternative_reading"] and merged[0]["needs_confirmation"]


@pytest.mark.asyncio
async def test_independent_audit_gets_original_pixels_without_first_names(monkeypatch):
    payload = response([row("UnlistedSentinelName", box=[100,100,200,500])])
    call = provider(monkeypatch, payload, payload)
    data = image_bytes()
    result = await service.extract_from_image(data, "image/png")
    assert call.call_count == 2 and result["verification_performed"]
    audit_args = call.call_args_list[1].args
    assert "UnlistedSentinelName" not in audit_args[3]
    assert "FIRST EXTRACTION" not in audit_args[3]
    assert audit_args[2] == "image/png"
    with Image.open(io.BytesIO(data)) as original, Image.open(io.BytesIO(audit_args[1])) as audit:
        assert original.size == audit.size
        assert original.tobytes() == audit.tobytes()
    assert call.call_args_list[0].args[0] == service.OCR_MODEL_CHAIN[0]


@pytest.mark.asyncio
async def test_complete_scan_name_conflict_triggers_crop_and_prefers_corroborated_reading(monkeypatch):
    first_row = {"name":"Oilatum", "form":"Tablet", "raw_line":"Oilatum tab", "confidence":.95,
                 "bbox":[250,350,320,650], "instructions":"1 tablet daily"}
    audit_row = {"name":"Oilum", "form":"Bar", "raw_line":"Oilum Bar", "confidence":.9,
                 "bbox":[250,350,320,650]}
    crop_row = {**audit_row, "bbox":[0,0,1000,1000]}
    call = provider(monkeypatch, response([first_row]), response([audit_row]), response([crop_row]))
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert call.call_count == 3
    candidate = result["candidates"][0]
    assert candidate["raw_text"] == "Oilum Bar"
    assert candidate["alternative_reading"] == "Oilatum Tablet"
    assert candidate["dosage_instruction"] is None
    assert candidate["bbox"] == first_row["bbox"]
    assert candidate["confidence"] == .9 and candidate["needs_confirmation"]
    assert not candidate["reviewed"] and not candidate["is_verified"]
    assert "_alternative_candidate" not in candidate
    assert result["review_required"] and not service._PRESCRIPTION_OCR_CACHE
    assert result["clinical_summary"] == "original summary"


@pytest.mark.parametrize("confidence,third_name", [(.3,"Oilum"),(.9,"OtherProduct")])
def test_weak_or_disagreeing_crop_does_not_replace_first_reading(confidence, third_name):
    def read_name(name, confidence=.9):
        return parse_ocr_response(json.dumps(response([row(name,confidence,[100,100,200,500])])))["candidates"]
    first = read_name("Oilatum")
    audited = merge_candidates(first, read_name("Oilum"))
    merged = merge_candidates(audited, read_name(third_name,confidence), corroborate=True)
    assert merged[0]["original_name"] == "Oilatum"
    assert merged[0]["alternative_reading"] and merged[0]["needs_confirmation"]


@pytest.mark.asyncio
async def test_raw_line_form_conflict_gets_detail_check_even_when_count_complete(monkeypatch):
    item = {"name":"Oilum", "form":"Tablet", "raw_line":"Oilum Bar", "confidence":.95,
            "bbox":[100,100,200,500]}
    call = provider(monkeypatch, *([response([item])] * 4))
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert 3 <= call.call_count <= 4
    assert result["candidates"][0]["detected_form"] == "Bar"
    assert result["candidates"][0]["form_conflict"] and result["review_required"]
    assert not service._PRESCRIPTION_OCR_CACHE


@pytest.mark.asyncio
async def test_fallback_use_is_visible_and_not_cached_as_quality_primary(monkeypatch):
    payload = response([row()])
    call = provider(monkeypatch, RuntimeError("429 quota"), RuntimeError("429 quota"), payload, payload)
    result = await service.extract_from_image(image_bytes(), "image/png")
    assert call.call_count == 4
    assert result["models_used"] == [service.OCR_MODEL_CHAIN[2]]
    assert result["review_required"] and not service._PRESCRIPTION_OCR_CACHE
    assert any("fallback" in warning for warning in result["warnings"])


@pytest.mark.asyncio
async def test_changing_ocr_thinking_settings_invalidates_cache(monkeypatch):
    payload = response([row()])
    call = provider(monkeypatch, payload, payload, payload, payload)
    data = image_bytes()
    monkeypatch.setattr(service.settings,"ocr_thinking_level","medium")
    await service.extract_from_image(data,"image/png")
    monkeypatch.setattr(service.settings,"ocr_thinking_level","high")
    await service.extract_from_image(data,"image/png")
    assert call.call_count == 4

@pytest.mark.asyncio
async def test_cache_ttl_and_prompt_version_invalidation(monkeypatch):
    payload=response([row()]); call=provider(monkeypatch,*([payload]*8)); data=image_bytes()
    await service.extract_from_image(data,"image/png")
    for entry in service._PRESCRIPTION_OCR_CACHE.values(): entry["cached_at"]-=90000
    await service.extract_from_image(data,"image/png")
    assert call.call_count==4
    monkeypatch.setattr(service,"OCR_CACHE_VERSION","test-new-version")
    await service.extract_from_image(data,"image/png")
    assert call.call_count==6

@pytest.mark.asyncio
async def test_quota_cooldown_prevents_repeat_failed_model(monkeypatch):
    payload=response([row()]); call=provider(monkeypatch,RuntimeError("429 quota"),payload,payload,payload,payload)
    await service.extract_from_image(image_bytes(),"image/png")
    assert ai_runtime.COOLDOWNS
    first=call.call_count
    await service.extract_from_image(image_bytes(),"image/png",force_refresh=True)
    assert call.call_count-first==2

@pytest.mark.asyncio
async def test_route_rejects_invalid_images_and_regions_without_provider(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from app.routers import ocr
    app=FastAPI(); app.include_router(ocr.router)
    async def unexpected(*args,**kwargs): raise AssertionError("must validate before provider call")
    monkeypatch.setattr(ocr,"extract_from_image",unexpected)
    async with AsyncClient(transport=ASGITransport(app=app),base_url="http://test") as client:
        for data,fields in [(b"corrupt",{}),(image_bytes(),{"region":"[0,0,0,100]"}),(image_bytes(),{"scan_mode":"invalid"})]:
            result=await client.post("/api/ocr/extract",files={"image":("test.png",data,"image/png")},data=fields)
            assert result.status_code==400

@pytest.mark.asyncio
async def test_route_passes_fresh_region_and_serializes_review_fields(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from app.routers import ocr
    app=FastAPI(); app.include_router(ocr.router)
    async def scan(data,mime,**kwargs):
        assert kwargs=={"force_refresh":True,"scan_mode":"thorough","region":[100,100,500,500]}
        return {**parse_ocr_response(json.dumps(response([row("",0)]))),"raw_text":"Unreadable","review_required":True,"verification_performed":True,"warnings":["Check original"],"provider_attempts":2}
    monkeypatch.setattr(ocr,"extract_from_image",scan)
    async with AsyncClient(transport=ASGITransport(app=app),base_url="http://test") as client:
        result=await client.post("/api/ocr/extract",files={"image":("test.png",image_bytes(),"image/png")},data={"force_refresh":"true","scan_mode":"thorough","region":"[100,100,500,500]"})
        assert result.status_code==200
        payload=result.json(); assert payload["review_required"] and payload["candidates"][0]["unreadable"] and payload["provider_attempts"]==2
