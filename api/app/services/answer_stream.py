"""Streaming variant of generate_answer.

Yields Server-Sent Events:
  meta      — { conversation_id, supporting: Source[], provider, model }
  needs_key — { } (and stops; client falls back to non-streaming behavior)
  no_answer — { answer } (and stops)
  delta     — { text } (one or more, as the model streams)
  done      — { message_id, citations: Source[], confidence, confidence_label }
  error     — { error } (then stops)

The retrieval, guardrails, and persistence match generate_answer so behavior is
consistent across the two endpoints.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Citation, Message
from app.services.answer import (
    _MARKER_RE,
    NO_ANSWER_TEXT,
    SYSTEM_PROMPT,
    _confidence,
    _get_or_create_conversation,
    _source_block,
    _source_dict,
)
from app.services.embedding import get_embedder
from app.services.retrieval import gate_for, retrieve


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def stream_answer(db: Session, question: str, conversation_id: int | None = None) -> Iterator[str]:
    embedder = get_embedder()
    gate = gate_for(embedder)

    conv = _get_or_create_conversation(db, conversation_id, question)
    history = [(m.role, m.content) for m in conv.messages if m.role in ("user", "assistant")]

    retrieval_query = question.strip()
    if history and len(question.split()) <= 6:
        last_user = next((c for r, c in reversed(history) if r == "user"), None)
        if last_user:
            retrieval_query = f"{last_user} {question.strip()}"

    retrieved = retrieve(db, retrieval_query, embedder=embedder)
    supporting = [r for r in retrieved if r.score >= gate][: settings.answer_max_sources]

    db.add(Message(conversation_id=conv.id, role="user", content=question.strip()))
    db.flush()

    yield _sse(
        "meta",
        {
            "conversation_id": conv.id,
            "provider": embedder.provider,
            "model": settings.anthropic_model,
            "supporting": [_source_dict(r, i + 1) for i, r in enumerate(supporting)],
            "retrieved": [_source_dict(r, None) for r in retrieved[:3]],
        },
    )

    # Guardrail: nothing clears the floor.
    if not supporting:
        msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=NO_ANSWER_TEXT,
            no_answer=True,
            confidence=0.0,
        )
        db.add(msg)
        db.commit()
        yield _sse("no_answer", {"answer": NO_ANSWER_TEXT, "message_id": msg.id})
        return

    # Streaming requires a key. Without one, surface the supporting passages.
    if not settings.anthropic_api_key:
        db.commit()
        yield _sse("needs_key", {})
        return

    history_text = ""
    if history:
        turns = [
            f"{'User' if role == 'user' else 'Clause'}: {content}"
            for role, content in history[-6:]
        ]
        history_text = "Conversation so far:\n" + "\n".join(turns) + "\n\n"
    prompt = (
        f"{history_text}Question: {question.strip()}\n\n"
        f"Sources:\n{_source_block(supporting)}"
    )

    parts: list[str] = []
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.anthropic_api_key)
        with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for chunk in stream.text_stream:
                if not chunk:
                    continue
                parts.append(chunk)
                yield _sse("delta", {"text": chunk})
    except Exception as exc:
        db.rollback()
        yield _sse("error", {"error": str(exc)})
        return

    text = "".join(parts).strip()
    if text.upper().startswith("NOT_SUPPORTED"):
        msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=NO_ANSWER_TEXT,
            no_answer=True,
            confidence=0.0,
        )
        db.add(msg)
        db.commit()
        yield _sse("no_answer", {"answer": NO_ANSWER_TEXT, "message_id": msg.id})
        return

    used: list[int] = []
    for m in _MARKER_RE.findall(text):
        n = int(m)
        if 1 <= n <= len(supporting) and n not in used:
            used.append(n)

    cited_scores = [supporting[n - 1].score for n in used] or [s.score for s in supporting]
    confidence, label = _confidence(cited_scores, gate)

    msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=text,
        no_answer=False,
        confidence=confidence,
    )
    db.add(msg)
    db.flush()

    citations: list[dict] = []
    for n in used:
        c = supporting[n - 1]
        db.add(
            Citation(
                message_id=msg.id,
                chunk_id=c.chunk_id,
                document_id=c.document_id,
                marker=n,
                snippet=c.content,
                score=c.score,
            )
        )
        citations.append(_source_dict(c, n))
    db.commit()

    yield _sse(
        "done",
        {
            "message_id": msg.id,
            "citations": citations,
            "confidence": confidence,
            "confidence_label": label,
        },
    )
