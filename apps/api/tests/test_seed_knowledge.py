"""Chat RAG step 1 tests: verified_profile knowledge seeder (spec 08 safe).

Covers:
- Seeder idempotency on (medicine_id, chunk_type) + provenance source row.
- Chunk text composed ONLY from verified DB fields + controlled class gloss.
- CLASS_GLOSS coverage of every distinct medicines.category value, with a
  neutral fallback for unmapped categories.
"""

from sqlalchemy import select, func

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.database import Base, KnowledgeChunk, Medicine, Source
from app.db.seed_knowledge import (
    CHUNK_TYPE,
    CLASS_GLOSS,
    CLASS_GLOSS_FALLBACK,
    KNOWLEDGE_SOURCE_NAME,
    build_profile_text,
    seed_knowledge_chunks,
)


@pytest_asyncio.fixture
async def knowledge_db(backfilled_db):
    """Backfilled fixture DB + the ORM-created tables.

    knowledge_chunks/embeddings exist in real environments via
    init_db()'s create_all (no migration owns them), so mirror that here.
    """
    db_file, factory = backfilled_db
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    return db_file, factory


async def test_knowledge_seed_idempotent_and_provenance(knowledge_db):
    db_file, factory = knowledge_db
    async with factory() as db:
        first = await seed_knowledge_chunks(db)
        n_meds = (
            await db.execute(select(func.count()).select_from(Medicine))
        ).scalar()
        assert first.chunks_inserted >= n_meds
        assert first.source_created is True

        # Second run must skip everything, never duplicate.
        second = await seed_knowledge_chunks(db)
        assert second.chunks_inserted == 0
        assert second.chunks_skipped_existing == first.chunks_inserted

        total = (
            await db.execute(select(func.count()).select_from(KnowledgeChunk))
        ).scalar()
        assert total == first.chunks_inserted, "re-run must not duplicate chunks"

        # Exactly one verified_profile chunk per medicine.
        dupes = (
            await db.execute(
                select(KnowledgeChunk.medicine_id, func.count())
                .where(KnowledgeChunk.chunk_type == CHUNK_TYPE)
                .group_by(KnowledgeChunk.medicine_id)
                .having(func.count() > 1)
            )
        ).all()
        assert dupes == []

        # Provenance: single source row, structured_db, honest name.
        src = (
            await db.execute(
                select(Source).where(Source.name == KNOWLEDGE_SOURCE_NAME)
            )
        ).scalar_one()
        assert src.source_type == "structured_db"
        assert src.url is None
        chunk_src = (
            await db.execute(
                select(Source.name)
                .join(KnowledgeChunk, KnowledgeChunk.source_id == Source.id)
                .limit(1)
            )
        ).scalar()
        assert chunk_src == KNOWLEDGE_SOURCE_NAME


async def test_profile_text_only_verified_fields(knowledge_db):
    db_file, factory = knowledge_db
    async with factory() as db:
        await seed_knowledge_chunks(db)
        row = (
            await db.execute(
                select(KnowledgeChunk, Medicine)
                .join(Medicine, KnowledgeChunk.medicine_id == Medicine.id)
                .where(
                    Medicine.brand_name == "Panadol",
                    KnowledgeChunk.chunk_type == CHUNK_TYPE,
                )
            )
        ).one()
        chunk, med = row
        assert chunk.chunk_type == CHUNK_TYPE
        # Composed strictly from verified fields + class gloss.
        assert "Panadol is a brand of Paracetamol" in chunk.content
        assert "DRAP registration: 004052" in chunk.content
        assert med.manufacturer in chunk.content
        assert CLASS_GLOSS[med.category] in chunk.content
        # Verified profile type
        assert chunk.chunk_type == "verified_profile"



async def test_class_gloss_covers_every_category(knowledge_db):
    db_file, factory = knowledge_db
    async with factory() as db:
        cats = (
            await db.execute(select(Medicine.category).distinct())
        ).scalars().all()
        assert cats, "fixture must carry categories"
        for cat in cats:
            assert cat in CLASS_GLOSS, f"unmapped category: {cat}"


def test_build_profile_text_uses_fallback_for_unmapped_category():
    med = Medicine(
        brand_name="X", generic_name="Y", strength="1mg",
        dosage_form="Tablet", manufacturer="M", category="Brand New Class",
        drap_reg_no="999999",
    )
    text = build_profile_text(med)
    assert CLASS_GLOSS_FALLBACK in text
    assert "Brand New Class" in text
