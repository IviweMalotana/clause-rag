"use client";

import Link from "next/link";
import type { AnswerResponse, Source } from "@/lib/api";

const MARKER_RE = /(\[\d+\])/g;

// Clean a chunk for preview display: drop markdown heading markers and bold
// syntax and collapse whitespace. Offsets used by "View passage" are unaffected.
function cleanPreview(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Render answer text with inline [n] markers as clickable citation pills.
export function CitedText({
  text,
  validMarkers,
  onCite,
}: {
  text: string;
  validMarkers: Set<number>;
  onCite: (marker: number) => void;
}) {
  const parts = text.split(MARKER_RE);
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-[1.75] text-ink">
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (m && validMarkers.has(Number(m[1]))) {
          const n = Number(m[1]);
          return (
            <button
              key={i}
              className="citation-marker"
              onClick={() => onCite(n)}
              aria-label={`View source ${n}`}
            >
              {n}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export function ConfidenceMeter({ answer }: { answer: AnswerResponse }) {
  const declined = answer.status === "no_answer";
  const pct = Math.round(answer.confidence * 100);
  const tone =
    answer.confidence_label === "High"
      ? "text-success"
      : answer.confidence_label === "Medium"
        ? "text-warn"
        : "text-muted";
  const bar =
    answer.confidence_label === "High"
      ? "bg-success"
      : answer.confidence_label === "Medium"
        ? "bg-warn"
        : "bg-faint";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Answer confidence
        </span>
        <span className={`text-xs font-semibold ${declined ? "text-muted" : tone}`}>
          {declined ? "Declined" : answer.confidence_label}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${declined ? "bg-faint" : bar} transition-all`}
          style={{ width: declined ? "0%" : `${Math.max(pct, 4)}%` }}
        />
      </div>
      <p className="mt-2.5 text-[11px] leading-snug text-faint">
        {declined
          ? "No passage cleared the similarity threshold."
          : `Grounded in ${answer.citations.length || answer.sources.length} source ${
              (answer.citations.length || answer.sources.length) === 1
                ? "passage"
                : "passages"
            }. Embeddings: ${answer.provider}.`}
      </p>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  // Normalize the cosine score to a small visual bar (display only).
  const pct = Math.max(6, Math.min(100, Math.round(score * 220)));
  return (
    <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SourceCard({
  source,
  active,
  domId,
}: {
  source: Source;
  active: boolean;
  domId?: string;
}) {
  const href = `/library/${source.document_slug}?cs=${source.char_start}&ce=${source.char_end}${
    source.marker ? `&m=${source.marker}` : ""
  }`;
  return (
    <div
      id={domId}
      className={`scroll-mt-4 rounded-xl border bg-surface p-3.5 transition-all ${
        active ? "border-accent ring-2 ring-accent/20" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        {source.marker != null && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-accent-soft px-1 font-mono text-[11px] font-semibold text-accent-ink">
            {source.marker}
          </span>
        )}
        <span className="truncate text-xs font-semibold text-ink">
          {source.document_title}
        </span>
      </div>
      {source.section && (
        <p className="mt-1 text-[11px] font-medium text-muted">{source.section}</p>
      )}
      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
        {cleanPreview(source.content)}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ScoreBar score={source.score} />
          <span className="font-mono text-[10px] text-faint">
            {source.score.toFixed(2)}
          </span>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink hover:underline"
        >
          View passage
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
