"""Real stored-pack conversion, persistence and invalid unit regression tests."""
from decimal import Decimal
from types import SimpleNamespace
import sqlite3
import pytest
from sqlalchemy import select
from fastapi import HTTPException
from app.db.database import Medicine, MedicinePrice, Source, User, UserCabinet
from app.models.schemas import CabinetUpdateRequest
from app.services.cabinet_quantity import quantity_options, normalize_quantity
from app.routers.cabinet import update_cabinet_reminder, get_user_cabinet
from tests.test_admin import admin_db
from tests.conftest import run_alembic

@pytest.mark.parametrize("form,pack,expected", [
    ("Tablet", "3x10's", [("tablet", 1), ("strip", 10), ("pack", 30)]),
    ("Capsule", "2x7's", [("capsule", 1), ("strip", 7), ("pack", 14)]),
    ("Inhaler", "200 doses", [("dose", 1), ("pack", 200)]),
    ("Tablet", "unknown", [("tablet", 1)]),
    ("Capsule", "0x0", [("capsule", 1)]),
    ("Syrup", "120 ml", [("unit", 1)]),
])
async def test_options_from_stored_pack(admin_db, form, pack, expected):
    async with admin_db() as db:
        db.add(Source(id="source", name="Reference", source_type="reference"))
        med = Medicine(id="med", brand_name="Sample", generic_name="Example", strength="1mg", dosage_form=form)
        db.add(med)
        db.add(MedicinePrice(medicine_id="med", source_id="source", price=Decimal(100), package_size=pack, currency="PKR"))
        await db.commit()
        stored_pack, options = await quantity_options(db, med)
        assert stored_pack == pack
        assert [(o["unit"], o["units_per_quantity"]) for o in options] == expected

@pytest.mark.parametrize("quantity,unit", [(1, "capsule"), (10001, "strip")])
def test_invalid_or_excessive_conversion(quantity, unit):
    with pytest.raises(ValueError):
        normalize_quantity(quantity, unit, [{"unit": "tablet", "units_per_quantity": 1}, {"unit": "strip", "units_per_quantity": 10}])

@pytest.mark.parametrize("value", [0, -1, 1.5, True])
def test_quantity_requires_positive_whole_number(value):
    with pytest.raises(ValueError):
        CabinetUpdateRequest(monthly_quantity=value, monthly_quantity_unit="tablet")

async def test_quantity_persists_and_recalculates_budget(admin_db):
    async with admin_db() as db:
        user = User(id="user", name="Tester", email="tester@example.com")
        db.add(user)
        db.add(Source(id="source", name="Reference", source_type="reference"))
        med = Medicine(id="med", brand_name="Sample", generic_name="Example", strength="1mg", dosage_form="Capsule")
        db.add(med)
        db.add(MedicinePrice(medicine_id="med", source_id="source", price=Decimal(90), package_size="3x10's", currency="PKR"))
        db.add(UserCabinet(id="cabinet", user_id="user", medicine_id="med", monthly_units=5))
        await db.commit()
        saved = await update_cabinet_reminder("med", CabinetUpdateRequest(monthly_quantity=4, monthly_quantity_unit="strip"), user, db)
        assert saved.pricing.current.pack_price_paisa == 9000
        assert saved.pricing.current.units_per_pack == 30
        assert saved.monthly_units == 40
        assert saved.monthly_quantity == 4 and saved.monthly_quantity_unit == "strip"
        db.expire_all()
        user = await db.get(User, "user")
        result = await get_user_cabinet(user, db)
        assert result.items[0].monthly_quantity == 4
        assert result.budget.monthly_cost == 180  # two whole packs, not 4 packs
        with pytest.raises(HTTPException) as exc:
            await update_cabinet_reminder("med", CabinetUpdateRequest(monthly_quantity=2, monthly_quantity_unit="tablet"), user, db)
        assert exc.value.status_code == 422
        await db.rollback()
        user = await db.get(User, "user")
        saved = await update_cabinet_reminder("med", CabinetUpdateRequest(monthly_quantity=None, monthly_quantity_unit=None), user, db)
        assert saved.monthly_units is None and saved.monthly_quantity_unit is None
        result = await get_user_cabinet(user, db)
        assert result.budget.monthly_cost is None

async def test_incomplete_and_conflicting_requests_rejected(admin_db):
    from app.services.cabinet_quantity import apply_quantity
    async with admin_db() as db:
        for payload in [CabinetUpdateRequest(monthly_quantity=2), CabinetUpdateRequest(monthly_units=20, monthly_quantity=2, monthly_quantity_unit="strip")]:
            with pytest.raises(ValueError):
                await apply_quantity(db, SimpleNamespace(), SimpleNamespace(), payload)

def test_quantity_migration_reversible_preserves_existing_values(migrated_db):
    file, _ = migrated_db
    with sqlite3.connect(file) as db:
        fields = {r[1] for r in db.execute("pragma table_info(user_cabinet)")}
        assert {"monthly_quantity", "monthly_quantity_unit"}.issubset(fields)
    run_alembic(file, "downgrade", "0010")
    with sqlite3.connect(file) as db:
        fields = {r[1] for r in db.execute("pragma table_info(user_cabinet)")}
        assert "monthly_quantity" not in fields
        assert "monthly_units" in fields
    run_alembic(file, "upgrade", "head")

@pytest.mark.parametrize("pack,currency,available", [("3x10's", "PKR", True), ("unknown", "PKR", False), ("3x10's", "USD", False)])
async def test_price_snapshot_matches_pack_and_never_uses_unrelated_mrp(admin_db, pack, currency, available):
    from datetime import datetime, timezone
    from app.db.database import MrpReference
    from app.routers.cabinet import _cabinet_schema
    async with admin_db() as db:
        db.add(Source(id="source", name="Reference", source_type="reference"))
        med = Medicine(id="med", brand_name="PriceTest", generic_name="Example", strength="1mg", dosage_form="Tablet")
        db.add(med)
        db.add(User(id="user", name="Tester", email="tester@example.com"))
        item = UserCabinet(id="cabinet", user_id="user", medicine_id="med", monthly_units=40)
        db.add(item)
        db.add(MedicinePrice(medicine_id="med", source_id="source", price=Decimal(10), package_size="1x10", currency="PKR", collected_at=datetime(2020,1,1,tzinfo=timezone.utc)))
        db.add(MedicinePrice(medicine_id="med", source_id="source", price=Decimal(90), package_size=pack, currency=currency, collected_at=datetime(2026,1,1,tzinfo=timezone.utc)))
        db.add(MrpReference(medicine_id="med", pack_size="10x10", notified_mrp=Decimal(999), source_id="source"))
        await db.commit()
        result = await _cabinet_schema(db, item, med)
        assert result.package_size == pack
        if available:
            assert result.pricing.current.pack_price_paisa == 9000
            assert result.pricing.current.units_per_pack == 30
            assert result.notified_mrp == 90  # not stale 10 or unrelated MRP 999
            cabinet = await get_user_cabinet(await db.get(User,"user"), db)
            assert cabinet.budget.monthly_cost == 180
        else:
            assert result.pricing is None
            assert result.notified_mrp is None
