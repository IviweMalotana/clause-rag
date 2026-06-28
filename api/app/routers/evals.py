"""Trust/eval endpoint: runs the curated eval set against the live retriever."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.evals_data import EVAL_SET, GUARDRAIL_EXAMPLES
from app.models import Document
from app.schemas import EvalItem, EvalReport, GuardrailItem, Source
from app.services.embedding import get_embedder
from app.services.retrieval import gate_for, retrieve

router = APIRouter(tags=["evals"])


def _to_source(rc) -> Source:
    return Source(
        marker=None,
        chunk_id=rc.chunk_id,
        document_id=rc.document_id,
        document_slug=rc.document_slug,
        document_title=rc.document_title,
        section=rc.section,
        page=rc.page,
        char_start=rc.char_start,
        char_end=rc.char_end,
        content=rc.content,
        score=round(rc.score, 3),
    )


@router.get("/evals", response_model=EvalReport)
def run_evals(db: Session = Depends(get_db)) -> EvalReport:
    embedder = get_embedder()
    gate = gate_for(embedder)

    title_by_slug = {
        slug: title
        for slug, title in db.execute(select(Document.slug, Document.title)).all()
    }

    items: list[EvalItem] = []
    passed = 0
    for ev in EVAL_SET:
        results = retrieve(db, ev["question"], embedder=embedder, top_k=3)
        top = results[0]
        ok = (
            top.document_slug == ev["expected_slug"]
            and ev["expected_section"].lower() in (top.section or "").lower()
        )
        passed += ok
        items.append(
            EvalItem(
                question=ev["question"],
                expected_document=title_by_slug.get(ev["expected_slug"], ev["expected_slug"]),
                expected_section=ev["expected_section"],
                passed=ok,
                retrieved=_to_source(top),
            )
        )

    guardrail: list[GuardrailItem] = []
    for q in GUARDRAIL_EXAMPLES:
        results = retrieve(db, q, embedder=embedder, top_k=1)
        top_score = results[0].score if results else 0.0
        guardrail.append(
            GuardrailItem(question=q, declined=top_score < gate, top_score=round(top_score, 3))
        )

    return EvalReport(
        passed=passed,
        total=len(EVAL_SET),
        embedding_provider=embedder.provider,
        min_score=round(gate, 3),
        items=items,
        guardrail=guardrail,
    )
