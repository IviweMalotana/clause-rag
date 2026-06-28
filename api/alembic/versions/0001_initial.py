"""initial schema: documents, chunks (pgvector), conversations, messages, citations

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-28
"""

from collections.abc import Sequence

import pgvector.sqlalchemy
import sqlalchemy as sa

from alembic import op
from app.core.config import settings

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBED_DIM = settings.embedding_dim


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("doc_type", sa.String(length=80), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("source_filename", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="seeded"),
        sa.Column("num_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_documents_slug", "documents", ["slug"], unique=True)

    op.create_table(
        "chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("idx", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("section", sa.String(length=300), nullable=True),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("char_start", sa.Integer(), nullable=False),
        sa.Column("char_end", sa.Integer(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(EMBED_DIM), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    # Approximate-nearest-neighbour index for cosine similarity search.
    op.execute(
        "CREATE INDEX ix_chunks_embedding_hnsw ON chunks "
        "USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "title",
            sa.String(length=300),
            nullable=False,
            server_default="New conversation",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Integer(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("no_answer", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "citations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            sa.Integer(),
            sa.ForeignKey("chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("marker", sa.Integer(), nullable=False),
        sa.Column("snippet", sa.Text(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("ix_citations_message_id", "citations", ["message_id"])


def downgrade() -> None:
    op.drop_table("citations")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
    op.drop_table("chunks")
    op.drop_index("ix_documents_slug", table_name="documents")
    op.drop_table("documents")
