"""Ingestion endpoints: upload a document, then poll its chunk/embed progress."""

import re

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Document
from app.schemas import DocumentSummary, IngestStatus
from app.services.ingest import get_progress, run_ingest_job

router = APIRouter(prefix="/ingest", tags=["ingest"])

_ALLOWED_SUFFIXES = (".md", ".markdown", ".txt")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "document"


def _unique_slug(db: Session, base: str) -> str:
    slug = base
    n = 2
    while db.scalar(select(Document.id).where(Document.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
    return slug


@router.post("", response_model=DocumentSummary, status_code=201)
async def ingest(
    background: BackgroundTasks,
    title: str = Form(...),
    doc_type: str = Form("Uploaded document"),
    summary: str = Form(""),
    file: UploadFile | None = None,
    text: str | None = Form(None),
    db: Session = Depends(get_db),
) -> Document:
    """Create a document from an uploaded file or pasted text, then index it."""
    if file is not None:
        if not (file.filename or "").lower().endswith(_ALLOWED_SUFFIXES):
            raise HTTPException(
                status_code=415,
                detail="Only .md, .markdown, or .txt files are supported.",
            )
        raw = await file.read()
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="File must be UTF-8 text.") from exc
    elif text:
        content = text
    else:
        raise HTTPException(status_code=400, detail="Provide a file or text to ingest.")

    if not content.strip():
        raise HTTPException(status_code=400, detail="Document content is empty.")

    doc = Document(
        slug=_unique_slug(db, slugify(title)),
        title=title.strip(),
        doc_type=doc_type.strip() or "Uploaded document",
        summary=(summary.strip() or content.strip().split("\n", 1)[0][:300]),
        source_filename=(file.filename if file else "pasted-text.md"),
        content=content,
        status="queued",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background.add_task(run_ingest_job, doc.id)
    return doc


@router.get("/{document_id}/status", response_model=IngestStatus)
def ingest_status(document_id: int, db: Session = Depends(get_db)) -> IngestStatus:
    progress = get_progress(document_id)
    if progress is not None:
        return IngestStatus(**progress)

    # No live progress (e.g. API restarted): fall back to the persisted status.
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    stage = "done" if doc.status == "indexed" else doc.status
    return IngestStatus(
        document_id=doc.id,
        slug=doc.slug,
        stage=stage,
        chunks_done=doc.num_chunks,
        chunks_total=doc.num_chunks,
        provider="",
        error=None,
    )
