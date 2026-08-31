"""Afiya AI — Live Neon Database Provisioner and Data Seeder.

Connects to Neon PostgreSQL, enables pgvector extension, creates all tables,
and seeds verified medicines, official MRP references, and knowledge chunks.
Author / Developer: Mubashir (Lead Developer)
"""

import asyncio
import logging
from sqlalchemy import text
from app.db.database import engine, async_session, Base, init_db
from app.db.seed_data import seed_if_empty
from app.db.seed_mrp import seed_mrp_reference
from app.db.seed_knowledge import seed_knowledge_chunks
from app.db.seed_embeddings import seed_chunk_embeddings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("provision_neon")

async def provision():
    logger.info("Starting live Neon Database provisioning...")

    async with engine.begin() as conn:
        # 1. Enable pgvector extension
        logger.info("Enabling pgvector extension on Neon PostgreSQL...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        # 2. Check and clean any legacy non-matching starter tables
        logger.info("Checking schema compatibility...")
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
        existing_tables = [row[0] for row in res.fetchall()]
        
        # If legacy single-table 'medicines' with integer ID exists without 'sources' or 'medicine_prices', drop it
        if "medicines" in existing_tables and "sources" not in existing_tables:
            logger.info("Dropping legacy starter table 'medicines' on Neon...")
            await conn.execute(text("DROP TABLE IF EXISTS medicines CASCADE;"))
            await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))

    # 3. Create all tables with exact Afiya AI schema
    logger.info("Creating all database tables on Neon...")
    await init_db()

    # 4. Seed Medicines & Sources
    logger.info("Seeding verified medicines and pharmacies...")
    await seed_if_empty()

    # 5. Seed Official MRP References
    logger.info("Seeding DRAP official MRP baseline prices...")
    async with async_session() as db:
        await seed_mrp_reference(db)

    # 6. Seed Knowledge Chunks
    logger.info("Seeding medical knowledge chunks for RAG...")
    async with async_session() as db:
        await seed_knowledge_chunks(db)

    # 7. Generate and store pgvector embeddings
    logger.info("Generating and storing 768-dim Gemini vector embeddings into Neon pgvector...")
    async with async_session() as db:
        report = await seed_chunk_embeddings(db)
        logger.info("Embedding Report: created=%d, skipped=%d, total=%d", 
                    report.created, report.skipped_existing, report.chunks_processed)

    # 8. Stamp Alembic to head
    logger.info("Stamping alembic head...")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));"))
        await conn.execute(text("DELETE FROM alembic_version;"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('0008');"))

    logger.info("✨ Neon Database is 100% provisioned, seeded, embedded with pgvector, and LIVE!")

if __name__ == "__main__":
    asyncio.run(provision())
