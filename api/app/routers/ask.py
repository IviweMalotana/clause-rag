"""Ask endpoint (grounded answers) and conversation retrieval."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Chunk, Conversation, Document, Message
from app.schemas import AnswerResponse, AskRequest, ConversationOut, MessageOut, Source
from app.services.answer import generate_answer

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
