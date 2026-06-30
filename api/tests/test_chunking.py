"""Chunking guarantees: structure, offset fidelity, size bounds."""

from app.services.chunking import MAX_TOKENS, chunk_document, count_tokens

SAMPLE = """# Sample Policy

Header front matter.

## 1. Purpose

This policy establishes how things work.

## 2. Scope

This applies broadly to many cases.
"""


def test_chunks_have_verbatim_offsets():
    """The invariant the citation highlight depends on."""
    chunks = chunk_document(SAMPLE)
    assert chunks, "expected at least one chunk"
    for c in chunks:
        assert SAMPLE[c.char_start : c.char_end] == c.content, (
            f"chunk {c.idx} content doesn't match its offsets"
        )


def test_sections_become_labels():
    chunks = chunk_document(SAMPLE)
    sections = {c.section for c in chunks}
    assert "Overview" in sections
    assert any("Section 1" in (s or "") for s in sections)
    assert any("Section 2" in (s or "") for s in sections)


def test_chunks_are_ordered_and_disjoint():
    chunks = chunk_document(SAMPLE)
    prev_end = 0
    for c in chunks:
        assert c.char_start >= prev_end, "chunks must not overlap"
        prev_end = c.char_end


def test_long_section_splits_under_token_budget():
    paragraph = "Northwind Pay applies this control to a wide variety of cases. " * 30
    text = "# Big\n\n## 1. Long Section\n\n" + paragraph + "\n\n" + paragraph
    chunks = chunk_document(text)
    section_chunks = [c for c in chunks if c.section and "Long" in c.section]
    assert len(section_chunks) >= 2, "very long section should split"
    for c in section_chunks:
        assert c.token_count <= MAX_TOKENS * 1.5, (
            f"chunk {c.idx} too large: {c.token_count} tokens"
        )


def test_count_tokens_is_positive():
    assert count_tokens("") == 0
    assert count_tokens("hello world") > 0
