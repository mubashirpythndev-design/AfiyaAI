"""Afiya AI - FastAPI Backend Application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ocr, medicines, chat, price_check, alert_check
from app.models.schemas import HealthResponse
from app.db.database import init_db, is_sqlite, async_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Afiya AI Backend starting up...")
    logger.info(f"Frontend URL: {settings.frontend_url}")
    logger.info(f"Gemini model: {settings.gemini_chat_model}")
    logger.info(f"Database: {'SQLite (local testing)' if is_sqlite else 'PostgreSQL'}")
    await init_db()
    if is_sqlite:
        from app.db.seed_data import seed_if_empty
        await seed_if_empty()
        # Phase-1 Feature A: DRAP-notified MRP baseline (idempotent).
        from app.db.seed_mrp import seed_mrp_reference
        async with async_session() as db:
            await seed_mrp_reference(db)
        # Phase-1 Feature B: DEMO-DATA alert rows (idempotent).
        from app.db.seed_alerts import seed_drap_alerts
        async with async_session() as db:
            await seed_drap_alerts(db)
        # Chat RAG step 1: verified-profile knowledge chunks (idempotent).
        # Non-fatal by design: a seeding failure must never block app boot.
        from app.db.seed_knowledge import seed_knowledge_chunks
        try:
            async with async_session() as db:
                await seed_knowledge_chunks(db)
        except Exception as exc:
            logger.warning("Knowledge seeding failed (non-fatal): %s", exc)
    logger.info("Database initialized.")
    yield
    logger.info("Afiya AI Backend shutting down.")


app = FastAPI(
    title="Afiya AI API",
    description="AI-powered medicine assistant backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(ocr.router)
app.include_router(medicines.router)
app.include_router(chat.router)
app.include_router(price_check.router)  # Phase-1 Feature A: MRP checker
app.include_router(alert_check.router)  # Phase-1 Feature B: alert checker


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy")
