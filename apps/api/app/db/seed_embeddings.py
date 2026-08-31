"""Idempotent embedding seeder for verified_profile knowledge chunks.

Step 2 of the chat-RAG plan (companion to seed_knowledge). For every
``knowledge_chunks`` row of type ``verified_profile``, compute a Gemini
embedding of the EXISTING chunk text (no new text is authored) and store
it in ``embeddings`` exactly as ``rag_service``'s pgvector query expects:
a row per chunk linked via ``chunk_id``, vector in the ``embedding``
column (added by alembic revision 0004, PostgreSQL only).

Deliberately NOT wired into app startup:
- Requires PostgreSQL + pgvector (migration 0004 applied on Neon).
- Costs Gemini embedding API calls; run once per environment:

    python -m app.db.seed_embeddings

On SQLite (local dev) this seeder refuses gracefully: pgvector cannot
run there, and rag_service already uses its plain-SQL fallback. Exits 0
without writing anything.

Idempotency: chunks that already have an embeddings row are skipped, so
re-runs create 0 rows. The ORM ``Embedding`` model has no vector column
on purpose (keeps the SQLite fallback untouched), so inserts use raw
parameterized SQL with the pgvector cast.
"""

import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.seed_knowledge import CHUNK_TYPE
from app.services.rag_service import generate_embedding

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingSeedReport:
    created: int = 0
    skipped_existing: int = 0
    chunks_processed: int = 0
    refused: bool = False  # True when run against a non-PostgreSQL DB


SQLITE_REFUSAL_MESSAGE = (
    "pgvector requires Postgres/Neon; SQLite uses the plain-SQL fallback. "
    "Nothing to do — exiting without writing anything."
)


async def seed_chunk_embeddings(db: AsyncSession) -> EmbeddingSeedReport:
    """Embed every verified_profile chunk on PostgreSQL; refuse elsewhere."""
    report = EmbeddingSeedReport()

    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect != "postgresql":
        report.refused = True
        logger.info("Embedding seeding skipped: dialect is '%s'.", dialect)
        return report

    # Fail fast with a clear message if migration 0004 was not applied.
    column_check = await db.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name = 'embeddings' AND column_name = 'embedding'"
        )
    )
    if column_check.scalar() == 0:
        raise RuntimeError(
            "embeddings.embedding column not found. Run "
            "'alembic upgrade head' (migration 0004) on this Postgres "
            "database before seeding embeddings."
        )

    result = await db.execute(
        text(
            "SELECT id, content FROM knowledge_chunks "
            "WHERE chunk_type = :chunk_type ORDER BY id"
        ),
        {"chunk_type": CHUNK_TYPE},
    )
    chunks = result.fetchall()

    for chunk in chunks:
        report.chunks_processed += 1

        existing = await db.execute(
            text("SELECT id FROM embeddings WHERE chunk_id = :chunk_id"),
            {"chunk_id": chunk.id},
        )
        if existing.first() is not None:
            report.skipped_existing += 1
            continue

        vector = await generate_embedding(chunk.content)
        embedding_str = "[" + ",".join(str(v) for v in vector) + "]"
        await db.execute(
            text(
                "INSERT INTO embeddings (id, chunk_id, embedding) "
                "VALUES (:id, :chunk_id, CAST(:embedding AS vector))"
            ),
            {
                "id": str(uuid.uuid4()),
                "chunk_id": chunk.id,
                "embedding": embedding_str,
            },
        )
        report.created += 1

    await db.commit()
    logger.info(
        "Embedding seed complete: %d created, %d skipped (existing), "
        "%d chunks processed.",
        report.created,
        report.skipped_existing,
        report.chunks_processed,
    )
    return report


async def main() -> None:
    from app.db.database import async_session

    async with async_session() as db:
        report = await seed_chunk_embeddings(db)
        if report.refused:
            print(SQLITE_REFUSAL_MESSAGE)
            return
        print(
            f"Embedding seed done: {report.created} created, "
            f"{report.skipped_existing} skipped (existing), "
            f"{report.chunks_processed} chunks processed."
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import asyncio

    asyncio.run(main())
