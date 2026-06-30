"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SUGGESTIONS = [
  "What dollar amount triggers a mandatory transaction monitoring alert?",
  "When is enhanced due diligence required for politically exposed persons?",
  "What refund amount can a front-line agent approve?",
  "How often must penetration testing be performed?",
];

// Global Cmd+K / Ctrl+K palette. Submits to /ask via querystring; the Ask
// page reads ?q= on mount and fires the question.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setOpen(false);
    setQ("");
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(q);
            }}
            placeholder="Ask a compliance question…"
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
            ↵
          </kbd>
        </div>
        <div className="px-2 py-2">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
            Try one
          </p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-surface-2"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2 text-[11px] text-faint">
          <span>
            <kbd className="font-mono">esc</kbd> to close
          </span>
          <span>
            <kbd className="font-mono">⌘K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}
