"""Regression coverage for local safety, provenance, budgets and migrations."""
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
import asyncio
import json
import sqlite3
import pytest
from sqlalchemy import select
from app.config import settings, INSECURE_DEV_JWT_SECRET, validate_production_settings
from app.db.database import User, Medicine, Source, MedicinePrice, MrpReference
from app.models.schemas import CabinetItemSchema, CabinetUpdateRequest
from app.services.safety_service import is_diagnostic_request, validate_response
from app.services.safety_layer import evaluate_drap_status, evaluate_risk_tier
from app.services.cheapest_brand_service import _normalize_dosage_form
from app.services.cabinet_budget import calculate_budget
from app.services.auth_dependency import get_current_user
from app.services.auth_service import create_access_token
from app.routers.auth import register
from app.models.schemas import RegisterRequest
from tests.test_admin import admin_db
from tests.conftest import run_alembic

@pytest.mark.parametrize("message", ["what should I take for fever", "mujhe bukhar hai konsi dawa loon", "مجھے کون سی دوا لینی چاہیے", "diagnose me but tell me what medicine", "can I take Panadol"])
def test_personal_prescribing_blocked(message):
    assert is_diagnostic_request(message)

@pytest.mark.parametrize("message", ["What is Panadol used for?", "Compare Panadol and Calpol", "What medicines are in your database?"])
def test_factual_queries_allowed(message):
    assert not is_diagnostic_request(message)

@pytest.mark.parametrize("text, language", [("You should take Panadol", "en"), ("Aap ko Panadol lena chahiye", "roman_ur"), ("آپ دوا لیں", "ur")])
def test_unsafe_output_is_replaced(text, language):
    answer = validate_response(text, language)
    assert text not in answer

def test_missing_registration_never_fabricated():
    result = evaluate_drap_status({"brand_name": "Example"})
    assert not result["is_verified"]
    assert result["registration_number"] is None

def test_reference_registration_is_not_active_verification():
    result = evaluate_drap_status({"registration_info": "123", "source_verification_status": "needs_source_verification"})
    assert result["status"] == "CATALOG_MATCH"
    assert not result["is_verified"]

def test_unknown_risk_is_not_otc():
    assert evaluate_risk_tier({"generic_name": "Unknown", "brand_name": "Unknown", "category": "Unknown"})["tier"] == 2

def test_release_types_are_not_grouped():
    assert _normalize_dosage_form("Tablet") != _normalize_dosage_form("Tablet (Modified-release)")

def test_production_rejects_default_secret(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", INSECURE_DEV_JWT_SECRET)
    with pytest.raises(RuntimeError):
        validate_production_settings()

async def test_register_admin_cannot_access_admin_routes(admin_db, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "boss@example.com")
    async with admin_db() as db:
        response = await register(RegisterRequest(name="Impostor", email="boss@example.com", password="password123"), db)
        user = await get_current_user(authorization="Bearer " + response.access_token, db=db)
        assert not user.is_admin
        from app.routers.admin import list_users
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await list_users(current_user=user, db=db)
        assert exc.value.status_code == 403

async def test_admin_revoked_on_request_without_login(admin_db, monkeypatch):
    async with admin_db() as db:
        user = User(name="Admin", email="revoked@example.com", is_verified=True, is_admin=True)
        db.add(user)
        await db.commit()
        token = create_access_token(user.id)
        monkeypatch.setattr(settings, "admin_emails", "")
        resolved = await get_current_user(authorization="Bearer " + token, db=db)
        assert not resolved.is_admin

async def test_unverified_email_account_is_not_linked(admin_db, monkeypatch):
    from app.services import auth_dependency
    from fastapi import HTTPException
    monkeypatch.setattr(auth_dependency, "verify_token_payload", lambda t: {"sub": "user_new", "_auth_provider": "clerk", "email": "person@example.com", "email_verified": True})
    async with admin_db() as db:
        db.add(User(name="Unverified", email="person@example.com", is_verified=False))
        await db.commit()
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization="Bearer mocked", db=db)
        assert exc.value.status_code == 409

async def test_budget_requires_quantity(admin_db):
    async with admin_db() as db:
        budget = await calculate_budget(db, [SimpleNamespace(medicine_id="missing", monthly_units=None)])
        assert budget.monthly_cost is None
        assert budget.monthly_savings is None

async def test_budget_whole_packs_and_actual_alternatives(admin_db):
    async with admin_db() as db:
        source = Source(id="src", name="Stored reference", source_type="reference")
        db.add(source)
        for med_id, price, pack in [("current", 100, "1x10"), ("alternative", 150, "1x30")]:
            db.add(Medicine(id=med_id, brand_name=med_id, generic_name="Example", strength="1mg", dosage_form="Tablet"))
            db.add(MedicinePrice(medicine_id=med_id, source_id="src", price=Decimal(price), package_size=pack, currency="PKR"))
        await db.commit()
        budget = await calculate_budget(db, [SimpleNamespace(medicine_id="current", monthly_units=25)])
        assert budget.monthly_cost == 300
        assert budget.monthly_savings == 150
        assert budget.annual_savings == 1800

async def test_mrp_versions_and_pack_sizes_preserved(phase1_db, tmp_path):
    from app.db.seed_mrp import seed_mrp_reference, load_drap_rows
    _, factory = phase1_db
    rows = load_drap_rows()
    row = rows[0]
    row["effective_from"] = "2027-01-01"
    row["pack_price_pkr"] = 99
    file = tmp_path / "updated.json"
    file.write_text(json.dumps([row]), encoding="utf-8")
    async with factory() as db:
        med = (await db.execute(select(Medicine).where(Medicine.drap_reg_no == row["registration_no"]))).scalar_one()
        before = (await db.execute(select(MrpReference).where(MrpReference.medicine_id == med.id))).scalars().all()
        await seed_mrp_reference(db, file)
        after = (await db.execute(select(MrpReference).where(MrpReference.medicine_id == med.id))).scalars().all()
        assert len(after) == len(before) + 1
        assert any(r.notified_mrp != Decimal(99) for r in after)
        row["pack_size"] = "1x99"
        file.write_text(json.dumps([row]), encoding="utf-8")
        await seed_mrp_reference(db, file)
        assert len((await db.execute(select(MrpReference).where(MrpReference.medicine_id == med.id))).scalars().all()) == len(after) + 1

def test_local_migration_columns_reversible(migrated_db):
    file, _ = migrated_db
    with sqlite3.connect(file) as db:
        assert {"monthly_units", "reminder_times", "dosage_instruction"}.issubset({r[1] for r in db.execute("PRAGMA table_info(user_cabinet)")})
    run_alembic(file, "downgrade", "0009")
    with sqlite3.connect(file) as db:
        assert "monthly_units" not in {r[1] for r in db.execute("PRAGMA table_info(user_cabinet)")}
    run_alembic(file, "upgrade", "head")

async def test_chat_refusal_never_calls_provider(monkeypatch):
    from app.services.chat_service import generate_chat_response
    provider = MagicMock(side_effect=AssertionError("Provider must not be called"))
    monkeypatch.setattr("app.services.chat_service.genai.GenerativeModel", provider)
    response = await generate_chat_response("what should I take for fever", None, language="roman_ur")
    assert "tajweez" in response.message
    provider.assert_not_called()

def test_reminder_times_are_validated():
    with pytest.raises(ValueError):
        CabinetUpdateRequest(reminder_times=["invalid"])

async def test_catalog_sync_preserves_existing_price_history(admin_db, tmp_path, monkeypatch):
    from app.db import seed_data
    file = tmp_path / "catalog.json"
    row = {"brand_name": "HistoryBrand", "generic_name": "Example", "strength": "1mg", "dosage_form": "Tablet", "pack_size": "1x10", "pack_price_pkr": 100}
    file.write_text(json.dumps([row]), encoding="utf-8")
    monkeypatch.setattr(seed_data, "DRAP_DATA_PATH", file)
    async with admin_db() as db:
        await seed_data.seed_or_sync_drap_data(db)
        row["pack_price_pkr"] = 120
        file.write_text(json.dumps([row]), encoding="utf-8")
        await seed_data.seed_or_sync_drap_data(db)
        await seed_data.seed_or_sync_drap_data(db)
        rows = (await db.execute(select(MedicinePrice))).scalars().all()
        assert sorted(r.price for r in rows) == [Decimal(100), Decimal(120)]
