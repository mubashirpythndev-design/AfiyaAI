"""Idempotent backfill of enriched DRAP fields, keyed on drap_reg_no.

Phase-0 enriched-data integration (Step 3):
- Pass 1: populate ``drap_reg_no`` from the existing ``registration_info``
  column for rows where it is still NULL.
- Pass 2: for each row in DRAP_40_Medicines_data.json (enriched), set
  generic_name <- Generic, strength <- Strength, dosage_form <- Form on the
  medicine whose drap_reg_no matches Registration_No.

Guarantees:
- Re-runnable: pure UPDATEs keyed on the unique drap_reg_no, never INSERTs,
  so no duplicates are ever created.
- Only the three enriched fields (plus drap_reg_no itself) are written.
  Prices, aliases, category and every other field stay untouched.

Usage:  python -m app.db.backfill_enriched
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import Medicine

logger = logging.getLogger(__name__)

# Path to the enriched DRAP seed file (project root). Per Phase-0 override,
DATA_PATH = Path(__file__).resolve().parents[4] / "afiya_medicine_comparison_dataset_clean.json"
DRAP_DATA_PATH = DATA_PATH


@dataclass
class BackfillReport:
    reg_no_assigned: int = 0
    medicines_updated: int = 0
    medicines_matched: int = 0
    unmatched_reg_nos: list = field(default_factory=list)


def load_enriched_rows(data_path: Optional[Path] = None) -> list[dict]:
    """Load the enriched DRAP seed rows."""
    path = data_path or DRAP_DATA_PATH
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def backfill_enriched_data(
    db: AsyncSession, data_path: Optional[Path] = None
) -> BackfillReport:
    """Run the idempotent enriched-data backfill on the given session."""
    report = BackfillReport()
    rows = load_enriched_rows(data_path)

    # ---- Pass 1: assign drap_reg_no from registration_info where missing ----
    result = await db.execute(
        select(Medicine.id, Medicine.registration_info).where(
            Medicine.drap_reg_no.is_(None)
        )
    )
    for med_id, reg_no in result.all():
        if not reg_no:
            continue
        await db.execute(
            update(Medicine)
            .where(Medicine.id == med_id)
            .values(drap_reg_no=reg_no.strip())
        )
        report.reg_no_assigned += 1

    # ---- Pass 2: set enriched fields keyed on drap_reg_no ----
    for row in rows:
        reg_no = str(row.get("Registration_No", "")).strip()
        if not reg_no:
            continue

        enriched = {
            "generic_name": row.get("Generic", "").strip(),
            "strength": row.get("Strength", "").strip(),
            "dosage_form": row.get("Form", "").strip(),
        }

        res = await db.execute(
            update(Medicine)
            .where(Medicine.drap_reg_no == reg_no)
            .values(**enriched)
        )
        if res.rowcount > 0:
            report.medicines_matched += 1
            report.medicines_updated += res.rowcount
        else:
            report.unmatched_reg_nos.append(reg_no)

    await db.commit()
    logger.info(
        "Backfill complete: %d reg_nos assigned, %d medicines updated "
        "(%d seed rows matched, %d unmatched)",
        report.reg_no_assigned,
        report.medicines_updated,
        report.medicines_matched,
        len(report.unmatched_reg_nos),
    )
    return report


async def main() -> None:
    from app.db.database import async_session

    async with async_session() as db:
        report = await backfill_enriched_data(db)
        print(
            f"Backfill done: {report.reg_no_assigned} drap_reg_no assigned, "
            f"{report.medicines_updated} medicines updated, "
            f"{len(report.unmatched_reg_nos)} unmatched."
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import asyncio

    asyncio.run(main())
