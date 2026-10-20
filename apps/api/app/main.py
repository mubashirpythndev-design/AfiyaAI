"""Afiya AI — FastAPI Backend Application Entrypoint.
Author / Developer: Mubashir (Lead Developer)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ocr, medicines, chat, price_check, auth, admin, cabinet, feedback
from app.routers import duplication, store
from app.models.schemas import HealthResponse
from sqlalchemy import select, func
from app.db.database import init_db, is_sqlite, async_session, Medicine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Afiya AI Backend starting up...")
    logger.info(f"Frontend URL: {settings.frontend_url}")
    logger.info(f"Gemini model: {settings.gemini_chat_model}")
    from app.services.ocr_models import OCR_MODEL_CHAIN
    logger.info("OCR model: %s; fallbacks: %s; thinking: %s", OCR_MODEL_CHAIN[0], ",".join(OCR_MODEL_CHAIN[1:]), settings.ocr_thinking_level)
    logger.info(f"Database: {'SQLite (local testing)' if is_sqlite else 'PostgreSQL (Neon Live)'}")

    # SQLite development may create tables; production schema changes are explicit migrations.
    if is_sqlite:
        await init_db()
    from sqlalchemy import inspect
    from app.db.database import Base, engine
    async with engine.connect() as connection:
        def missing_schema(sync_connection):
            inspector = inspect(sync_connection)
            missing = []
            for table in Base.metadata.sorted_tables:
                if not inspector.has_table(table.name):
                    missing.append(table.name)
                    continue
                present = {c["name"] for c in inspector.get_columns(table.name)}
                missing.extend(f"{table.name}.{c.name}" for c in table.columns if c.name not in present)
            return missing
        missing = await connection.run_sync(missing_schema)
    if missing:
        raise RuntimeError("Database migration required: " + ", ".join(missing))
    # Seed only local SQLite automatically. Never synchronize a live catalog on startup.
    if is_sqlite:
        from app.db.seed_data import seed_if_empty
        await seed_if_empty()
        from app.db.seed_mrp import seed_mrp_reference
        from app.db.seed_knowledge import seed_knowledge_chunks
        from app.db.seed_alerts import seed_drap_alerts
        from app.db.seed_marketplace import seed_marketplace
        async with async_session() as db:
            await seed_mrp_reference(db)
            await seed_knowledge_chunks(db)
            await seed_drap_alerts(db)
            await seed_marketplace(db)

    logger.info("Afiya AI Backend startup complete.")
    yield
    logger.info("Afiya AI Backend shutting down.")


app = FastAPI(
    title="Afiya AI API",
    description="AI-powered medicine assistant backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
cors_origins = [
    settings.frontend_url.rstrip("/"),
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
cors_origins = list(dict.fromkeys(filter(None, cors_origins)))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)  # email + password auth (JWT bearer tokens)
app.include_router(admin.router)  # admin-only views (RBAC-gated)
app.include_router(cabinet.router)  # digital medicine cabinet
app.include_router(feedback.router)  # community healthcare feedback & survey
app.include_router(ocr.router)
app.include_router(medicines.router)
app.include_router(chat.router)
app.include_router(price_check.router)  # Phase-1 Feature A: MRP checker
app.include_router(duplication.router)
app.include_router(store.router)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy")
