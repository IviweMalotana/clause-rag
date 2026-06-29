"""Health + readiness + public config endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import writes_protected
from app.schemas import AppConfig
from app.services.embedding import get_embedder

router = APIRouter(tags=["health"])


@router.get("/config", response_model=AppConfig)
def get_config() -> AppConfig:
    return AppConfig(
        writes_protected=writes_protected(),
        answers_enabled=bool(settings.anthropic_api_key),
        embedding_provider=get_embedder().provider,
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, str]:
    """Confirms the database is reachable and pgvector is installed."""
    db.execute(text("SELECT 1"))
    has_vector = db.execute(
        text("SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector'")
    ).scalar()
    return {"status": "ok", "pgvector": "installed" if has_vector else "missing"}
