"""Phase-1 Feature A tests (spec 09 §12).

Covers:
- Pure overcharge math: over / equal / below (exact Decimal arithmetic).
- NO_DATA: no MRP row for the requested pack -> graceful NO_DATA.
- Endpoint integration: matching -> MRP lookup -> localized response with
  provenance + effective_date + disclaimer; low confidence -> candidates +
  needs_confirmation (never a silent pick).
- Seeder idempotency: one mrp_reference row per medicine.
"""

from decimal import Decimal

from sqlalchemy import select, func

from app.db.database import MrpReference, Source
from app.db.seed_mrp import PRICE_PORTAL_SOURCE_NAME
from app.models.schemas import PriceCheckRequest
from app.routers.price_check import _split_strength, _strength_matches, price_check
from app.services.price_check_service import (
    STATUS_BELOW_MRP,
    STATUS_OK_AT_MRP,
    STATUS_OVERCHARGED,
    compare,
)

# ---------------------------------------------------------------------------
# Pure comparison math (no I/O) — over / equal / below
# ---------------------------------------------------------------------------


def test_compare_overcharged():
    result = compare(Decimal("250.00"), Decimal("210.00"))
    assert result.status == STATUS_OVERCHARGED
    assert result.amount == Decimal("40.00")


def test_compare_ok_at_mrp():
    result = compare(Decimal("210.00"), Decimal("210.00"))
    assert result.status == STATUS_OK_AT_MRP
    assert result.amount == Decimal("0.00")


def test_compare_below_mrp():
    result = compare(Decimal("180.00"), Decimal("210.00"))
    assert result.status == STATUS_BELOW_MRP
    assert result.amount == Decimal("-30.00")


def test_compare_exact_decimal_math_no_float_drift():
    # 0.1-style float traps must not leak into the classification
    result = compare("210.10", "210.00")
    assert result.status == STATUS_OVERCHARGED
    assert result.amount == Decimal("0.10")


def test_strength_token_parsing_and_matching():
    # Compound strengths parse as one token
    assert _split_strength("Symbicort 160/4.5mcg") == ("Symbicort", "160/4.5mcg")
    assert _split_strength("Risek 20mg") == ("Risek", "20mg")
    # Exact + suffix match for compound DB strengths; 250 vs 500 stays split
    assert _strength_matches("160/4.5mcg", "160/4.5mcg")
    assert _strength_matches("50/500mg", "500mg")
    assert not _strength_matches("50/500mg", "50mg")
    assert not _strength_matches("250mg", "500mg")
    assert not _strength_matches(None, "500mg")


# ---------------------------------------------------------------------------
# Seeder: one row per medicine, idempotent, provenance source present
# ---------------------------------------------------------------------------


async def test_mrp_seed_one_row_per_medicine(phase1_db):
    db_file, factory = phase1_db
    async with factory() as db:
        count = (
            await db.execute(select(func.count()).select_from(MrpReference))
        ).scalar()
        assert count == 40, "exactly one mrp_reference row per medicine"

        source = (
            await db.execute(
                select(Source).where(Source.name == PRICE_PORTAL_SOURCE_NAME)
            )
        ).scalar_one()
        assert source.url == "https://e.dra.gov.pk/public/price"

        # Every MRP row is traceable to the provenance source (spec 09 §11)
        orphans = (
            await db.execute(
                select(func.count())
                .select_from(MrpReference)
                .where(MrpReference.source_id != source.id)
            )
        ).scalar()
        assert orphans == 0


# ---------------------------------------------------------------------------
# Endpoint: overcharged path (Risek: MRP 610.00 for pack "1x14's")
# ---------------------------------------------------------------------------


async def test_price_check_overcharged(phase1_db):
    db_file, factory = phase1_db
    req = PriceCheckRequest(
        medicine_query="Risek 20mg", price_paid=700.0, lang="roman-ur"
    )
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status == STATUS_OVERCHARGED
    assert resp.needs_confirmation is False
    assert resp.matched_name == "Omeprazole 20mg (Risek)"
    assert resp.mrp == 610.0
    assert resp.overcharge_amount == 90.0
    assert resp.pack_size == "1x14's"
    assert resp.effective_date == "2026-04-10"  # from JSON "effective from"
    assert resp.source is not None

    assert resp.source.name == PRICE_PORTAL_SOURCE_NAME
    assert resp.source.url == "https://e.dra.gov.pk/public/price"
    # Localized message + mandatory freshness disclaimer (spec 07/09)
    assert "90" in resp.message and "610" in resp.message
    assert "MRP change ho sakti hai" in resp.disclaimer
    assert "latest DRAP notification se verify karein" in resp.disclaimer


async def test_price_check_ok_at_mrp_english(phase1_db):
    db_file, factory = phase1_db
    req = PriceCheckRequest(medicine_query="Risek 20mg", price_paid=610.0)
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status == STATUS_OK_AT_MRP
    assert resp.overcharge_amount == 0.0
    assert "DRAP-notified MRP" in resp.message
    assert resp.disclaimer  # disclaimer always present in every language


async def test_price_check_below_mrp(phase1_db):
    db_file, factory = phase1_db
    req = PriceCheckRequest(medicine_query="Panadol", price_paid=50.0)
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status == STATUS_BELOW_MRP
    assert resp.mrp == 72.7
    assert resp.overcharge_amount == 0.0  # only positive overcharge is reported



# ---------------------------------------------------------------------------
# Endpoint: NO_DATA and confirmation guards
# ---------------------------------------------------------------------------


async def test_price_check_no_data_unknown_pack_size(phase1_db):
    db_file, factory = phase1_db
    req = PriceCheckRequest(
        medicine_query="Risek 20mg", price_paid=250.0, pack_size="999 packs"
    )
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status == "NO_DATA"
    assert resp.mrp is None
    assert resp.overcharge_amount is None
    assert resp.disclaimer  # disclaimer still attached on NO_DATA


async def test_price_check_low_confidence_needs_confirmation(phase1_db):
    db_file, factory = phase1_db
    req = PriceCheckRequest(medicine_query="xyzplumb 99mg", price_paid=100.0)
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status is None  # never fabricate a status for unknown input
    assert resp.needs_confirmation is True
    assert resp.mrp is None
    assert resp.message  # localized confirmation prompt
    # No candidates -> message must NOT say "confirm from the candidates"
    assert resp.candidates == []
    assert "candidates" not in resp.message


async def test_price_check_generic_ambiguous_needs_confirmation(phase1_db):
    """'omeprazole' matches Losec AND Risek: never silently pick one
    (regression: used to crash with MultipleResultsFound)."""
    db_file, factory = phase1_db
    req = PriceCheckRequest(medicine_query="omeprazole", price_paid=180.0)
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status is None
    assert resp.needs_confirmation is True
    assert {c.brand_name for c in resp.candidates} == {"Losec", "Risek"}


async def test_price_check_strength_mismatch_needs_confirmation(phase1_db):
    """250mg must never resolve to the 20mg row (strict strength check)."""
    db_file, factory = phase1_db
    req = PriceCheckRequest(medicine_query="Risek 250mg", price_paid=100.0)
    async with factory() as db:
        resp = await price_check(req, db)

    assert resp.status is None
    assert resp.needs_confirmation is True
    assert resp.mrp is None


async def test_price_check_urdu_message(phase1_db):
    db_file, factory = phase1_db
    req = PriceCheckRequest(
        medicine_query="Risek 20mg", price_paid=700.0, lang="ur"
    )
    async with factory() as db:

        resp = await price_check(req, db)

    assert resp.status == STATUS_OVERCHARGED
    assert any(
        "\u0600" <= ch <= "\u06FF" for ch in resp.message
    ), "Urdu message must contain Urdu script"
    assert any("\u0600" <= ch <= "\u06FF" for ch in resp.disclaimer)
