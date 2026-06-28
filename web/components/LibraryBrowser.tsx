"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DocumentSummary } from "@/lib/api";
import { DocTypeBadge, EmptyState } from "@/components/ui";

function DocumentCard({ doc }: { doc: DocumentSummary }) {
  const indexed = doc.status === "indexed";
  return (
    <Link
      href={`/library/${doc.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-all hover:border-border-strong hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center justify-between">
        <DocTypeBadge type={doc.doc_type} />
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-faint">
          <span className={`h-1.5 w-1.5 rounded-full ${indexed ? "bg-success" : "bg-faint"}`} />
          {indexed ? `${doc.num_chunks} passages indexed` : "Seeded"}
        </span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-ink group-hover:text-accent-ink">
        {doc.title}
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">{doc.summary}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
        Open document
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

export function LibraryBrowser({ docs }: { docs: DocumentSummary[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("All");

  const types = useMemo(
    () => ["All", ...Array.from(new Set(docs.map((d) => d.doc_type)))],
    [docs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      const matchesType = type === "All" || d.doc_type === type;
      const matchesQuery =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.doc_type.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [docs, query, type]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-accent sm:max-w-xs">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                type === t
                  ? "bg-accent-soft text-accent-ink"
                  : "border border-border bg-surface text-muted hover:bg-surface-2"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching documents"
          description="Try a different search term or filter."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((doc) => (
            <DocumentCard key={doc.slug} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
