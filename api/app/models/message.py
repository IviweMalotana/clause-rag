"""Message and Citation: an answer and the chunks that grounded it."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    # "user" or "assistant".
    role: Mapped[str] = mapped_column(String(20))
    # Assistant content carries inline [1][2] citation markers.
    content: Mapped[str] = mapped_column(Text)
    # 0..1 model/retrieval confidence; null for user messages.
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # True when the guardrail fired: corpus did not support an answer.
    no_answer: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")  # noqa: F821
    citations: Mapped[list["Citation"]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="Citation.marker",
    )


class Citation(Base):
    """Links one inline [n] marker in a message to the chunk it grounds."""

    __tablename__ = "citations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    chunk_id: Mapped[int] = mapped_column(ForeignKey("chunks.id", ondelete="CASCADE"))
    # Denormalized for easy "open the document" links.
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    # The [n] marker number shown inline, 1-based.
    marker: Mapped[int] = mapped_column(Integer)
    # Exact passage text surfaced in the sources panel.
    snippet: Mapped[str] = mapped_column(Text)
    # Cosine similarity at retrieval time.
    score: Mapped[float] = mapped_column(Float, default=0.0)

    message: Mapped["Message"] = relationship(back_populates="citations")
