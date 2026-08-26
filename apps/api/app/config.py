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

    gemini_chat_model: str = "gemini-3.6-flash"
    gemini_embedding_model: str = "text-embedding-004"

    fuzzy_match_threshold: float = 0.85
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.6

    # Auth (email + password, JWT bearer tokens)
    jwt_secret: str = INSECURE_DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    model_config = {"env_file": [".env", "../../.env"], "env_file_encoding": "utf-8"}


settings = Settings()

if settings.jwt_secret == INSECURE_DEV_JWT_SECRET:
    logging.warning(
        "JWT_SECRET is using the insecure dev default - set a real "
        "JWT_SECRET env var before any non-local deployment."
    )
