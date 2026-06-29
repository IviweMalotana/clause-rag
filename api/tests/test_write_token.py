"""DEMO_WRITE_TOKEN gates ingestion writes; reads remain open."""

import pytest

from app.core.config import settings


@pytest.fixture
def protected_writes():
    prev = settings.demo_write_token
    settings.demo_write_token = "secret-test-token"
    yield
    settings.demo_write_token = prev


def test_writes_open_by_default(seeded_corpus, client):
    res = client.post(
        "/api/ingest",
        data={"title": "Open Doc", "doc_type": "Uploaded document"},
        files={"file": ("open.md", b"# Open\n\n## 1. Body\n\nHello.\n", "text/markdown")},
    )
    assert res.status_code == 201


def test_writes_reject_without_token(seeded_corpus, client, protected_writes):
    res = client.post(
        "/api/ingest",
        data={"title": "Guarded", "doc_type": "Uploaded document"},
        files={"file": ("g.md", b"# g\n\nx\n", "text/markdown")},
    )
    assert res.status_code == 401


def test_writes_reject_wrong_token(seeded_corpus, client, protected_writes):
    res = client.post(
        "/api/ingest",
        headers={"X-Clause-Token": "wrong"},
        data={"title": "Guarded", "doc_type": "Uploaded document"},
        files={"file": ("g.md", b"# g\n\nx\n", "text/markdown")},
    )
    assert res.status_code == 401


def test_writes_accept_correct_token(seeded_corpus, client, protected_writes):
    res = client.post(
        "/api/ingest",
        headers={"X-Clause-Token": "secret-test-token"},
        data={"title": "Allowed", "doc_type": "Uploaded document"},
        files={"file": ("a.md", b"# a\n\n## 1. Section\n\nBody.\n", "text/markdown")},
    )
    assert res.status_code == 201


def test_reads_remain_open_when_protected(seeded_corpus, client, protected_writes):
    assert client.get("/api/documents").status_code == 200
    assert client.get("/api/evals").status_code == 200
    assert client.get("/api/config").json()["writes_protected"] is True
