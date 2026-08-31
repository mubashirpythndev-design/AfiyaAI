"""Idempotent seeder for ``mrp_reference`` (Phase-1 Feature A).

Spec 09 §15 manual-seed mode: loads the DRAP-notified MRP baseline for the
40 MVP medicines from DRAP_40_Medicines_data.json, keyed on the canonical
``medicines.drap_reg_no`` (added in Phase-0 — referenced, not re-created).

Field mapping (note the SPACE in "effective from"):
  Packsize          -> mrp_reference.pack_size
  Price             -> mrp_reference.notified_mrp   (whole-pack PKR)
  "effective from"  -> mrp_reference.effective_date
  source (URL)      -> sources.url of the "DRAP Price Portal" source row
  currency defaults to 'PKR'; sro_ref stays NULL (not present in the seed).

Guarantees:
- One mrp_reference row per medicine; versioned rows are never overwritten —
  re-running skips rows that already exist for the same
  (medicine_id, pack_size, effective_date), so the seeder is idempotent.
- Only INSERTs into mrp_reference (+ at most one provenance row in
  sources). No existing table or row is modified.

Usage:  python -m app.db.seed_mrp
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import Medicine, MrpReference, Source

logger = logging.getLogger(__name__)

# Path to the DRAP seed file (project root). Per Phase-1 override, the data
# lives in the EXISTING DRAP_40_Medicines_data.json.
DRAP_DATA_PATH = Path(__file__).resolve().parents[4] / "DRAP_40_Medicines_data.json"

# Provenance source for all seeded MRP rows (spec 09 §16 records this exact
# name so rollback can remove it surgically).
PRICE_PORTAL_SOURCE_NAME = "DRAP Price Portal"
PRICE_PORTAL_SOURCE_ID = "a0000002-0000-0000-0000-000000000001"


@dataclass
class MrpSeedReport:
    rows_inserted: int = 0
    rows_skipped_existing: int = 0
    medicines_matched: int = 0
    unmatched_reg_nos: list = field(default_factory=list)
    skipped_no_key: int = 0
    skipped_bad_price: int = 0


def load_drap_rows(data_path: Optional[Path] = None) -> list[dict]:
    """Load the DRAP seed rows."""
    path = data_path or DRAP_DATA_PATH
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_effective_date(value) -> Optional[date]:
    """Parse the JSON "effective from" field (ISO YYYY-MM-DD)."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except ValueError:
        logger.warning("Unparseable 'effective from' value: %r", value)
        return None


async def ensure_price_portal_source(db: AsyncSession, url: Optional[str]) -> Source:
    """Get-or-create the 'DRAP Price Portal' provenance source row."""
    result = await db.execute(
        select(Source).where(Source.name == PRICE_PORTAL_SOURCE_NAME)
    )
    source = result.scalar_one_or_none()
    if source:
        return source
    source = Source(
        id=PRICE_PORTAL_SOURCE_ID,
        name=PRICE_PORTAL_SOURCE_NAME,
        url=url,
        source_type="government_regulatory",
    )
    db.add(source)
    await db.flush()
    return source


async def seed_mrp_reference(
    db: AsyncSession, data_path: Optional[Path] = None
) -> MrpSeedReport:
    """Seed mrp_reference idempotently from the DRAP JSON, keyed on drap_reg_no."""
    report = MrpSeedReport()
    rows = load_drap_rows(data_path)

    # Index verified medicines by their canonical DRAP key.
    result = await db.execute(
        select(Medicine).where(Medicine.drap_reg_no.is_not(None))
    )
    by_reg_no = {
        med.drap_reg_no.strip(): med for med in result.scalars().all()
    }

    source: Optional[Source] = None

    for row in rows:
        reg_no = str(row.get("Registration_No", "")).strip()
        if not reg_no:
            report.skipped_no_key += 1
            continue

        medicine = by_reg_no.get(reg_no)
        if medicine is None:
            report.unmatched_reg_nos.append(reg_no)
            continue

        if source is None:
            source = await ensure_price_portal_source(
                db, str(row.get("source") or "").strip() or None
            )

        pack_size = str(row.get("Packsize", "")).strip()
        effective = parse_effective_date(row.get("effective from"))

        price_val = row.get("Price", 0)
        if isinstance(price_val, str):
            try:
                price_val = float(price_val.replace(",", ""))
            except ValueError:
                logger.warning("Skipping row with unparseable Price %r (%s)",
                               row.get("Price"), reg_no)
                report.skipped_bad_price += 1
                continue

        # Clean up any stale MRP rows for this medicine with old pack sizes
        stale_res = await db.execute(
            select(MrpReference).where(
                MrpReference.medicine_id == medicine.id,
                MrpReference.pack_size != pack_size,
            )
        )
        for stale in stale_res.scalars().all():
            await db.delete(stale)

        # Check existing row for this medicine and current pack size
        existing = await db.execute(
            select(MrpReference).where(
                MrpReference.medicine_id == medicine.id,
                MrpReference.pack_size == pack_size,
            )
        )
        existing_row = existing.scalars().first()
        if existing_row:
            if existing_row.effective_date == effective and existing_row.notified_mrp == Decimal(str(price_val)):
                report.rows_skipped_existing += 1
                report.medicines_matched += 1
                continue
            else:
                existing_row.notified_mrp = Decimal(str(price_val))
                existing_row.effective_date = effective
                existing_row.source_id = source.id
                report.rows_inserted += 1
                report.medicines_matched += 1
                continue

        db.add(
            MrpReference(
                medicine_id=medicine.id,
                pack_size=pack_size,
                notified_mrp=Decimal(str(price_val)),
                currency="PKR",
                sro_ref=None,
                effective_date=effective,
                source_id=source.id,
            )
        )
        report.rows_inserted += 1
        report.medicines_matched += 1

    await db.commit()

    logger.info(
        "MRP seed complete: %d inserted, %d skipped (existing), "
        "%d seed rows matched, %d unmatched reg_nos",
        report.rows_inserted,
        report.rows_skipped_existing,
        report.medicines_matched,
        len(report.unmatched_reg_nos),
    )
    return report


async def main() -> None:
    from app.db.database import async_session

    async with async_session() as db:
        report = await seed_mrp_reference(db)
        print(
            f"MRP seed done: {report.rows_inserted} inserted, "
            f"{report.rows_skipped_existing} skipped (existing), "
            f"{len(report.unmatched_reg_nos)} unmatched."
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import asyncio

    asyncio.run(main())
