"""Migration 0005 tests: the users table is additive and reversible.

Uses the shared migrated_db fixture (pre-migration schema + seed, then
alembic upgrade head against a temp SQLite file), exactly like the other
migration-reversibility suites. 0005 must create ONLY the users table +
its unique email index; downgrade drops ONLY users and leaves every
existing table intact.
"""

from tests.conftest import run_alembic

EXPECTED_COLUMNS = {
    "id",
    "name",
    "email",
    "password_hash",
    "created_at",
    "last_login_at",
    "is_verified",
}

# Tables that MUST survive upgrade and downgrade untouched.
PRE_EXISTING_TABLES = {
    "medicines",
    "sources",
    "medicine_prices",
    "mrp_reference",
    "drap_alerts",
    "alembic_version",
}


def test_upgrade_head_creates_users_table(migrated_db):
    db_file, _factory = migrated_db
    import sqlite3

    conn = sqlite3.connect(db_file)
    try:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert "users" in tables
        assert PRE_EXISTING_TABLES.issubset(tables)

        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
        assert cols == EXPECTED_COLUMNS

        # unique index on email
        indexes = {r[1]: bool(r[2]) for r in conn.execute("PRAGMA index_list(users)")}
        assert any(unique for unique in indexes.values()), "email index must be unique"
    finally:
        conn.close()


def test_downgrade_drops_only_users(migrated_db):
    db_file, _factory = migrated_db
    run_alembic(db_file, "downgrade", "-1")

    import sqlite3

    conn = sqlite3.connect(db_file)
    try:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert "users" not in tables
        assert PRE_EXISTING_TABLES.issubset(tables)

        # seeded medicines data must be untouched by the downgrade
        count = conn.execute("SELECT COUNT(*) FROM medicines").fetchone()[0]
        assert count > 0
    finally:
        conn.close()

    # back to head: re-upgrade must be clean and re-create users
    run_alembic(db_file, "upgrade", "head")
    conn = sqlite3.connect(db_file)
    try:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert "users" in tables
    finally:
        conn.close()
