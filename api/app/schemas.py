"""Pydantic response/request schemas for the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentSummary(BaseModel):
    """Library-list view of a document."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    doc_type: str
    summary: str
    status: str
    num_chunks: int
    updated_at: datetime


class DocumentDetail(DocumentSummary):
    """Full document, including source text for the reader."""

    content: str


class ChunkRef(BaseModel):
    """A retrieved/citable chunk with its locator for highlighting."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    document_slug: str
    document_title: str
    section: str | None
    page: int | None
    char_start: int
    char_end: int
    content: str
