"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


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

    model_config = {"env_file": [".env", "../../.env"], "env_file_encoding": "utf-8"}


settings = Settings()
