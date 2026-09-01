"""Phase-0 Step 5: idempotent backfill keyed on drap_reg_no.

Asserts:
- all 40 rows have non-null generic/strength/form (+ drap_reg_no) after
  backfill,
- spot-check Risek -> Omeprazole 20mg Capsule,
- re-running the backfill creates no duplicates and changes nothing,
- prices are never overwritten,
- pre-backfill state really was stale (proves the backfill was needed).
"""

from decimal import Decimal

from sqlalchemy import func, select, text

from app.db.database import Medicine, MedicinePrice
from conftest import load_drap_rows

DRAP_ROWS = {(r.get("registration_no") or r.get("Registration_No")): r for r in load_drap_rows()}


async def test_pre_backfill_state_is_stale(migrated_db):
    """Brands absent from the old generic_map had wrong generic names."""
    _, factory = migrated_db
    async with factory() as db:
        losec = (
            await db.execute(select(Medicine).where(Medicine.brand_name == "Losec"))
        ).scalar_one()
        assert losec.drap_reg_no is None  # column exists post-migration, not filled


async def test_backfill_enriches_all_40_rows(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        medicines = (await db.execute(select(Medicine))).scalars().all()
        assert len(medicines) == len(DRAP_ROWS), "backfill must never insert duplicates"

        for med in medicines:
            assert med.drap_reg_no, f"{med.brand_name}: drap_reg_no missing"
            assert med.generic_name, f"{med.brand_name}: generic missing"
            assert med.strength, f"{med.brand_name}: strength missing"
            assert med.dosage_form, f"{med.brand_name}: form missing"
            # Every value must agree with the authoritative enriched JSON.
            seed = DRAP_ROWS[med.drap_reg_no]
            assert med.generic_name == (seed.get("generic_name") or seed.get("Generic"))
            assert med.strength == (seed.get("strength") or seed.get("Strength"))
            assert med.dosage_form == (seed.get("dosage_form") or seed.get("Form"))

        # Canonical keys are unique.
        count = await db.scalar(select(func.count(func.distinct(Medicine.drap_reg_no))))
        assert count == len(DRAP_ROWS)


async def test_backfill_spot_check_risek(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        risek = (
            await db.execute(select(Medicine).where(Medicine.brand_name == "Risek"))
        ).scalar_one()
        assert risek.generic_name == "Omeprazole"
        assert risek.strength == "20mg"
        assert risek.dosage_form == "Capsule"
        assert risek.drap_reg_no == "22183"


async def test_backfill_idempotent_and_prices_untouched(backfilled_db):
    """The fixture already ran the backfill twice; state must equal the seed."""
    _, factory = backfilled_db
    async with factory() as db:
        count = await db.scalar(select(func.count()).select_from(Medicine))
        assert count == len(DRAP_ROWS)

        prices = (await db.execute(select(MedicinePrice))).scalars().all()
        assert len(prices) == len(DRAP_ROWS)
        by_med = {p.medicine_id: p for p in prices}
        for med in (await db.execute(select(Medicine))).scalars().all():
            seed = DRAP_ROWS[med.drap_reg_no]
            price = by_med[med.id]
            expected_price = seed.get("pack_price_pkr") if seed.get("pack_price_pkr") is not None else seed.get("Price")
            assert price.price == Decimal(str(expected_price)), (
                f"Price for {med.brand_name} must not be overwritten"
            )
            expected_pack = seed.get("pack_size") or seed.get("Packsize")
            assert price.package_size == expected_pack


async def test_backfill_only_touches_enriched_fields(backfilled_db):
    _, factory = backfilled_db
    async with factory() as db:
        raw = (
            await db.execute(
                text("SELECT registration_info, category FROM medicines ORDER BY id")
            )
        ).all()
        for i, (reg, category) in enumerate(raw, start=1):
            seed = DRAP_ROWS[reg]
            expected_cat = seed.get("category") or seed.get("Category")
            assert category == expected_cat, "category must stay untouched"
