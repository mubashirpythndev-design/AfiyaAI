"""Shared fixtures for Phase-0 enriched-data integration tests.

Reproduces the real pre-migration state of the database:
  1. Pre-migration schema (medicines WITHOUT drap_reg_no), created via raw
     DDL that mirrors the ORM schema minus the new column.
  2. Old-style seed: the same heuristic brand-name parsing the app used
     before the enriched backfill (seed_data._parse_medicine_name), so
     brands missing from the old generic_map have WRONG generic names —
     exactly the state of the production database pre-backfill.
  3. Programmatic alembic upgrade (revision 0001) against the temp DB.
  4. Idempotent enriched backfill keyed on drap_reg_no.
"""

import json
import sys
from pathlib import Path

import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

API_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = API_DIR.parents[1]
sys.path.insert(0, str(API_DIR))

from app.db.seed_data import _parse_medicine_name  # noqa: E402
from app.db.backfill_enriched import backfill_enriched_data  # noqa: E402
from app.db.seed_mrp import seed_mrp_reference  # noqa: E402
from app.db.seed_alerts import seed_drap_alerts  # noqa: E402

DRAP_DATA_PATH = PROJECT_ROOT / "DRAP_40_Medicines_data.json"
SOURCE_DRAP_ID = "a0000001-0000-0000-0000-000000000001"

# Pre-migration schema: mirrors the ORM models minus drap_reg_no (added by
# alembic revision 0001). Used to prove upgrade/downgrade reversibility.
PRE_MIGRATION_SCHEMA = """
CREATE TABLE medicines (
    id VARCHAR(36) PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(100) NOT NULL,
    strength VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(255),
    registration_info VARCHAR(255),
    aliases JSON,
    category VARCHAR(100),
    created_at DATETIME,
    verified_at DATETIME,
    updated_at DATETIME
);
CREATE TABLE sources (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT,
    source_type VARCHAR(50) NOT NULL,
    created_at DATETIME
);
CREATE TABLE medicine_prices (
    id VARCHAR(36) PRIMARY KEY,
    medicine_id VARCHAR(36) NOT NULL REFERENCES medicines(id),
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10),
    package_size VARCHAR(100),
    package_description VARCHAR(255),
    source_id VARCHAR(36) NOT NULL REFERENCES sources(id),
    collected_at DATETIME,
    created_at DATETIME
);
"""


def load_drap_rows() -> list[dict]:
    with open(DRAP_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def run_alembic(db_file: Path, command_name: str, revision: str) -> None:
    """Run an alembic command programmatically against the temp database."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_file}")
    getattr(command, command_name)(cfg, revision)


async def create_pre_migration_db(db_file: Path) -> None:
    """Create the pre-migration schema and old-style seed in a temp DB."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    async with engine.begin() as conn:
        for stmt in PRE_MIGRATION_SCHEMA.strip().split(";"):
            if stmt.strip():
                await conn.execute(text(stmt))

    rows = load_drap_rows()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO sources (id, name, url, source_type) "
                "VALUES (:id, 'DRAP Pakistan', 'https://www.dra.gov.pk/', "
                "'government_regulatory')"
            ),
            {"id": SOURCE_DRAP_ID},
        )
        for i, item in enumerate(rows, start=1):
            med_id = f"b0000001-0000-0000-0000-{i:012d}"
            price_id = f"c0000001-0000-0000-0000-{i:012d}"
            parsed = _parse_medicine_name(item["Product_name"])
            await conn.execute(
                text(
                    "INSERT INTO medicines (id, brand_name, generic_name, "
                    "dosage_form, strength, manufacturer, registration_info, "
                    "category) VALUES (:id, :brand, :generic, :form, "
                    ":strength, :mfr, :reg, :cat)"
                ),
                {
                    "id": med_id,
                    "brand": parsed["brand_name"],
                    "generic": parsed["generic_name"],
                    "form": parsed["dosage_form"],
                    "strength": parsed["strength"],
                    "mfr": item.get("Manufacturer", ""),
                    "reg": item.get("Registration_No", ""),
                    "cat": item.get("Category", ""),
                },
            )
            price_val = item.get("Price", 0)
            if isinstance(price_val, str):
                price_val = float(price_val.replace(",", ""))
            await conn.execute(
                text(
                    "INSERT INTO medicine_prices (id, medicine_id, price, "
                    "currency, package_size, package_description, source_id) "
                    "VALUES (:id, :mid, :price, 'PKR', :ps, :ps, :sid)"
                ),
                {
                    "id": price_id,
                    "mid": med_id,
                    # raw sqlite binding cannot take Decimal; NUMERIC affinity
                    # stores the float and the ORM reads it back as Decimal
                    "price": float(price_val),
                    "ps": item.get("Packsize", ""),
                    "sid": SOURCE_DRAP_ID,
                },
            )
    await engine.dispose()


async def make_session_factory(db_file: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, factory


@pytest_asyncio.fixture
async def migrated_db(tmp_path):
    """Pre-migration schema + seed, then alembic upgrade (NO backfill)."""
    db_file = tmp_path / "afiya_phase0.db"
    await create_pre_migration_db(db_file)
    run_alembic(db_file, "upgrade", "head")
    engine, factory = await make_session_factory(db_file)
    yield db_file, factory
    await engine.dispose()


@pytest_asyncio.fixture
async def backfilled_db(migrated_db):
    """Migrated DB with the enriched backfill applied (and re-run once to
    prove idempotency)."""
    db_file, factory = migrated_db
    async with factory() as db:
        await backfill_enriched_data(db)
        await backfill_enriched_data(db)  # second run must change nothing
    return db_file, factory


@pytest_asyncio.fixture
async def phase1_db(backfilled_db):
    """Phase-0 DB + Phase-1 mrp_reference seeded from the DRAP JSON.

    The mrp_reference table comes from alembic revision 0002 (included in
    'head'); the seeder is run twice to prove idempotency."""
    db_file, factory = backfilled_db
    async with factory() as db:
        await seed_mrp_reference(db)
        await seed_mrp_reference(db)  # second run must insert nothing
    return db_file, factory


@pytest_asyncio.fixture
async def phase1b_db(phase1_db):
    """Phase-1 DB + Feature B drap_alerts seeded from the demo CSV.

    The drap_alerts table comes from alembic revision 0003 (included in
    'head'); the seeder is run twice to prove idempotency."""
    db_file, factory = phase1_db
    async with factory() as db:
        await seed_drap_alerts(db)
        await seed_drap_alerts(db)  # second run must insert nothing
    return db_file, factory
