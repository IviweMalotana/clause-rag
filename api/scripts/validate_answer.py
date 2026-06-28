"""Validate the answer pipeline end-to-end with a stubbed model call.

Run: uv run python -m scripts.validate_answer
"""

from app.core.db import SessionLocal
from app.services.answer import generate_answer


def stub_claude_answer(system: str, user: str) -> str:
    # A grounded answer that cites sources [1] and [2].
    return (
        "A single cash-equivalent transaction at or above USD 10,000 generates a "
        "mandatory monitoring alert for analyst review [1]. Linked transactions that "
        "aggregate to that threshold within 24 hours are also flagged [2]."
    )


def stub_claude_not_supported(system: str, user: str) -> str:
    return "NOT_SUPPORTED"


def main() -> None:
    db = SessionLocal()
    from app.core.config import settings

    # Tests 1 and 3 exercise the model path; give them a dummy key so the
    # needs_key short-circuit doesn't fire (the model call itself is stubbed).
    settings.anthropic_api_key = "sk-ant-dummy-for-tests"

    print("== 1. Answered path (stubbed model, citations) ==")
    r = generate_answer(
        db,
        "What dollar amount triggers a mandatory transaction monitoring alert?",
        claude=stub_claude_answer,
    )
    print(f"status={r.status} conf={r.confidence} ({r.confidence_label}) provider={r.provider}")
    print(f"citations={[(c['marker'], c['document_slug'], c['section']) for c in r.citations]}")
    assert r.status == "answered"
    assert len(r.citations) == 2, r.citations
    assert all(c["char_end"] > c["char_start"] for c in r.citations)
    conv_id = r.conversation_id

    print("\n== 2. Guardrail: out-of-corpus question (no model call) ==")
    r2 = generate_answer(db, "What is the capital of France?", claude=stub_claude_answer)
    print(f"status={r2.status} no_answer={r2.no_answer}")
    assert r2.status == "no_answer" and r2.no_answer

    print("\n== 3. Guardrail: model judges passages insufficient ==")
    r3 = generate_answer(
        db,
        "How often are high-risk customers reviewed?",
        claude=stub_claude_not_supported,
    )
    print(f"status={r3.status} no_answer={r3.no_answer}")
    assert r3.status == "no_answer" and r3.no_answer

    print("\n== 4. needs_key path (no ANTHROPIC_API_KEY) ==")
    saved = settings.anthropic_api_key
    settings.anthropic_api_key = None
    r4 = generate_answer(db, "When is enhanced due diligence required for PEPs?")
    settings.anthropic_api_key = saved
    print(f"status={r4.status} sources={len(r4.sources)}")
    assert r4.status == "needs_key" and len(r4.sources) >= 1

    print("\n== 5. Persisted conversation reload ==")
    from app.models import Conversation

    conv = db.get(Conversation, conv_id)
    assistant = [m for m in conv.messages if m.role == "assistant"][0]
    print(f"messages={len(conv.messages)} assistant_citations={len(assistant.citations)}")
    assert len(assistant.citations) == 2

    print("\n== 6. Multi-turn follow-up carries history into the prompt ==")
    captured = {}

    def capturing_stub(system: str, user: str) -> str:
        captured["prompt"] = user
        return "Beneficial owners holding 25% or more must be verified [1]."

    r6 = generate_answer(
        db,
        "What about for businesses?",
        conversation_id=conv_id,
        claude=capturing_stub,
    )
    has_history = "Conversation so far:" in captured.get("prompt", "")
    print(f"status={r6.status} history_in_prompt={has_history}")
    assert r6.status == "answered" and has_history

    print("\nAll answer-pipeline checks passed.")


if __name__ == "__main__":
    main()
