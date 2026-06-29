"""Retrieval + the curated eval set (live against pgvector)."""

import pytest

from app.evals_data import EVAL_SET, GUARDRAIL_EXAMPLES
from app.services.embedding import get_embedder
from app.services.retrieval import gate_for, retrieve


@pytest.mark.parametrize("item", EVAL_SET, ids=lambda i: i["question"][:40])
def test_eval_item_ranks_expected_passage_first(seeded_corpus, db, item):
    results = retrieve(db, item["question"], top_k=3)
    top = results[0]
    assert top.document_slug == item["expected_slug"], (
        f"expected {item['expected_slug']}, got {top.document_slug}"
    )
    assert item["expected_section"].lower() in (top.section or "").lower(), (
        f"expected section containing '{item['expected_section']}', got '{top.section}'"
    )


@pytest.mark.parametrize("question", GUARDRAIL_EXAMPLES)
def test_guardrail_examples_fall_below_threshold(seeded_corpus, db, question):
    embedder = get_embedder()
    gate = gate_for(embedder)
    top = retrieve(db, question, top_k=1)[0]
    assert top.score < gate, (
        f"out-of-corpus query scored {top.score:.3f} (>= {gate}); guardrail wouldn't fire"
    )
