"""Migration 0008 tests: the user_cabinet table is additive and reversible.

Uses the shared migrated_db fixture (pre-migration schema + seed, then
alembic upgrade head against a temp SQLite file).
0008 must create ONLY the user_cabinet table + its unique constraint and indexes;
downgrade drops ONLY user_cabinet and leaves every existing table intact.
"""

import sqlite3
from tests.conftest import run_alembic

EXPECTED_COLUMNS = {
    "id",
    "user_id",
    "medicine_id",
    "created_at",
}

PRE_EXISTING_TABLES = {
    "medicines",
    "sources",
    "medicine_prices",
    "mrp_reference",
    "drap_alerts",
    "users",
    "overcharge_reports",
    "alembic_version",
}


def test_upgrade_head_creates_user_cabinet_table(migrated_db):
    db_file, _factory = migrated_db

    conn = sqlite3.connect(db_file)
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "user_cabinet" in tables
        assert PRE_EXISTING_TABLES.issubset(tables)

        cols = {r[1] for r in conn.execute("PRAGMA table_info(user_cabinet)")}
        assert cols == EXPECTED_COLUMNS
    finally:
        conn.close()


def test_downgrade_drops_only_user_cabinet(migrated_db):
    db_file, _factory = migrated_db
    # Downgrade from head (0008) to 0007
    run_alembic(db_file, "downgrade", "0007")

    conn = sqlite3.connect(db_file)
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "user_cabinet" not in tables
        assert PRE_EXISTING_TABLES.issubset(tables)

        # medicines, users, overcharge_reports must be untouched
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
        assert "user_cabinet" in tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(user_cabinet)")}
        assert cols == EXPECTED_COLUMNS
    finally:
        conn.close()
