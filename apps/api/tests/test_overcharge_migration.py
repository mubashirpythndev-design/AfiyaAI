"""Migration 0007 tests: the overcharge_reports table is additive and reversible.

Uses the shared migrated_db fixture (pre-migration schema + seed, then
alembic upgrade head against a temp SQLite file).
0007 must create ONLY the overcharge_reports table + its indexes;
downgrade drops ONLY overcharge_reports and leaves every existing table intact.
"""

import sqlite3
from tests.conftest import run_alembic

EXPECTED_COLUMNS = {
    "id",
    "medicine_id",
    "reported_by_user_id",
    "pharmacy_name",
    "city",
    "price_paid",
    "notified_mrp",
    "mrp_effective_date",
    "overcharge_amount",
    "currency",
    "note",
    "status",
    "created_at",
}

PRE_EXISTING_TABLES = {
    "medicines",
    "sources",
    "medicine_prices",
    "mrp_reference",
    "drap_alerts",
    "users",
    "alembic_version",
}


def test_upgrade_head_creates_overcharge_reports_table(migrated_db):
    db_file, _factory = migrated_db

    conn = sqlite3.connect(db_file)
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "overcharge_reports" in tables
        assert PRE_EXISTING_TABLES.issubset(tables)

        cols = {r[1] for r in conn.execute("PRAGMA table_info(overcharge_reports)")}
        assert cols == EXPECTED_COLUMNS
    finally:
        conn.close()


def test_downgrade_drops_only_overcharge_reports(migrated_db):
    db_file, _factory = migrated_db
    # Downgrade from head (0007) to 0006
    run_alembic(db_file, "downgrade", "0006")

    conn = sqlite3.connect(db_file)
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "overcharge_reports" not in tables
        assert PRE_EXISTING_TABLES.issubset(tables)

        # medicines, mrp_reference, users must be untouched
        med_count = conn.execute("SELECT COUNT(*) FROM medicines").fetchone()[0]
        assert med_count > 0
    finally:
        conn.close()

    # Re-upgrade to head
    run_alembic(db_file, "upgrade", "head")
    conn = sqlite3.connect(db_file)
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "overcharge_reports" in tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(overcharge_reports)")}
        assert cols == EXPECTED_COLUMNS
    finally:
        conn.close()
