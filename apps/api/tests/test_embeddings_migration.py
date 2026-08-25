"""Chat RAG step 2 tests: migration 0004 on SQLite is a strict NO-OP.

pgvector cannot run on SQLite, so migration 0004 is dialect-guarded.
These tests prove the local-dev guarantee:
- upgrade to head does not touch the embeddings schema (no vector column
  appears) and leaves every existing table intact,
- downgrade to 0003 and to base is equally clean,
- existing rows survive every direction.

The PostgreSQL behaviour (CREATE EXTENSION vector + ADD COLUMN
embedding vector(768)) is verified against Neon at deploy time.
"""

import asyncio

from sqlalchemy import create_engine, inspect, text

from conftest import create_pre_migration_db, run_alembic

EMBEDDING_COLUMNS = {"id", "chunk_id", "created_at"}


def _tables(engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def _embedding_columns(engine) -> set[str]:
    with engine.connect() as conn:
        return {c["name"] for c in inspect(conn).get_columns("embeddings")}


def test_migration_0004_noop_on_sqlite(tmp_path):
    db_file = tmp_path / "pgvector_noop.db"
    asyncio.run(create_pre_migration_db(db_file))

    url = f"sqlite:///{db_file}"
    engine = create_engine(url, connect_args={"check_same_thread": False})

    # init_db() create_all owns embeddings/knowledge_chunks (no migration
    # does) — mirror the real environment before running alembic.
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE knowledge_chunks ("
                "id VARCHAR(36) PRIMARY KEY, "
                "medicine_id VARCHAR(36) NOT NULL REFERENCES medicines(id), "
                "content TEXT NOT NULL, "
                "source_id VARCHAR(36) NOT NULL REFERENCES sources(id), "
                "chunk_type VARCHAR(50) NOT NULL, "
                "created_at DATETIME, updated_at DATETIME)"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE embeddings ("
                "id VARCHAR(36) PRIMARY KEY, "
                "chunk_id VARCHAR(36) NOT NULL REFERENCES knowledge_chunks(id), "
                "created_at DATETIME)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO medicines (id, brand_name, generic_name, "
                "dosage_form, strength, registration_info) VALUES "
                "('canary-1', 'Canary', 'Canarycin', 'Tablet', '10mg', '999999')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO knowledge_chunks (id, medicine_id, content, "
                "source_id, chunk_type) VALUES "
                "('chunk-1', 'canary-1', 'Canary facts.', "
                "(SELECT id FROM sources LIMIT 1), 'verified_profile')"
            )
        )

    # --- Upgrade to head (0001..0004): SQLite NO-OP for 0004 ---
    run_alembic(db_file, "upgrade", "head")
    assert _embedding_columns(engine) == EMBEDDING_COLUMNS, (
        "0004 must be a NO-OP on SQLite — no vector column may appear"
    )
    for table in (
        "medicines", "sources", "medicine_prices", "mrp_reference",
        "drap_alerts", "knowledge_chunks", "embeddings",
    ):
        assert table in _tables(engine)

    # --- Downgrade to 0003, then base: still clean ---
    run_alembic(db_file, "downgrade", "0003")
    assert _embedding_columns(engine) == EMBEDDING_COLUMNS
    assert "drap_alerts" in _tables(engine), "0003 table must survive 0004 downgrade"

    run_alembic(db_file, "downgrade", "base")
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT brand_name FROM medicines WHERE id = 'canary-1'")
        ).one()
        chunk = conn.execute(
            text("SELECT content FROM knowledge_chunks WHERE id = 'chunk-1'")
        ).one()
    assert row.brand_name == "Canary"  # data survives full rollback
    assert chunk.content == "Canary facts."

    # --- Re-upgrade: idempotent, still a NO-OP on SQLite ---
    run_alembic(db_file, "upgrade", "head")
    assert _embedding_columns(engine) == EMBEDDING_COLUMNS

    engine.dispose()
