"use client";

import { useCallback, useEffect, useState } from "react";
import {
  conversationExportUrl,
  deleteConversation,
  getConversation,
  listConversations,
  streamAnswer,
  type ConversationListItem,
  type Source,
  type StreamEvent,
} from "@/lib/api";
import { CitedText, ConfidenceMeter, CopyButton, SourceCard } from "@/components/chat";
import { Skeleton } from "@/components/ui";

type ExchangeStatus =
  | "pending"      // request sent, awaiting meta/first delta
  | "streaming"    // receiving deltas
  | "answered"
  | "no_answer"
  | "needs_key"
  | "error";

interface Exchange {
  question: string;
  status: ExchangeStatus;
  answer: string;
  sources: Source[];       // supporting passages (with markers when answered)
  closest: Source[];       // top retrieved (for no_answer fallback display)
  citations: Source[];     // citations bound to inline [n] markers (after done)
  confidence: number;
  confidence_label: string;
  provider: string;
  model: string;
  error?: string;
}

const SUGGESTIONS = [
  "What dollar amount triggers a mandatory transaction monitoring alert?",
  "When is enhanced due diligence required for politically exposed persons?",
  "What refund amount can a front-line agent approve?",
  // Demonstrates the guardrail — not covered by the corpus.
  "How many vacation days do employees get?",
];

function emptyExchange(question: string): Exchange {
  return {
    question,
    status: "pending",
    answer: "",
    sources: [],
    closest: [],
    citations: [],
    confidence: 0,
    confidence_label: "Low",
    provider: "",
    model: "",
  };
}

export default function AskPage() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>("");
  const [input, setInput] = useState("");
  const [active, setActive] = useState<{ idx: number; marker: number } | null>(null);
  const [history, setHistory] = useState<ConversationListItem[]>([]);
  const busy = exchanges.some((e) => e.status === "pending" || e.status === "streaming");

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await listConversations());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const idx = exchanges.length;
    setExchanges((prev) => [...prev, emptyExchange(q)]);

    const update = (patch: Partial<Exchange>) =>
      setExchanges((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

    try {
      await streamAnswer(q, conversationId, (ev: StreamEvent) => {
        switch (ev.type) {
          case "meta":
            setConversationId(ev.conversation_id);
            update({
              status: "streaming",
              provider: ev.provider,
              model: ev.model,
              sources: ev.supporting,
              closest: ev.retrieved,
            });
            break;
          case "delta":
            setExchanges((prev) =>
              prev.map((e, i) =>
                i === idx ? { ...e, status: "streaming", answer: e.answer + ev.text } : e,
              ),
            );
            break;
          case "no_answer":
            update({ status: "no_answer", answer: ev.answer });
            break;
          case "needs_key":
            update({ status: "needs_key" });
            break;
          case "done":
            update({
              status: "answered",
              citations: ev.citations,
              confidence: ev.confidence,
              confidence_label: ev.confidence_label,
            });
            break;
          case "error":
            update({ status: "error", error: ev.error });
            break;
        }
      });
      refreshHistory();
    } catch (err) {
      update({ status: "error", error: err instanceof Error ? err.message : "Stream failed" });
    }
  }

  function cite(idx: number, marker: number) {
    setActive({ idx, marker });
    const el = document.getElementById(`src-${idx}-${marker}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function newChat() {
    setExchanges([]);
    setConversationId(null);
    setConversationTitle("");
    setInput("");
    setActive(null);
  }

  async function loadConversation(id: number) {
    try {
      const conv = await getConversation(id);
      const loaded: Exchange[] = [];
      for (let i = 0; i < conv.messages.length; i++) {
        const m = conv.messages[i];
        if (m.role === "user") {
          const next = conv.messages[i + 1];
          if (next && next.role === "assistant") {
            loaded.push({
              question: m.content,
              status: next.no_answer ? "no_answer" : "answered",
              answer: next.content,
              sources: next.citations,
              closest: [],
              citations: next.citations,
              confidence: next.confidence ?? 0,
              confidence_label:
                (next.confidence ?? 0) >= 0.75
                  ? "High"
                  : (next.confidence ?? 0) >= 0.5
                    ? "Medium"
                    : "Low",
              provider: "",
              model: "",
            });
            i++; // skip the paired assistant message
          } else {
            loaded.push({ ...emptyExchange(m.content), status: "error", error: "No answer recorded" });
          }
        }
      }
      setExchanges(loaded);
      setConversationId(conv.id);
      setConversationTitle(conv.title);
      setActive(null);
    } catch {
      /* ignore */
    }
  }

  async function removeConversation(id: number) {
    try {
      await deleteConversation(id);
      if (conversationId === id) newChat();
      refreshHistory();
    } catch {
      /* ignore */
    }
  }

  const empty = exchanges.length === 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <HistoryPane
        items={history}
        currentId={conversationId}
        onSelect={loadConversation}
        onDelete={removeConversation}
        onNew={newChat}
      />

      <div>
        {empty ? (
          <EmptyAsk input={input} setInput={setInput} ask={ask} busy={busy} />
        ) : (
          <div className="space-y-8 pb-28">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
                {conversationTitle || "Ask Clause"}
              </h1>
              <div className="flex shrink-0 items-center gap-2">
                {conversationId != null && (
                  <a
                    href={conversationExportUrl(conversationId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                      <path
                        d="M8 2v8m0 0L5 7m3 3 3-3M3 12v1.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Export
                  </a>
                )}
                <button
                  onClick={newChat}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  New chat
                </button>
              </div>
            </div>

            {exchanges.map((ex, idx) => (
              <ExchangeView key={idx} ex={ex} idx={idx} active={active} onCite={cite} />
            ))}

            <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-bg/90 px-5 py-4 backdrop-blur sm:px-8 lg:left-60">
              <div className="mx-auto max-w-5xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={() => ask(input)}
                  busy={busy}
                  placeholder="Ask a follow-up…"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryPane({
  items,
  currentId,
  onSelect,
  onDelete,
  onNew,
}: {
  items: ConversationListItem[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <aside className="hidden h-fit rounded-xl border border-border bg-surface p-3 lg:block">
      <button
        onClick={onNew}
        className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        New chat
      </button>

      <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
        Recent
      </p>

      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-faint">No conversations yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((c) => (
            <li key={c.id}>
              <div
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                  currentId === c.id ? "bg-accent-soft" : "hover:bg-surface-2"
                }`}
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className={`flex-1 truncate text-left text-[13px] ${
                    currentId === c.id ? "font-medium text-accent-ink" : "text-ink-soft"
                  }`}
                  title={c.title}
                >
                  {c.title || "New conversation"}
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  aria-label="Delete"
                  className="invisible inline-flex h-6 w-6 items-center justify-center rounded text-faint transition-colors hover:bg-surface hover:text-danger group-hover:visible"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M3 4h10M6.5 7v5M9.5 7v5M5 4l.5 9A1 1 0 0 0 6.5 14h3a1 1 0 0 0 1-1l.5-9M6 4V2.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function EmptyAsk({
  input,
  setInput,
  ask,
  busy,
}: {
  input: string;
  setInput: (v: string) => void;
  ask: (q: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Ask your compliance corpus
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
          Clause answers from your documents and cites the exact source passage.
          If the corpus doesn&apos;t cover it, it says so instead of guessing.
        </p>
        <div className="mt-7">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => ask(input)}
            busy={busy}
            autoFocus
          />
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Try one
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = "Ask a compliance question…",
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:border-accent">
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-faint" fill="none">
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
      />
      <button
        onClick={onSubmit}
        disabled={busy || !value.trim()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Ask"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path
            d="M4 10h11M10 5l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function ExchangeView({
  ex,
  idx,
  active,
  onCite,
}: {
  ex: Exchange;
  idx: number;
  active: { idx: number; marker: number } | null;
  onCite: (idx: number, marker: number) => void;
}) {
  const isStreaming = ex.status === "streaming";
  const showSources = ex.status !== "pending";
  const sources =
    ex.citations.length > 0
      ? ex.citations
      : ex.sources.length > 0
        ? ex.sources
        : ex.closest;
  const validMarkers = new Set(
    ex.citations.length > 0
      ? ex.citations.map((c) => c.marker).filter((m): m is number => m != null)
      : ex.sources.map((c) => c.marker).filter((m): m is number => m != null),
  );

  const meterAnswer = {
    status: ex.status,
    confidence: ex.confidence,
    confidence_label: ex.confidence_label,
    provider: ex.provider,
    citations: ex.citations,
    sources: ex.sources,
  };

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-ink">{ex.question}</h2>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {ex.status === "pending" && <AnswerSkeleton />}
          {(ex.status === "answered" || isStreaming) && ex.answer && (
            <>
              <CitedText
                text={ex.answer}
                validMarkers={validMarkers}
                onCite={(m) => onCite(idx, m)}
              />
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle" />
              )}
              {ex.status === "answered" && (
                <div className="mt-3">
                  <CopyButton text={ex.answer} />
                </div>
              )}
            </>
          )}
          {ex.status === "no_answer" && (
            <Callout tone="warn" title="Clause declined to answer">
              {ex.answer}
            </Callout>
          )}
          {ex.status === "needs_key" && (
            <Callout tone="neutral" title="Live answer needs an Anthropic API key">
              Retrieval ran successfully — the passages Clause would ground its
              answer on are shown here. Set{" "}
              <code className="font-mono text-[13px]">ANTHROPIC_API_KEY</code> on
              the API to generate the written answer with inline citations.
            </Callout>
          )}
          {ex.status === "error" && (
            <Callout tone="danger" title="Answer generation failed">
              {ex.error ?? "The model call failed. Please try again."}
            </Callout>
          )}
        </div>

        <div className="space-y-3 lg:col-span-1">
          {ex.status === "pending" ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </>
          ) : (
            showSources && (
              <>
                <ConfidenceMeter answer={meterAnswer} />
                {sources.length > 0 && (
                  <div>
                    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {ex.citations.length > 0
                        ? "Sources used"
                        : ex.sources.length > 0
                          ? "Sources considered"
                          : "Closest passages"}
                    </p>
                    <div className="space-y-2.5">
                      {sources.map((s, i) => (
                        <SourceCard
                          key={i}
                          source={s}
                          domId={s.marker != null ? `src-${idx}-${s.marker}` : undefined}
                          active={
                            active?.idx === idx && active?.marker === s.marker
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
        Searching the corpus…
      </div>
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warn" | "danger" | "neutral";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    warn: "border-warn/20 bg-warn-soft",
    danger: "border-danger/20 bg-danger-soft",
    neutral: "border-border bg-surface-2",
  }[tone];
  const titleColor = {
    warn: "text-warn",
    danger: "text-danger",
    neutral: "text-ink",
  }[tone];
  return (
    <div className={`rounded-xl border ${styles} p-4`}>
      <h3 className={`text-sm font-semibold ${titleColor}`}>{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
