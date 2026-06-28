"""Document library endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Document
from app.schemas import DocumentDetail, DocumentSummary

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentSummary])
def list_documents(db: Session = Depends(get_db)) -> list[Document]:
    return list(db.scalars(select(Document).order_by(Document.title)).all())


@router.get("/{slug}", response_model=DocumentDetail)
def get_document(slug: str, db: Session = Depends(get_db)) -> Document:
    doc = db.scalar(select(Document).where(Document.slug == slug))
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
