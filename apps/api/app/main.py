"""Afiya AI — FastAPI Backend Application Entrypoint.
Author / Developer: Mubashir (Lead Developer)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ocr, medicines, chat, price_check, auth, admin, cabinet, feedback
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
    logger.info(f"Database: {'SQLite (local testing)' if is_sqlite else 'PostgreSQL (Neon Live)'}")

    # Fast startup check: if database is already populated, skip slow remote network loops
    med_count = 0
    try:
        async with async_session() as db:
            result = await db.execute(select(func.count()).select_from(Medicine))
            med_count = result.scalar() or 0
    except Exception:
        # Tables may not exist yet on clean DB
        med_count = 0

    if med_count >= 102:
        logger.info(f"Live database verified with {med_count} medicines. Ready immediately.")
    else:
        logger.info(f"Database contains {med_count} medicines. Initializing schemas & seeding...")
        await init_db()
        # Idempotent seeders (medicines, MRP baseline, knowledge chunks)
        from app.db.seed_data import seed_if_empty
        await seed_if_empty()
        from app.db.seed_mrp import seed_mrp_reference
        async with async_session() as db:
            await seed_mrp_reference(db)
        from app.db.seed_knowledge import seed_knowledge_chunks
        try:
            async with async_session() as db:
                await seed_knowledge_chunks(db)
        except Exception as exc:
            logger.warning("Knowledge seeding failed (non-fatal): %s", exc)

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


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy")
