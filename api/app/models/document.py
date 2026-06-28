"""Document: a source compliance file in the corpus."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    # Human-facing category, e.g. "AML Policy", "KYC Procedure".
    doc_type: Mapped[str] = mapped_column(String(80))
    # One-line description shown in the library list.
    summary: Mapped[str] = mapped_column(String(500), default="")
    source_filename: Mapped[str] = mapped_column(String(300), default="")
    # Full source text. Citation offsets index into this string.
    content: Mapped[str] = mapped_column(Text)
    # "seeded" once ingested, "indexed" once chunked+embedded.
    status: Mapped[str] = mapped_column(String(40), default="seeded")
    num_chunks: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    chunks: Mapped[list["Chunk"]] = relationship(  # noqa: F821
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="Chunk.idx",
    )
