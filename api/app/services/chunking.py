"""Section-aware chunking that preserves exact source character offsets.

Each chunk's `content` is a verbatim slice of the document text, and
[char_start, char_end) indexes back into that same text. That guarantee is what
makes the citation-to-passage highlight in the reader exact rather than fuzzy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Target ceiling per chunk. Most policy sections fall under this and stay whole;
# longer sections are split on paragraph boundaries.
MAX_TOKENS = 320

_HEADING_RE = re.compile(r"^(#{1,3})\s+(.*)$")


@dataclass
class Chunk:
    idx: int
    content: str
    section: str | None
    page: int | None
    char_start: int
    char_end: int
    token_count: int

    def embed_text(self) -> str:
        """Text actually sent to the embedder.

        We prepend the section label for retrieval context without changing the
        stored content or its offsets.
        """
        if self.section:
            return f"{self.section}\n\n{self.content}"
        return self.content


def count_tokens(text: str) -> int:
    """Estimate token count without a network-dependent tokenizer.

    Blends a word/punctuation count with the classic ~4-chars-per-token rule.
    This only needs to be close enough to size chunks and show an indicative
    number, and it keeps ingestion free of any model-download dependency.
    """
    words = len(re.findall(r"\w+|[^\w\s]", text))
    return max(words, len(text) // 4)


@dataclass
class _Section:
    label: str | None
    start: int
    end: int


def _split_sections(content: str) -> list[_Section]:
    """Split the document into sections at `##`/`###` headings.

    The text before the first such heading (title + front matter) becomes an
    "Overview" section.
    """
    lines = content.split("\n")
    sections: list[_Section] = []
    offset = 0
    cur_label: str | None = "Overview"
    cur_start = 0

    for line in lines:
        line_start = offset
        offset += len(line) + 1
        m = _HEADING_RE.match(line)
        # Only break on level-2/3 headings; the level-1 title stays in Overview.
        if m and len(m.group(1)) >= 2:
            if line_start > cur_start:
                sections.append(_Section(cur_label, cur_start, line_start))
            cur_label = _format_label(m.group(2))
            cur_start = line_start

    sections.append(_Section(cur_label, cur_start, len(content)))
    return sections


def _format_label(heading_text: str) -> str:
    """Turn "4. Customer Risk Rating" into "Section 4 — Customer Risk Rating"."""
    m = re.match(r"^(\d+)\.\s+(.*)$", heading_text.strip())
    if m:
        return f"Section {m.group(1)} — {m.group(2)}"
    return heading_text.strip()


def _trim_range(content: str, start: int, end: int) -> tuple[int, int]:
    """Tighten a range so it excludes leading/trailing whitespace."""
    while start < end and content[start].isspace():
        start += 1
    while end > start and content[end - 1].isspace():
        end -= 1
    return start, end


def _paragraph_ranges(content: str, start: int, end: int) -> list[tuple[int, int]]:
    """Offsets of blank-line-separated paragraphs within [start, end)."""
    ranges: list[tuple[int, int]] = []
    pos = start
    para_start = None
    # Walk line by line tracking offsets.
    while pos < end:
        nl = content.find("\n", pos, end)
        line_end = nl if nl != -1 else end
        line = content[pos:line_end]
        if line.strip() == "":
            if para_start is not None:
                ranges.append(_trim_range(content, para_start, pos))
                para_start = None
        elif para_start is None:
            para_start = pos
        pos = line_end + 1
    if para_start is not None:
        ranges.append(_trim_range(content, para_start, end))
    return [r for r in ranges if r[1] > r[0]]


def chunk_document(content: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    idx = 0
    for section in _split_sections(content):
        s, e = _trim_range(content, section.start, section.end)
        if e <= s:
            continue
        whole = content[s:e]
        if count_tokens(whole) <= MAX_TOKENS:
            chunks.append(_make_chunk(idx, content, s, e, section.label))
            idx += 1
            continue

        # Section too large: pack paragraphs greedily under the token budget.
        groups: list[tuple[int, int]] = []
        cur_start: int | None = None
        cur_end = s
        for ps, pe in _paragraph_ranges(content, s, e):
            candidate = content[(cur_start if cur_start is not None else ps) : pe]
            if cur_start is not None and count_tokens(candidate) > MAX_TOKENS:
                groups.append((cur_start, cur_end))
                cur_start = ps
            elif cur_start is None:
                cur_start = ps
            cur_end = pe
        if cur_start is not None:
            groups.append((cur_start, cur_end))

        for gs, ge in groups:
            chunks.append(_make_chunk(idx, content, gs, ge, section.label))
            idx += 1

    return chunks


def _make_chunk(
    idx: int, content: str, start: int, end: int, label: str | None
) -> Chunk:
    text = content[start:end]
    return Chunk(
        idx=idx,
        content=text,
        section=label,
        page=None,
        char_start=start,
        char_end=end,
        token_count=count_tokens(text),
    )
