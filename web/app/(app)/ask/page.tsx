"use client";

import { useRef, useState } from "react";
import { askQuestion, type AnswerResponse } from "@/lib/api";
import { CitedText, ConfidenceMeter, SourceCard } from "@/components/chat";
import { Skeleton } from "@/components/ui";

interface Exchange {
  question: string;
  answer?: AnswerResponse;
  pending: boolean;
  error?: string;
}

const SUGGESTIONS = [
  "What dollar amount triggers a mandatory transaction monitoring alert?",
  "When is enhanced due diligence required for politically exposed persons?",
  "What refund amount can a front-line agent approve?",
  // Demonstrates the guardrail — not covered by the corpus.
  "How many vacation days do employees get?",
];

export default function AskPage() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [active, setActive] = useState<{ idx: number; marker: number } | null>(null);
  const busy = exchanges.some((e) => e.pending);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const idx = exchanges.length;
    setExchanges((prev) => [...prev, { question: q, pending: true }]);
    try {
      const answer = await askQuestion(q, conversationId);
      setConversationId(answer.conversation_id);
      setExchanges((prev) =>
        prev.map((e, i) => (i === idx ? { ...e, answer, pending: false } : e)),
      );
    } catch {
      setExchanges((prev) =>
        prev.map((e, i) =>
          i === idx
            ? { ...e, pending: false, error: "Could not reach the Clause API." }
            : e,
        ),
      );
    }
  }

  function cite(idx: number, marker: number) {
    setActive({ idx, marker });
    const el = document.getElementById(`src-${idx}-${marker}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (exchanges.length === 0) {
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
            <Composer value={input} onChange={setInput} onSubmit={() => ask(input)} busy={busy} autoFocus />
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

  return (
    <div className="space-y-10 pb-28">
      {exchanges.map((ex, idx) => (
        <ExchangeView
          key={idx}
          ex={ex}
          idx={idx}
          active={active}
          onCite={cite}
        />
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
  const a = ex.answer;
  const sources = a ? (a.citations.length > 0 ? a.citations : a.sources) : [];
  const validMarkers = new Set(
    (a?.citations ?? []).map((c) => c.marker).filter((m): m is number => m != null),
  );

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-ink">{ex.question}</h2>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {ex.pending && <AnswerSkeleton />}
          {ex.error && (
            <Callout tone="danger" title="Couldn’t answer">
              {ex.error}
            </Callout>
          )}
          {a?.status === "answered" && (
            <CitedText
              text={a.answer}
              validMarkers={validMarkers}
              onCite={(m) => onCite(idx, m)}
            />
          )}
          {a?.status === "no_answer" && (
            <Callout tone="warn" title="Clause declined to answer">
              {a.answer}
            </Callout>
          )}
          {a?.status === "needs_key" && (
            <Callout tone="neutral" title="Live answer needs an Anthropic API key">
              Retrieval ran successfully — the passages Clause would ground its
              answer on are shown here. Set <code className="font-mono text-[13px]">ANTHROPIC_API_KEY</code>{" "}
              to generate the written answer with inline citations.
            </Callout>
          )}
          {a?.status === "error" && (
            <Callout tone="danger" title="Answer generation failed">
              {a.error ?? "The model call failed. Please try again."}
            </Callout>
          )}
        </div>

        <div className="space-y-3 lg:col-span-1">
          {ex.pending ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </>
          ) : (
            a && (
              <>
                <ConfidenceMeter answer={a} />
                {sources.length > 0 && (
                  <div>
                    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {a.citations.length > 0 ? "Sources used" : "Closest passages"}
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
