"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  ApiError,
  getIngestStatus,
  ingestDocument,
  type IngestStatus,
} from "@/lib/api";
import { PageHeader } from "@/components/ui";

const DOC_TYPES = [
  "AML Policy",
  "KYC Procedure",
  "Security Checklist",
  "Operations Policy",
  "Uploaded document",
];

const STAGES: { key: string; label: string }[] = [
  { key: "chunking", label: "Chunking" },
  { key: "embedding", label: "Embedding" },
  { key: "indexing", label: "Indexing" },
];

function stageIndex(stage: string): number {
  if (stage === "queued") return -1;
  if (stage === "done") return STAGES.length;
  return STAGES.findIndex((s) => s.key === stage);
}

export default function IngestPage() {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[4]);
  const [dragging, setDragging] = useState(false);

  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onFile = useCallback(
    (f: File | null) => {
      setFile(f);
      if (f && !title) setTitle(f.name.replace(/\.(md|markdown|txt)$/i, ""));
    },
    [title],
  );

  const poll = useCallback((documentId: number) => {
    const tick = async () => {
      try {
        const s = await getIngestStatus(documentId);
        setStatus(s);
        if (s.stage !== "done" && s.stage !== "error") {
          pollRef.current = setTimeout(tick, 600);
        }
      } catch {
        pollRef.current = setTimeout(tick, 1000);
      }
    };
    tick();
  }, []);

  const canSubmit =
    title.trim().length > 0 && (mode === "file" ? !!file : text.trim().length > 0);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("doc_type", docType);
      if (mode === "file" && file) form.set("file", file);
      if (mode === "text") form.set("text", text);
      const doc = await ingestDocument(form);
      setStatus({
        document_id: doc.id,
        slug: doc.slug,
        stage: "queued",
        chunks_done: 0,
        chunks_total: 0,
        provider: "",
        error: null,
      });
      poll(doc.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setStatus(null);
    setFile(null);
    setText("");
    setTitle("");
    setError(null);
  }

  const active = status && status.stage !== "done";
  const done = status?.stage === "done";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingest a document"
        description="Drop a compliance document and Clause will chunk it into citable passages, embed each one, and index it for retrieval."
      />

      {!status && (
        <div className="space-y-5">
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
            {(["file", "text"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  mode === m
                    ? "bg-accent-soft text-accent-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {m === "file" ? "Upload file" : "Paste text"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging
                  ? "border-accent bg-accent-soft"
                  : "border-border-strong bg-surface hover:bg-surface-2"
              }`}
            >
              <input
                type="file"
                accept=".md,.markdown,.txt"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted" fill="none">
                <path
                  d="M12 16V6m0 0L8 10m4-4 4 4M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-3 text-sm font-medium text-ink">
                {file ? file.name : "Drop a .md or .txt file, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-faint">Markdown or plain text, UTF-8</p>
            </label>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Paste the document text here…"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                Document title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sanctions Screening Procedure"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                Document type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Starting…" : "Ingest document"}
          </button>
        </div>
      )}

      {status && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {status.provider && (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {status.provider} embeddings
              </span>
            )}
          </div>

          {status.stage === "error" ? (
            <p className="mt-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              Ingestion failed: {status.error ?? "unknown error"}
            </p>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-2">
                {STAGES.map((s, i) => {
                  const cur = stageIndex(status.stage);
                  const state =
                    i < cur ? "complete" : i === cur ? "active" : "pending";
                  return (
                    <div key={s.key} className="flex flex-1 items-center gap-2">
                      <StageDot state={state} />
                      <span
                        className={`text-xs font-medium ${
                          state === "pending" ? "text-faint" : "text-ink-soft"
                        }`}
                      >
                        {s.label}
                      </span>
                      {i < STAGES.length - 1 && (
                        <div
                          className={`h-px flex-1 ${
                            i < cur ? "bg-accent" : "bg-border"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{
                      width: done
                        ? "100%"
                        : status.chunks_total > 0
                          ? `${Math.round(
                              (status.chunks_done / status.chunks_total) * 100,
                            )}%`
                          : "8%",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {done
                    ? `Indexed ${status.chunks_total} passages.`
                    : status.chunks_total > 0
                      ? `Embedded ${status.chunks_done} of ${status.chunks_total} passages…`
                      : "Analyzing document structure…"}
                </p>
              </div>
            </>
          )}

          <div className="mt-6 flex items-center gap-3">
            {done && (
              <Link
                href={`/library/${status.slug}`}
                className="inline-flex items-center rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Open document
              </Link>
            )}
            {(done || status.stage === "error") && (
              <button
                onClick={reset}
                className="inline-flex items-center rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
              >
                Ingest another
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StageDot({ state }: { state: "complete" | "active" | "pending" }) {
  if (state === "complete") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-accent">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      </span>
    );
  }
  return <span className="h-5 w-5 rounded-full border-2 border-border" />;
}
