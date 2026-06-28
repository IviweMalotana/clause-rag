"""Health + readiness endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db

router = APIRouter(tags=["health"])


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
