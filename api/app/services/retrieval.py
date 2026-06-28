"""Vector retrieval over the chunk index via pgvector cosine distance."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Chunk, Document
from app.services.embedding import Embedder, get_embedder


@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    document_slug: str
    document_title: str
    section: str | None
    page: int | None
    char_start: int
    char_end: int
    content: str
    score: float  # cosine similarity in [−1, 1]; higher is closer


def gate_for(embedder: Embedder) -> float:
    """Effective min-score gate: config override, else the embedder default."""
    if settings.retrieval_min_score is not None:
        return settings.retrieval_min_score
    return embedder.min_score


def retrieve(
    db: Session,
    query: str,
    *,
    embedder: Embedder | None = None,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    embedder = embedder or get_embedder()
    top_k = top_k or settings.retrieval_top_k

    query_vec = embedder.embed_one(query)
    distance = Chunk.embedding.cosine_distance(query_vec).label("distance")
    rows = db.execute(
        select(Chunk, Document, distance)
        .join(Document, Document.id == Chunk.document_id)
        .order_by(distance)
        .limit(top_k)
    ).all()

    return [
        RetrievedChunk(
            chunk_id=chunk.id,
            document_id=doc.id,
            document_slug=doc.slug,
            document_title=doc.title,
            section=chunk.section,
            page=chunk.page,
            char_start=chunk.char_start,
            char_end=chunk.char_end,
            content=chunk.content,
            score=float(1.0 - distance),
        )
        for chunk, doc, distance in rows
    ]
