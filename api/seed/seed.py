"""Seed the synthetic compliance corpus.

Idempotent: upserts each document by slug. Re-running updates content in place.
The chunk + embed indexing step is added in Milestone 2 and invoked from here.

    uv run python -m seed.seed
"""

import json
from pathlib import Path

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Document

CORPUS_DIR = Path(__file__).parent / "corpus"
MANIFEST = CORPUS_DIR / "manifest.json"


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def upsert_documents() -> list[Document]:
    """Insert or update each corpus document. Returns the persisted rows."""
    entries = load_manifest()
    saved: list[Document] = []
    with SessionLocal() as db:
        for entry in entries:
            content = (CORPUS_DIR / entry["file"]).read_text(encoding="utf-8")
            doc = db.scalar(select(Document).where(Document.slug == entry["slug"]))
            if doc is None:
                doc = Document(slug=entry["slug"])
                db.add(doc)
            doc.title = entry["title"]
            doc.doc_type = entry["doc_type"]
            doc.summary = entry["summary"]
            doc.source_filename = entry["file"]
            doc.content = content
            if doc.status != "indexed":
                doc.status = "seeded"
            db.flush()
            saved.append(doc)
            print(f"  upserted document: {doc.slug} ({len(content)} chars)")
        db.commit()
        # Refresh so callers get populated ids/attributes after commit.
        for doc in saved:
            db.refresh(doc)
    return saved


def main() -> None:
    print("Seeding Clause compliance corpus...")
    docs = upsert_documents()
    print(f"Done. {len(docs)} documents in the library.")
    # Milestone 2 wires the ingestion pipeline (chunk + embed) in here.


if __name__ == "__main__":
    main()
