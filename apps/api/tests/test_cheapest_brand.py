"""Phase-0 Step 5: cheapest-brand service.

Asserts:
- per-unit cheapest returns for the three multi-brand groups,
- grouping key is (generic, strength): Ciprofloxacin 250mg/500mg are NOT
  grouped together,
- savings are computed vs the queried brand,
- pack-size parser handles both DRAP formats,
- safety flags stay off for the current (non-NTI) groups but fire for the
  guarded classes,
- unverified/unknown medicine ids are rejected (spec 04).
"""

import pytest
from decimal import Decimal

from sqlalchemy import select

from app.db.database import Medicine
from app.services.cheapest_brand_service import (
    MedicineNotFound,
    evaluate_switch_safety,
    get_cheapest_brands,
    parse_pack_units,
)


async def _med_id(db, brand: str) -> str:
    med = (
        await db.execute(select(Medicine).where(Medicine.brand_name == brand))
    ).scalar_one()
    return med.id


# --- Pack-size parser ---------------------------------------------------------

def test_parse_pack_units_multipack():
    assert parse_pack_units("1x14's") == (14, True)
    assert parse_pack_units("10x10's") == (100, True)
    assert parse_pack_units("5x10's") == (50, True)
    assert parse_pack_units("25x10's") == (250, True)


def test_parse_pack_units_doses():
    assert parse_pack_units("200 doses") == (200, True)
    assert parse_pack_units("60 doses") == (60, True)


def test_parse_pack_units_unknown_format_flagged():
    units, ok = parse_pack_units("weird pack")
    assert ok is False
    assert units == 1


# --- Cheapest-brand groups ------------------------------------------------------

async def test_omeprazole_20mg_cheapest_is_omidar(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        result = await get_cheapest_brands(db, await _med_id(db, "Losec"))

    assert result.generic == "Omeprazole"
    assert result.strength == "20mg"
    assert result.cheapest.brand_name == "Omidar"
    assert [o.brand_name for o in result.options] == ["Omidar", "Risek", "Losec"]
    assert result.options[0].per_unit == Decimal("30.00")  # 420 / 14
    assert result.options[1].per_unit == Decimal("43.57")  # 610 / 14
    assert result.options[2].per_unit == Decimal("67.86")  # 950 / 14
    # Saving of the cheapest brand vs the queried brand (Losec):
    assert result.options[0].saving_percent_vs_queried == Decimal("55.79")
    assert result.options[1].saving_percent_vs_queried == Decimal("35.79")
    assert result.options[2].saving_percent_vs_queried == Decimal("0.00")


async def test_cetirizine_10mg_cheapest_is_softin(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        result = await get_cheapest_brands(db, await _med_id(db, "Zyrtec"))

    assert [o.brand_name for o in result.options] == ["Softin", "Rigix", "Zyrtec"]
    per_units = [o.per_unit for o in result.options]
    assert per_units == [Decimal("30.20"), Decimal("39.00"), Decimal("39.00")]
    assert result.cheapest.brand_name == "Softin"


async def test_rosuvastatin_10mg_cheapest_is_xplendid(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        result = await get_cheapest_brands(db, await _med_id(db, "Crestor"))

    assert [o.brand_name for o in result.options] == [
        "Xplendid",
        "Rovista",
        "Crestor",
    ]
    per_units = [o.per_unit for o in result.options]
    assert per_units == [Decimal("34.07"), Decimal("82.14"), Decimal("97.14")]
    assert result.cheapest.brand_name == "Xplendid"



# --- Guardrail: never group across strengths ---------------------------------------

async def test_ciprofloxacin_strengths_are_not_grouped(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        novidat = await get_cheapest_brands(db, await _med_id(db, "Novidat"))
        ciproxin = await get_cheapest_brands(db, await _med_id(db, "Ciproxin"))

    # 250mg and 500mg must each form their own groups.
    assert [o.brand_name for o in novidat.options] == ["Novidat"]
    assert novidat.strength == "250mg"
    assert [o.brand_name for o in ciproxin.options] == ["Ciprokem", "Ciproxin"]
    assert ciproxin.strength == "500mg"


# --- Safety flags ---------------------------------------------------------------------

async def test_no_pharmacist_flag_for_current_groups(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        result = await get_cheapest_brands(db, await _med_id(db, "Losec"))
    assert result.consult_pharmacist_before_switching is False
    assert result.safety_reasons == []


def test_safety_flag_narrow_therapeutic_index():
    consult, reasons = evaluate_switch_safety("Warfarin", ["Tablet"])
    assert consult is True
    assert "narrow therapeutic index drug" in reasons


def test_safety_flag_modified_release():
    consult, reasons = evaluate_switch_safety("Somegeneric", ["Modified Release Tablet"])
    assert consult is True
    assert "modified/extended-release formulation" in reasons

    consult, reasons = evaluate_switch_safety("Somegeneric", ["Tablet ER"])
    assert consult is True


def test_safety_flag_biologic():
    consult, reasons = evaluate_switch_safety("Trastuzumab", ["Injection"])
    assert consult is True
    assert "biologic medicine" in reasons


# --- Spec 04: only verified medicines can be compared -----------------------------------

async def test_unknown_medicine_id_rejected(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        with pytest.raises(MedicineNotFound):
            await get_cheapest_brands(db, "does-not-exist")
