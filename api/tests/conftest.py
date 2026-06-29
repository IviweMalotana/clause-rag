"""Shared pytest fixtures.

Uses a dedicated Postgres database (clause_test) created via the local cluster
so tests exercise the real pgvector + SQLAlchemy + Alembic path. Each test gets
a clean schema via Alembic upgrade/downgrade.
"""

from __future__ import annotations

import os
import subprocess

import pytest

# Point app config at the test database BEFORE any app modules import settings.
TEST_DB_URL = os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://clause:clause@127.0.0.1:5432/clause_test",
)
# Never call OpenAI/Anthropic from tests.
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("ANTHROPIC_API_KEY", "")


def _psql(sql: str, db: str = "postgres") -> None:
    subprocess.run(
        ["psql", "-h", "127.0.0.1", "-U", "clause", "-d", db, "-tAc", sql],
        env={**os.environ, "PGPASSWORD": "clause"},
        check=True,
        capture_output=True,
    )


@pytest.fixture(scope="session", autouse=True)
def _ensure_test_db():
    """Create clause_test if it doesn't exist, and reset its schema each session."""
    # Create db if needed (psql returns silently if it already exists).
    try:
        _psql(
            "CREATE DATABASE clause_test OWNER clause",
            db="postgres",
        )
    except subprocess.CalledProcessError:
        # already exists
        pass

    # Apply migrations from scratch.
    from app.core.db import engine  # noqa: WPS433 — imported here so env vars apply

    engine.dispose()
    subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        env=os.environ,
        check=True,
        capture_output=True,
    )
    yield


@pytest.fixture
def db():
    """A clean session per test, with all rows truncated between tests."""
    from sqlalchemy import text

    from app.core.db import SessionLocal

    session = SessionLocal()
    # Truncate in dependency order; reset identity so ids stay stable per test.
    session.execute(
        text(
            "TRUNCATE citations, messages, conversations, chunks, documents "
            "RESTART IDENTITY CASCADE"
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded_corpus(db):
    """Load + index the synthetic corpus for retrieval/answer tests."""
    from sqlalchemy import select

    from app.models import Document
    from seed.seed import index_documents, upsert_documents

    upsert_documents()
    slugs = [d.slug for d in db.scalars(select(Document)).all()]
    index_documents(slugs)
    return slugs


@pytest.fixture
def client():
    """FastAPI TestClient with the same app config the tests just set up."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
