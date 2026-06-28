"""Application settings, loaded from environment / .env."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Look for a .env in the api/ dir first, then the repo root.
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+psycopg://clause:clause@localhost:5432/clause"

    @field_validator("database_url", mode="after")
    @classmethod
    def _use_psycopg_driver(cls, v: str) -> str:
        # Railway (and most providers) supply a plain postgresql:// URL, which
        # SQLAlchemy maps to psycopg2. We ship psycopg3, so pin that driver.
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        return v

    # Anthropic (answer generation)
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"

    # OpenAI (embeddings only)
    openai_api_key: str | None = None
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # Retrieval / guardrail. retrieval_min_score is an optional override; when
    # unset, the embedder's per-provider calibrated min_score is used.
    retrieval_min_score: float | None = None
    retrieval_top_k: int = 6
    # Max passages to ground an answer on (subset of retrieved that clear the gate).
    answer_max_sources: int = 5

    # API. Both localhost and 127.0.0.1 are allowed so either dev host works.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    api_port: int = 8000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
