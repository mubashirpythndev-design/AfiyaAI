"""Application configuration loaded from environment variables."""

import logging

from pydantic_settings import BaseSettings

# Insecure placeholder ONLY for local dev/tests. Production MUST set
# JWT_SECRET in the environment (.env is gitignored; never commit secrets).
INSECURE_DEV_JWT_SECRET = "dev-insecure-change-me"


class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = "postgresql+asyncpg://localhost:5432/afiyadb"
    frontend_url: str = "http://localhost:3000"
    embedding_dimensions: int = 768

    gemini_chat_model: str = "models/gemini-3.5-flash-lite"
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

    model_config = {"env_file": [".env", "../../.env"], "env_file_encoding": "utf-8"}


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
