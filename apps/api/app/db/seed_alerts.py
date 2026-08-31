"""Idempotent seeder for ``drap_alerts`` (Phase-1 Feature B).

Spec 09 §15 manual-seed mode. Loads a small CSV (drap_alerts_seed.csv) of
alert rows keyed to EXISTING medicines via the canonical
``medicines.drap_reg_no`` (added in Phase-0 — referenced, not re-created).

SAFETY (the most important part of Feature B):
- Every seeded row is DEMO DATA. This seeder REFUSES to insert rows whose
  ``is_demo`` flag is not true — real DRAP alerts may only enter through a
  future ingestion pipeline that has confirmed the notice wording.
- Batch numbers are clearly fictional (DEMO-BATCH-*). The ranitidine row is
  illustrative only: no real batch, no fabricated DRAP notice/SRO ID.

Guarantees:
- Re-running skips rows already present for the same
  (medicine_id, batch_no, alert_type, issued_date), so seeding is idempotent.
- Only INSERTs into drap_alerts (+ at most one provenance row in sources).
  No existing table or row is modified.

Usage:  python -m app.db.seed_alerts
"""

import csv
import logging
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import DrapAlert, Medicine, Source

logger = logging.getLogger(__name__)

# Seed CSV lives next to this module.
ALERT_SEED_CSV = Path(__file__).resolve().parent / "drap_alerts_seed.csv"

# Provenance source for all seeded demo alert rows. Named and typed so it is
# visibly NOT a real DRAP notice feed.
DEMO_ALERT_SOURCE_NAME = "DEMO Alert Data"
DEMO_ALERT_SOURCE_ID = "a0000003-0000-0000-0000-000000000001"


@dataclass
class AlertSeedReport:
    rows_inserted: int = 0
    rows_skipped_existing: int = 0
    skipped_not_demo: int = 0
    unmatched_reg_nos: list = field(default_factory=list)
    skipped_no_key: int = 0


def _parse_bool(value: str) -> bool:
    return str(value or "").strip().lower() in ("true", "1", "yes")


def _parse_date(value: str) -> Optional[date]:
    value = str(value or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        logger.warning("Unparseable issued_at value: %r", value)
        return None


async def ensure_demo_alert_source(db: AsyncSession) -> Source:
    """Get-or-create the 'DEMO Alert Data' provenance source row."""
    result = await db.execute(
        select(Source).where(Source.name == DEMO_ALERT_SOURCE_NAME)
    )
    source = result.scalar_one_or_none()
    if source:
        return source
    source = Source(
        id=DEMO_ALERT_SOURCE_ID,
        name=DEMO_ALERT_SOURCE_NAME,
        url=None,  # deliberately no URL: this is not a real DRAP feed
        source_type="demo",
    )
    db.add(source)
    await db.flush()
    return source


async def seed_drap_alerts(
    db: AsyncSession, csv_path: Optional[Path] = None
) -> AlertSeedReport:
    """Seed drap_alerts idempotently from the demo CSV, keyed on drap_reg_no."""
    report = AlertSeedReport()
    path = csv_path or ALERT_SEED_CSV

    # Index verified medicines by their canonical DRAP key.
    result = await db.execute(
        select(Medicine).where(Medicine.drap_reg_no.is_not(None))
    )
    by_reg_no = {
        med.drap_reg_no.strip(): med for med in result.scalars().all()
    }

    source: Optional[Source] = None

    with open(path, "r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            reg_no = str(row.get("drap_reg_no", "")).strip()
            if not reg_no:
                report.skipped_no_key += 1
                continue

            # Safety gate in code: this seeder only ever seeds DEMO DATA.
            if not _parse_bool(row.get("is_demo", "")):
                logger.warning(
                    "Refusing to seed non-demo alert row for reg_no %s — "
                    "real alerts must come from a confirmed DRAP ingestion.",
                    reg_no,
                )
                report.skipped_not_demo += 1
                continue

            medicine = by_reg_no.get(reg_no)
            med_id = medicine.id if medicine else None
            name_raw = str(row.get("medicine_name_raw", "")).strip() or (
                f"{medicine.brand_name} {medicine.strength}".strip() if medicine else f"Medicine {reg_no}"
            )
            if medicine is None:
                report.unmatched_reg_nos.append(reg_no)

            if source is None:
                source = await ensure_demo_alert_source(db)

            batch_no = str(row.get("batch_no", "")).strip() or None
            issued_at = _parse_date(row.get("issued_at", ""))
            alert_type = str(row.get("alert_type", "")).strip() or "quality"

            # Idempotency: skip if this exact row already exists.
            if med_id is not None:
                existing = await db.execute(
                    select(DrapAlert.id).where(
                        DrapAlert.medicine_id == med_id,
                        DrapAlert.batch_no == batch_no,
                        DrapAlert.alert_type == alert_type,
                        DrapAlert.issued_at == issued_at,
                    )
                )
            else:
                existing = await db.execute(
                    select(DrapAlert.id).where(
                        DrapAlert.medicine_name_raw == name_raw,
                        DrapAlert.batch_no == batch_no,
                        DrapAlert.alert_type == alert_type,
                        DrapAlert.issued_at == issued_at,
                    )
                )

            if existing.first():
                report.rows_skipped_existing += 1
                continue

            db.add(
                DrapAlert(
                    medicine_id=med_id,
                    medicine_name_raw=name_raw,
                    batch_no=batch_no,
                    alert_type=alert_type,
                    description=str(row.get("description", "")).strip() or None,
                    is_demo=True,
                    source_id=source.id,
                    issued_at=issued_at,
                    resolved=_parse_bool(row.get("resolved", "")),
                )
            )
            report.rows_inserted += 1


    await db.commit()
    logger.info(
        "Alert seed complete: %d inserted, %d skipped (existing), "
        "%d refused (non-demo), %d unmatched reg_nos",
        report.rows_inserted,
        report.rows_skipped_existing,
        report.skipped_not_demo,
        len(report.unmatched_reg_nos),
    )
    return report


async def main() -> None:
    from app.db.database import async_session

    async with async_session() as db:
        report = await seed_drap_alerts(db)
        print(
            f"Alert seed done: {report.rows_inserted} inserted, "
            f"{report.rows_skipped_existing} skipped (existing), "
            f"{report.skipped_not_demo} refused (non-demo), "
            f"{len(report.unmatched_reg_nos)} unmatched."
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import asyncio

    asyncio.run(main())
