"""HTTP-layer tests via FastAPI TestClient."""


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_db_reports_pgvector(client):
    res = client.get("/api/health/db")
    assert res.status_code == 200
    assert res.json()["pgvector"] == "installed"


def test_config_endpoint(client):
    res = client.get("/api/config")
    assert res.status_code == 200
    body = res.json()
    # Default config in tests: no keys, no write token.
    assert body == {
        "writes_protected": False,
        "answers_enabled": False,
        "embedding_provider": "hashed",
    }


def test_documents_list_and_detail(seeded_corpus, client):
    res = client.get("/api/documents")
    assert res.status_code == 200
    slugs = {d["slug"] for d in res.json()}
    assert "aml-policy" in slugs

    res = client.get("/api/documents/aml-policy")
    assert res.status_code == 200
    doc = res.json()
    assert doc["title"].startswith("Anti-Money Laundering")
    assert "Transaction Monitoring" in doc["content"]


def test_documents_404(client):
    res = client.get("/api/documents/does-not-exist")
    assert res.status_code == 404


def test_ask_returns_sources_without_key(seeded_corpus, client):
    res = client.post(
        "/api/ask",
        json={"question": "What dollar amount triggers a mandatory transaction monitoring alert?"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "needs_key"
    assert len(body["sources"]) > 0
    top = body["sources"][0]
    assert top["document_slug"] == "aml-policy"


def test_ask_no_answer_guardrail(seeded_corpus, client):
    res = client.post("/api/ask", json={"question": "What is the capital of France?"})
    body = res.json()
    assert body["status"] == "no_answer"
    assert body["no_answer"] is True


def test_conversations_list_and_delete(seeded_corpus, client):
    # Create a conversation by asking.
    ask = client.post(
        "/api/ask",
        json={"question": "How long must compliance records be retained?"},
    ).json()
    cid = ask["conversation_id"]

    listed = client.get("/api/conversations").json()
    assert any(c["id"] == cid for c in listed)

    res = client.delete(f"/api/conversations/{cid}")
    assert res.status_code == 204

    listed_after = client.get("/api/conversations").json()
    assert not any(c["id"] == cid for c in listed_after)


def test_conversation_export_returns_markdown(seeded_corpus, client):
    ask = client.post(
        "/api/ask",
        json={"question": "How long must compliance records be retained?"},
    ).json()
    cid = ask["conversation_id"]

    res = client.get(f"/api/conversations/{cid}/export")
    assert res.status_code == 200
    assert "text/markdown" in res.headers["content-type"]
    assert "## Question" in res.text


def test_evals_endpoint_passes_all(seeded_corpus, client):
    res = client.get("/api/evals")
    assert res.status_code == 200
    body = res.json()
    assert body["passed"] == body["total"], (
        f"eval regressions: {body['passed']}/{body['total']}"
    )
    assert all(g["declined"] for g in body["guardrail"])
