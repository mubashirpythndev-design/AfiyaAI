"""Chat RAG step 2 tests: seed_embeddings refuses gracefully on SQLite.

pgvector requires Postgres/Neon; locally the seeder must be a strict
no-op (nothing written, clear message, no exception). The actual vector
seeding is verified against Neon at deploy time.
"""

import pytest_asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.database import Base, Embedding, KnowledgeChunk
from app.db.seed_knowledge import seed_knowledge_chunks
from app.db.seed_embeddings import (
    SQLITE_REFUSAL_MESSAGE,
    main,
    seed_chunk_embeddings,
)


@pytest_asyncio.fixture
async def seeded_chunks_db(backfilled_db):
    """Backfilled fixture DB + ORM-created tables + 40 verified_profile
    chunks (proves the refusal holds EVEN WHEN chunks exist to embed)."""
    db_file, factory = backfilled_db
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

    async with factory() as db:
        await seed_knowledge_chunks(db)
    return db_file, factory


async def test_seed_embeddings_refuses_on_sqlite(seeded_chunks_db):
    db_file, factory = seeded_chunks_db
    async with factory() as db:
        chunks = (
            await db.execute(select(func.count()).select_from(KnowledgeChunk))
        ).scalar()
        assert chunks == 40  # preconditions: chunks exist to (not) embed

        report = await seed_chunk_embeddings(db)

        assert report.refused is True
        assert report.created == 0
        assert report.skipped_existing == 0
        assert report.chunks_processed == 0

        embeddings = (
            await db.execute(select(func.count()).select_from(Embedding))
        ).scalar()
        assert embeddings == 0, "refusal must write nothing"


async def test_seed_embeddings_main_prints_refusal(capsys):
    """The CLI entry point exits 0 with a clear message on SQLite."""
    await main()  # uses the real local (SQLite) session — refusal path
    out = capsys.readouterr().out
    assert SQLITE_REFUSAL_MESSAGE.split(".")[0] in out
