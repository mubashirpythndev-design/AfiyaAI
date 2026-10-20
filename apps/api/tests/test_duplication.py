import pytest
from sqlalchemy import select
from app.db.database import Medicine
from app.services.duplication_service import check_duplications
from marketplace_helpers import marketplace, request


@pytest.mark.asyncio
@pytest.mark.parametrize("names", [
    ["Losec 20mg Capsule", "Risek 20mg Capsule"],
    ["Rigix 10mg Tablet", "Zyrtec 10mg Tablet"],
])
async def test_same_generic_high(marketplace, names):
    async with marketplace["sessions"]() as db:
        result = await check_duplications(db, names)
    assert result["has_duplication"]
    assert result["same_generic_alerts"][0]["severity"] == "HIGH"
    assert not result["same_class_alerts"]
    assert not result["unresolved"]


@pytest.mark.asyncio
async def test_same_class_and_no_duplication(marketplace):
    async with marketplace["sessions"]() as db:
        result = await check_duplications(db, ["Losec", "TestPanto"])
        clear = await check_duplications(db, ["Panadol 500mg Tablet", "Augmentin 625mg Tablet"])
    assert result["same_class_alerts"][0]["severity"] == "MODERATE"
    assert not result["same_generic_alerts"]
    assert not clear["has_duplication"]
    assert clear["disclaimer"]


@pytest.mark.asyncio
async def test_resolution_is_conservative_and_strength_independent(marketplace):
    async with marketplace["sessions"]() as db:
        med = await db.get(Medicine, marketplace["ids"]["risek"])
        med.strength = "40mg"
        await db.commit()
        result = await check_duplications(db, [med, {"medicine_id": marketplace["ids"]["losec"]},
                                               "Omeprazole", "Lozec", "missing-id"])
    assert len(result["same_generic_alerts"]) == 1
    assert result["unresolved"] == ["Lozec", "missing-id"]
    assert result["ambiguous"][0]["input"] == "Omeprazole"
    assert len(result["ambiguous"][0]["candidates"]) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("lang", ["en", "ur", "roman_ur"])
async def test_endpoint_auth_and_languages(marketplace, lang):
    body = {"items": ["Losec", "Risek"], "lang": lang}
    unauthorized = await request(marketplace, "POST", "/api/v1/duplication-check", role=None, json=body)
    assert unauthorized.status_code == 401
    response = await request(marketplace, "POST", "/api/v1/duplication-check", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["has_duplication"]
    assert response.json()["message"] and response.json()["disclaimer"]
