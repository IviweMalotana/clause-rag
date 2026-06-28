"""Chunk: an embedded, citable passage of a Document."""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db import Base


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    # Ordinal position of this chunk within its document.
    idx: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    # Human-facing locator, e.g. "Section 3.2 — Customer Risk Rating".
    section: Mapped[str | None] = mapped_column(String(300), nullable=True)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Character offsets into Document.content — power the reader highlight.
    char_start: Mapped[int] = mapped_column(Integer)
    char_end: Mapped[int] = mapped_column(Integer)
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dim), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    document: Mapped["Document"] = relationship(back_populates="chunks")  # noqa: F821
