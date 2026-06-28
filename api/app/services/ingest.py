"""Ingestion pipeline: chunk -> embed -> index, with live progress.

Progress is tracked per-document in an in-memory store that the API polls. The
demo runs a single API process, so this is the simplest honest way to surface
real chunk/embed progress to the UI without a job queue.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models import Chunk, Document
from app.services.chunking import chunk_document
from app.services.embedding import Embedder, EmbeddingCache, get_embedder

# Embed in small batches so the progress bar advances for real.
_EMBED_BATCH = 4


@dataclass
class IngestProgress:
    document_id: int
    slug: str
    stage: str  # queued | chunking | embedding | indexing | done | error
    chunks_done: int = 0
    chunks_total: int = 0
    provider: str = ""
    error: str | None = None


_PROGRESS: dict[int, IngestProgress] = {}


def get_progress(document_id: int) -> dict | None:
    p = _PROGRESS.get(document_id)
    return asdict(p) if p else None


def ingest_document(
    db: Session,
    document: Document,
    *,
    embedder: Embedder | None = None,
    cache: EmbeddingCache | None = None,
) -> IngestProgress:
    """Chunk, embed, and index a single document. Idempotent (replaces chunks)."""
    embedder = embedder or get_embedder()
    cache = cache if cache is not None else EmbeddingCache()

    progress = IngestProgress(
        document_id=document.id,
        slug=document.slug,
        stage="chunking",
        provider=embedder.provider,
    )
    _PROGRESS[document.id] = progress

    try:
        chunks = chunk_document(document.content)
        progress.chunks_total = len(chunks)
        progress.stage = "embedding"

        vectors: list[list[float]] = []
        for i in range(0, len(chunks), _EMBED_BATCH):
            batch = chunks[i : i + _EMBED_BATCH]
            vectors.extend(cache.embed_all(embedder, [c.embed_text() for c in batch]))
            progress.chunks_done = min(i + _EMBED_BATCH, len(chunks))
        cache.save()

        progress.stage = "indexing"
        db.execute(delete(Chunk).where(Chunk.document_id == document.id))
        for chunk, vector in zip(chunks, vectors, strict=True):
            db.add(
                Chunk(
                    document_id=document.id,
                    idx=chunk.idx,
                    content=chunk.content,
                    section=chunk.section,
                    page=chunk.page,
                    char_start=chunk.char_start,
                    char_end=chunk.char_end,
                    token_count=chunk.token_count,
                    embedding=vector,
                )
            )
        document.status = "indexed"
        document.num_chunks = len(chunks)
        db.commit()

        progress.stage = "done"
        return progress
    except Exception as exc:  # surface failures to the polling UI
        db.rollback()
        progress.stage = "error"
        progress.error = str(exc)
        raise


def run_ingest_job(document_id: int) -> None:
    """Background-task entrypoint: opens its own session and ingests."""
    with SessionLocal() as db:
        document = db.get(Document, document_id)
        if document is None:
            return
        try:
            ingest_document(db, document)
        except Exception:
            # Progress already records the error; swallow so the task ends.
            pass
