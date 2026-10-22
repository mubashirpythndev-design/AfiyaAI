"""Application configuration loaded from environment variables."""

import logging

from pydantic_settings import BaseSettings
from pydantic import Field

# Insecure placeholder ONLY for local dev/tests. Production MUST set
# JWT_SECRET in the environment (.env is gitignored; never commit secrets).
INSECURE_DEV_JWT_SECRET = "dev-insecure-change-me"


class Settings(BaseSettings):
    app_env: str = "development"
    ai_timeout_seconds: float = 28.0
    ocr_request_timeout_seconds: float = Field(default=35.0, gt=0, le=180)
    ocr_total_timeout_seconds: float = Field(default=180.0, gt=0, le=600)
    # Reserve enough time for all three production models before concierge handoff.
    ocr_auto_timeout_seconds: float = Field(default=120.0, gt=0, le=180)
    ocr_auto_request_timeout_seconds: float = Field(default=35.0, gt=0, le=90)
    ocr_auto_review_timeout_seconds: float = Field(default=35.0, gt=0, le=60)
    ocr_retry_timeout_seconds: float = Field(default=35.0, gt=0, le=60)
    ocr_auto_verify_clear: bool = False
    ocr_cache_path: str = ""
    gemini_api_key: str = ""
    database_url: str = "postgresql+asyncpg://localhost:5432/afiyadb"
    frontend_url: str = "http://localhost:3000"
    embedding_dimensions: int = 768

    gemini_chat_model: str = "models/gemini-3.5-flash"
    # OCR uses the fixed ordered chain in services/ocr_models.py, independently of chat.
    gemini_ocr_model: str = Field(default="gemini-3.8-flash", min_length=1)
    gemini_ocr_fallback_models: str = "gemini-3.5-flash-lite,gemini-3.1-flash-lite"
    ocr_thinking_level: str = Field(default="medium", pattern="^(low|medium|high)$")
    gemini_embedding_model: str = "models/gemini-embedding-001"

    fuzzy_match_threshold: float = 0.85
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.6

    # Auth (email + password, JWT bearer tokens)
    jwt_secret: str = INSECURE_DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # RBAC: comma-separated admin emails (ADMIN_EMAILS). Single source of
    # truth for User.is_admin — synced on register/login. Default empty =
    # no admins.
    admin_emails: str = ""

    # Clerk Authentication
    clerk_jwks_url: str = "https://pro-alien-4201.clerk.accounts.dev/.well-known/jwks.json"
    clerk_secret_key: str = ""
    clerk_issuer: str = ""
    clerk_audience: str = ""

    model_config = {"env_file": [".env", "apps/api/.env", "../../.env"], "env_file_encoding": "utf-8"}


settings = Settings()


def get_admin_emails_set() -> set[str]:
    """Normalized, lowercased set of admin emails from ADMIN_EMAILS.

    Read at call time (not import time) so the value always reflects the
    current setting; blank entries are ignored.
    """
    return {
        entry.strip().lower()
        for entry in settings.admin_emails.split(",")
        if entry.strip()
    }

if settings.jwt_secret == INSECURE_DEV_JWT_SECRET:
    logging.warning(
        "JWT_SECRET is using the insecure dev default - set a real "
        "JWT_SECRET env var before any non-local deployment."
    )


def validate_production_settings() -> None:
    if settings.app_env.lower() in {"production", "prod"} and (
        settings.jwt_secret == INSECURE_DEV_JWT_SECRET or len(settings.jwt_secret) < 32
    ):
        raise RuntimeError("Production requires a non-default JWT_SECRET of at least 32 characters")
