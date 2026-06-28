"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  parseMarkdown,
  splitSegmentByHighlight,
  type Block,
  type Segment,
} from "@/lib/markdown";

export interface HighlightRange {
  start: number;
  end: number;
}

function renderSegments(
  segments: Segment[],
  highlight: HighlightRange | null,
  blockHasHighlight: { current: boolean },
) {
  return segments.map((seg, i) => {
    const parts =
      highlight && seg.rawEnd > highlight.start && seg.rawStart < highlight.end
        ? splitSegmentByHighlight(seg, highlight.start, highlight.end)
        : [{ text: seg.text, marked: false }];

    const inner = parts.map((p, j) => {
      if (p.marked) blockHasHighlight.current = true;
      return p.marked ? (
        <mark key={j} className="passage-highlight">
          {p.text}
        </mark>
      ) : (
        <span key={j}>{p.text}</span>
      );
    });

    return seg.bold ? (
      <strong key={i} className="font-semibold text-ink">
        {inner}
      </strong>
    ) : (
      <span key={i}>{inner}</span>
    );
  });
}

export function DocumentReader({
  content,
  highlight = null,
}: {
  content: string;
  highlight?: HighlightRange | null;
}) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlight && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);

  // Find the first block that intersects the highlight so we can attach the
  // scroll target and anchor id to it.
  const firstHighlightedIndex = useMemo(() => {
    if (!highlight) return -1;
    return blocks.findIndex(
      (b) =>
        blockEnd(b, content) > highlight.start && b.rawStart < highlight.end,
    );
  }, [blocks, highlight, content]);

  return (
    <article className="text-[15px] leading-[1.75] text-ink-soft">
      {blocks.map((block, idx) => {
        const flag = { current: false };
        const nodes = renderSegments(block.segments, highlight, flag);
        const isTarget = idx === firstHighlightedIndex;
        const ref = isTarget ? targetRef : undefined;

        if (block.kind === "heading") {
          const cls =
            block.level === 1
              ? "mt-0 mb-4 text-2xl font-semibold tracking-tight text-ink"
              : block.level === 2
                ? "mt-8 mb-2.5 text-lg font-semibold tracking-tight text-ink"
                : "mt-6 mb-2 text-[15px] font-semibold text-ink";
          const Tag = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <div key={idx} ref={ref} id={isTarget ? "passage" : undefined}>
              <Tag className={cls}>{nodes}</Tag>
            </div>
          );
        }
        return (
          <p
            key={idx}
            ref={ref}
            id={isTarget ? "passage" : undefined}
            className="mb-4"
          >
            {nodes}
          </p>
        );
      })}
    </article>
  );
}

function blockEnd(block: Block, content: string): number {
  // Approximate block end by the last segment's raw end (headings/paragraphs).
  const segs = block.segments;
  return segs.length ? segs[segs.length - 1].rawEnd : content.length;
}
