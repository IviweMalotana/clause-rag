"""Grounded answer generation: retrieve -> guardrail -> Claude -> cite -> persist.

The model is instructed to answer only from the numbered sources and to cite
inline with [n] markers. Two guardrails prevent ungrounded answers:
  1. A retrieval gate: if no passage clears the per-provider similarity floor,
     we never call the model and return a "not supported" answer.
  2. A prompt instruction: even with passages, the model must decline if they
     do not actually contain the answer.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Citation, Conversation, Message
from app.services.embedding import get_embedder
from app.services.retrieval import RetrievedChunk, gate_for, retrieve

NO_ANSWER_TEXT = (
    "I couldn't find support for this in the current corpus, so I won't answer. "
    "Clause only answers from cited source passages — if the documents don't "
    "cover it, the honest answer is that the corpus doesn't say."
)

SYSTEM_PROMPT = """You are Clause, a compliance copilot. You answer questions \
strictly from the numbered source passages provided, and you never use outside \
knowledge.

Rules:
- Ground every claim in the sources. After each claim, cite the passage(s) it \
comes from using inline markers like [1] or [2][3], matching the source numbers.
- Be concise and precise — the tone is that of a compliance analyst. Prefer 2–5 \
sentences. Do not include a separate "Sources" list; the markers are enough.
- Use only facts present in the sources. Do not infer beyond them.
- If the sources do not contain enough information to answer, reply with exactly \
this sentence and nothing else: "NOT_SUPPORTED".
"""

_MARKER_RE = re.compile(r"\[(\d+)\]")


@dataclass
class AnswerResult:
    status: str  # answered | no_answer | needs_key | error
    conversation_id: int
    question: str
    answer: str
    no_answer: bool
    confidence: float
    confidence_label: str
    provider: str
    model: str
    message_id: int | None = None
    citations: list[dict] = field(default_factory=list)
    sources: list[dict] = field(default_factory=list)
    error: str | None = None


def _source_block(chunks: list[RetrievedChunk]) -> str:
    lines = []
    for i, c in enumerate(chunks, start=1):
        loc = c.section or c.document_title
        lines.append(f"[{i}] ({c.document_title} — {loc})\n{c.content}")
    return "\n\n".join(lines)


def _confidence(scores: list[float], gate: float) -> tuple[float, str]:
    if not scores:
        return 0.0, "Low"
    top = max(scores)
    strong = sum(1 for s in scores if s >= gate * 1.6)
    value = max(0.0, min(1.0, 0.4 + (top - gate) * 2.5 + 0.1 * min(strong, 3)))
    label = "High" if value >= 0.75 else "Medium" if value >= 0.5 else "Low"
    return round(value, 2), label


def _source_dict(c: RetrievedChunk, marker: int | None) -> dict:
    return {
        "marker": marker,
        "chunk_id": c.chunk_id,
        "document_id": c.document_id,
        "document_slug": c.document_slug,
        "document_title": c.document_title,
        "section": c.section,
        "page": c.page,
        "char_start": c.char_start,
        "char_end": c.char_end,
        "content": c.content,
        "score": round(c.score, 3),
    }


def call_claude(system: str, user_content: str) -> str:
    """Isolated model call so the orchestration around it stays testable."""
    from anthropic import Anthropic

    client = Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def _get_or_create_conversation(
    db: Session, conversation_id: int | None, question: str
) -> Conversation:
    if conversation_id is not None:
        conv = db.get(Conversation, conversation_id)
        if conv is not None:
            return conv
    title = question.strip()[:80] or "New conversation"
    conv = Conversation(title=title)
    db.add(conv)
    db.flush()
    return conv


def generate_answer(
    db: Session,
    question: str,
    conversation_id: int | None = None,
    *,
    claude=call_claude,
) -> AnswerResult:
    embedder = get_embedder()
    gate = gate_for(embedder)
    retrieved = retrieve(db, question, embedder=embedder)
    supporting = [r for r in retrieved if r.score >= gate][: settings.answer_max_sources]

    conv = _get_or_create_conversation(db, conversation_id, question)
    db.add(Message(conversation_id=conv.id, role="user", content=question.strip()))
    db.flush()

    base = dict(
        conversation_id=conv.id,
        question=question.strip(),
        provider=embedder.provider,
        model=settings.anthropic_model,
    )

    # Guardrail 1: nothing clears the similarity floor.
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
        return AnswerResult(
            status="no_answer",
            answer=NO_ANSWER_TEXT,
            no_answer=True,
            confidence=0.0,
            confidence_label="Low",
            message_id=msg.id,
            sources=[_source_dict(r, None) for r in retrieved[:3]],
            **base,
        )

    # Answer generation requires an Anthropic key (operator-configured).
    if not settings.anthropic_api_key:
        db.commit()  # keep the user message
        return AnswerResult(
            status="needs_key",
            answer="",
            no_answer=False,
            confidence=0.0,
            confidence_label="Low",
            sources=[_source_dict(r, i + 1) for i, r in enumerate(supporting)],
            **base,
        )

    try:
        prompt = f"Question: {question.strip()}\n\nSources:\n{_source_block(supporting)}"
        text = claude(SYSTEM_PROMPT, prompt)
    except Exception as exc:
        db.commit()
        return AnswerResult(
            status="error",
            answer="",
            no_answer=False,
            confidence=0.0,
            confidence_label="Low",
            sources=[_source_dict(r, i + 1) for i, r in enumerate(supporting)],
            error=str(exc),
            **base,
        )

    # Guardrail 2: the model judged the passages insufficient.
    if text.strip().upper().startswith("NOT_SUPPORTED"):
        msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=NO_ANSWER_TEXT,
            no_answer=True,
            confidence=0.0,
        )
        db.add(msg)
        db.commit()
        return AnswerResult(
            status="no_answer",
            answer=NO_ANSWER_TEXT,
            no_answer=True,
            confidence=0.0,
            confidence_label="Low",
            message_id=msg.id,
            sources=[_source_dict(r, i + 1) for i, r in enumerate(supporting)],
            **base,
        )

    # Map the inline [n] markers actually used back to their chunks.
    used_markers = []
    for m in _MARKER_RE.findall(text):
        n = int(m)
        if 1 <= n <= len(supporting) and n not in used_markers:
            used_markers.append(n)

    cited_scores = [supporting[n - 1].score for n in used_markers] or [
        s.score for s in supporting
    ]
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

    citations = []
    for n in used_markers:
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

    conv.title = conv.title or question.strip()[:80]
    db.commit()

    return AnswerResult(
        status="answered",
        answer=text,
        no_answer=False,
        confidence=confidence,
        confidence_label=label,
        message_id=msg.id,
        citations=citations,
        sources=[_source_dict(r, i + 1) for i, r in enumerate(supporting)],
        **base,
    )
