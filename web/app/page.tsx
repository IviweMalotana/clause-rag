import Link from "next/link";
import type { Metadata } from "next";
import { BrandMark } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Clause — a RAG compliance copilot that never answers without a citation",
  description:
    "A case study: how Clause answers policy and regulation questions over a document corpus with inline citations to the exact source passage — and refuses when the corpus can't back an answer.",
};

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-dashed border-warn/50 bg-warn-soft px-1.5 py-0.5 font-mono text-[0.85em] text-warn">
      {children}
    </span>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-faint" fill="none">
      <path d="M12 5v14m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiagramBox({
  title,
  subtitle,
  tone = "default",
}: {
  title: string;
  subtitle: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={`w-full rounded-xl border px-4 py-3 text-center ${
        tone === "accent"
          ? "border-accent/30 bg-accent-soft"
          : "border-border bg-surface"
      }`}
    >
      <p className={`text-sm font-semibold ${tone === "accent" ? "text-accent-ink" : "text-ink"}`}>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight text-ink">Clause</span>
          </div>
          <nav className="flex items-center gap-1.5">
            <a href="#architecture" className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 sm:block">
              Architecture
            </a>
            <Link href="/trust" className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 sm:block">
              Trust &amp; evals
            </Link>
            <Link
              href="/ask"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Open the demo
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[12px] font-medium text-muted">
            Live demo · no login · synthetic fintech corpus
          </span>
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          Compliance answers you can actually cite.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-muted">
          Clause is a retrieval-augmented copilot for policy and regulation
          questions. Every answer links to the exact source passage — and when
          the corpus can&apos;t support an answer, it says so instead of guessing.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/ask"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Try the live demo
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
          >
            Browse the corpus
          </Link>
        </div>
      </section>

      {/* Problem */}
      <Section eyebrow="The problem" title="In compliance, an uncited answer is worthless">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              h: "Answers need provenance",
              p: "An analyst can't act on “the policy says 90 days” without seeing which policy, which clause. Unsourced model output is unusable — and risky — in a regulated workflow.",
            },
            {
              h: "Hallucination is a hard no",
              p: "A confident but wrong answer about a control or threshold can cause a real breach. The system must decline when the documents don't cover the question.",
            },
            {
              h: "The corpus is the source of truth",
              p: "AML policies, KYC procedures, PCI controls, refund rules — the answer must come from these documents, traceable to the passage it came from.",
            },
          ].map((c) => (
            <div key={c.h} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink">{c.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.p}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 rounded-xl border border-border bg-surface-2 p-5 text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Why I built this.</span> I&apos;ve
          built fraud-and-compliance processes, run customer due-diligence, and
          shipped an AI Policy feature in production. Clause is the tool I wanted
          in those roles: fast answers I could trust because I could see the
          source. <Placeholder>add a sentence about your specific context</Placeholder>
        </p>
      </Section>

      {/* Approach */}
      <Section eyebrow="The approach" title="Grounded retrieval, with citations as a first-class feature">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[
            {
              h: "Structure-aware chunking",
              p: "Documents are split on section boundaries, and every chunk stores its exact character offsets back into the source — so a citation maps to the precise passage, not an approximation.",
            },
            {
              h: "Inline numbered citations",
              p: "Answers carry [1][2] markers bound to the chunks that grounded them. Click one and the source document opens, scrolled to and highlighting that passage.",
            },
            {
              h: "A real no-answer guardrail",
              p: "A per-provider similarity threshold plus an explicit model instruction means out-of-corpus questions are refused, not answered. Provable on the Trust page.",
            },
            {
              h: "Confidence & sources used",
              p: "Each answer shows its confidence and the passages it relied on, with their retrieval scores — so a reviewer can audit the basis of every response.",
            },
          ].map((c) => (
            <div key={c.h} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink">{c.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Architecture */}
      <Section
        id="architecture"
        eyebrow="The architecture"
        title="A small, production-shaped system"
      >
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-10">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <DiagramBox title="Browser" subtitle="Operator asks a question" />
            <ArrowDown />
            <DiagramBox title="Next.js 15 · Vercel" subtitle="App Router · Tailwind · chat & reader UI" />
            <ArrowDown />
            <DiagramBox title="FastAPI · Railway" subtitle="retrieval · grounding · guardrail" tone="accent" />
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 flex-col items-center gap-2">
                <ArrowDown />
                <DiagramBox title="OpenAI embeddings" subtitle="text-embedding-3-small" />
              </div>
              <div className="flex flex-1 flex-col items-center gap-2">
                <ArrowDown />
                <DiagramBox title="Claude API" subtitle="grounded answer generation" />
              </div>
              <div className="flex flex-1 flex-col items-center gap-2">
                <ArrowDown />
                <DiagramBox title="Postgres · pgvector" subtitle="documents · chunks · vectors" />
              </div>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
            The retriever embeds the question, runs a cosine search over pgvector,
            gates the results by a calibrated similarity threshold, and only then
            asks Claude to answer — strictly from the retrieved passages, with
            inline citations.
          </p>
        </div>
      </Section>

      {/* Outcome */}
      <Section eyebrow="The outcome" title="Impact (fill in from your real experience)">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { metric: "[ XX% ]", label: "less time to answer a policy question vs. manual lookup" },
            { metric: "[ 100% ]", label: "of answers carry a citation to a source passage" },
            { metric: "[ N ]", label: "policies & procedures indexed in the corpus" },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-dashed border-warn/40 bg-warn-soft/40 p-5 text-center"
            >
              <div className="font-mono text-2xl font-semibold text-warn">{c.metric}</div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-faint">
          Dashed cards are placeholders — replace the bracketed values with metrics
          from your own deployment or experience.
        </p>
      </Section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            See the citation click-through for yourself
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Ask a question, then click a citation to jump to the exact highlighted
            passage in the source document.
          </p>
          <Link
            href="/ask"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Open the live demo
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-faint sm:flex-row">
          <span>Clause — RAG compliance copilot. Synthetic demo data only.</span>
          <span>Next.js · FastAPI · Postgres + pgvector · Claude</span>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-5xl scroll-mt-16 px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <div className="mt-7">{children}</div>
    </section>
  );
}
