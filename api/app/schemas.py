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


class IngestStatus(BaseModel):
    """Live progress of an ingestion job, polled by the upload view."""

    document_id: int
    slug: str
    stage: str
    chunks_done: int
    chunks_total: int
    provider: str
    error: str | None = None


class Source(BaseModel):
    """A retrieved passage with the locator needed to highlight it in the reader."""

    marker: int | None = None
    chunk_id: int
    document_id: int
    document_slug: str
    document_title: str
    section: str | None
    page: int | None
    char_start: int
    char_end: int
    content: str
    score: float


class AskRequest(BaseModel):
    question: str
    conversation_id: int | None = None


class AnswerResponse(BaseModel):
    status: str  # answered | no_answer | needs_key | error
    conversation_id: int
    message_id: int | None
    question: str
    answer: str
    no_answer: bool
    confidence: float
    confidence_label: str
    provider: str
    model: str
    citations: list[Source]
    sources: list[Source]
    error: str | None = None


class EvalItem(BaseModel):
    question: str
    expected_document: str
    expected_section: str
    passed: bool
    retrieved: Source


class GuardrailItem(BaseModel):
    question: str
    declined: bool
    top_score: float


class EvalReport(BaseModel):
    passed: int
    total: int
    embedding_provider: str
    min_score: float
    items: list[EvalItem]
    guardrail: list[GuardrailItem]


class AppConfig(BaseModel):
    """Public app config the web can read without auth."""

    writes_protected: bool
    answers_enabled: bool
    embedding_provider: str


class ConversationListItem(BaseModel):
    id: int
    title: str
    message_count: int
    updated_at: datetime


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    confidence: float | None
    no_answer: bool
    citations: list[Source]


class ConversationOut(BaseModel):
    id: int
    title: str
    messages: list[MessageOut]
