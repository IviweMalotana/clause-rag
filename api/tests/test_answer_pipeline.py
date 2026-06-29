"""End-to-end answer pipeline with a stubbed model call."""

import pytest

from app.core.config import settings
from app.models import Conversation
from app.services.answer import generate_answer


@pytest.fixture
def with_dummy_key():
    """Pretend a key is set so the model path runs; the stub does the work."""
    prev = settings.anthropic_api_key
    settings.anthropic_api_key = "sk-ant-test-dummy"
    yield
    settings.anthropic_api_key = prev


def _stub_with_citations(_system: str, _user: str) -> str:
    return (
        "A single cash-equivalent transaction at or above USD 10,000 generates a "
        "mandatory monitoring alert for analyst review [1]. Linked transactions "
        "that aggregate to that threshold within 24 hours are also flagged [2]."
    )


def _stub_not_supported(_system: str, _user: str) -> str:
    return "NOT_SUPPORTED"


def test_answered_path_parses_citations_and_persists(seeded_corpus, db, with_dummy_key):
    result = generate_answer(
        db,
        "What dollar amount triggers a mandatory transaction monitoring alert?",
        claude=_stub_with_citations,
    )
    assert result.status == "answered"
    assert len(result.citations) == 2
    assert {c["marker"] for c in result.citations} == {1, 2}
    # Citations carry exact chunk offsets used by the reader highlight.
    for cit in result.citations:
        assert cit["char_end"] > cit["char_start"]

    conv = db.get(Conversation, result.conversation_id)
    assistants = [m for m in conv.messages if m.role == "assistant"]
    assert len(assistants) == 1
    assert len(assistants[0].citations) == 2


def test_guardrail_short_circuits_before_model(seeded_corpus, db, with_dummy_key):
    calls = {"n": 0}

    def must_not_call(_system, _user):
        calls["n"] += 1
        return "should not be called"

    result = generate_answer(
        db, "What is the capital of France?", claude=must_not_call
    )
    assert result.status == "no_answer"
    assert result.no_answer is True
    assert calls["n"] == 0, "model must not be called when retrieval gate fails"


def test_model_not_supported_response_becomes_no_answer(seeded_corpus, db, with_dummy_key):
    result = generate_answer(
        db,
        "How often are high-risk customers reviewed?",
        claude=_stub_not_supported,
    )
    assert result.status == "no_answer"
    assert result.no_answer is True


def test_needs_key_when_no_anthropic_key(seeded_corpus, db):
    # No with_dummy_key fixture here: key stays unset.
    result = generate_answer(
        db, "When is enhanced due diligence required for PEPs?"
    )
    assert result.status == "needs_key"
    assert len(result.sources) >= 1, "needs_key still returns retrieved sources"


def test_multi_turn_history_threads_through_prompt(seeded_corpus, db, with_dummy_key):
    first = generate_answer(
        db,
        "What dollar amount triggers a mandatory transaction monitoring alert?",
        claude=_stub_with_citations,
    )

    captured = {}

    def capture(_system: str, user: str) -> str:
        captured["user"] = user
        return "Follow-up answer [1]."

    follow = generate_answer(
        db,
        "What about for businesses?",
        conversation_id=first.conversation_id,
        claude=capture,
    )
    assert follow.status == "answered"
    assert "Conversation so far:" in captured["user"]
