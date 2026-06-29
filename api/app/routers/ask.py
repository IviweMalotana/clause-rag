"""Ask endpoint (grounded answers) and conversation retrieval."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Chunk, Conversation, Document, Message
from app.schemas import (
    AnswerResponse,
    AskRequest,
    ConversationListItem,
    ConversationOut,
    MessageOut,
    Source,
)
from app.services.answer import generate_answer
from app.services.answer_stream import stream_answer

router = APIRouter(tags=["ask"])


@router.post("/ask", response_model=AnswerResponse)
def ask(payload: AskRequest, db: Session = Depends(get_db)) -> AnswerResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")
    result = generate_answer(db, question, payload.conversation_id)
    return AnswerResponse(**asdict(result))


def _citation_sources(db: Session, message: Message) -> list[Source]:
    if not message.citations:
        return []
    chunk_ids = [c.chunk_id for c in message.citations]
    rows = db.execute(
        select(Chunk, Document)
        .join(Document, Document.id == Chunk.document_id)
        .where(Chunk.id.in_(chunk_ids))
    ).all()
    by_chunk = {chunk.id: (chunk, doc) for chunk, doc in rows}

    sources: list[Source] = []
    for cit in message.citations:
        pair = by_chunk.get(cit.chunk_id)
        if pair is None:
            continue
        chunk, doc = pair
        sources.append(
            Source(
                marker=cit.marker,
                chunk_id=chunk.id,
                document_id=doc.id,
                document_slug=doc.slug,
                document_title=doc.title,
                section=chunk.section,
                page=chunk.page,
                char_start=chunk.char_start,
                char_end=chunk.char_end,
                content=cit.snippet,
                score=cit.score,
            )
        )
    return sources


@router.post("/ask/stream")
def ask_stream(payload: AskRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    """Server-Sent Events stream for an answer (delta tokens as they arrive)."""
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    def gen():
        try:
            yield from stream_answer(db, question, payload.conversation_id)
        finally:
            db.close()

    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)


def _markdown_export(conv: Conversation, sources_by_msg: dict[int, list[Source]]) -> str:
    lines: list[str] = [f"# {conv.title}\n"]
    for m in conv.messages:
        if m.role == "user":
            lines.append(f"\n## Question\n\n{m.content}\n")
        else:
            lines.append("\n## Answer\n")
            if m.no_answer:
                lines.append("> The corpus did not support an answer; Clause declined.\n")
            lines.append(f"{m.content}\n")
            srcs = sources_by_msg.get(m.id, [])
            if srcs:
                lines.append("\n### Sources\n")
                for s in srcs:
                    loc = s.section or s.document_title
                    lines.append(
                        f"- **[{s.marker}] {s.document_title}** — {loc} "
                        f"(score {s.score:.2f})\n"
                        f"  > {s.content.strip()[:400]}\n"
                    )
    lines.append(
        "\n---\n_Exported from Clause. Synthetic demo corpus._\n"
    )
    return "".join(lines)


@router.get("/conversations/{conversation_id}/export", response_class=PlainTextResponse)
def export_conversation(conversation_id: int, db: Session = Depends(get_db)) -> PlainTextResponse:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    sources_by_msg = {
        m.id: _citation_sources(db, m) for m in conv.messages if m.role == "assistant"
    }
    body = _markdown_export(conv, sources_by_msg)
    fname = f"clause-conversation-{conv.id}.md"
    return PlainTextResponse(
        body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(db: Session = Depends(get_db)) -> list[ConversationListItem]:
    """Recent conversations (for the chat history sidebar)."""
    msg_count = func.count(Message.id).label("message_count")
    rows = (
        db.execute(
            select(Conversation, msg_count)
            .join(Message, Message.conversation_id == Conversation.id, isouter=True)
            .group_by(Conversation.id)
            .order_by(Conversation.updated_at.desc())
            .limit(40)
        )
        .all()
    )
    return [
        ConversationListItem(
            id=conv.id,
            title=conv.title,
            message_count=count or 0,
            updated_at=conv.updated_at,
        )
        for conv, count in rows
    ]


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)) -> Response:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return Response(status_code=204)


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)) -> ConversationOut:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            confidence=m.confidence,
            no_answer=m.no_answer,
            citations=_citation_sources(db, m),
        )
        for m in conv.messages
    ]
    return ConversationOut(id=conv.id, title=conv.title, messages=messages)
