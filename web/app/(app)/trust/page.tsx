import Link from "next/link";
import { getEvals, type EvalItem, type GuardrailItem } from "@/lib/api";
import { ErrorState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trust & evals" };

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        ok ? "bg-success-soft text-success" : "bg-warn-soft text-warn"
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
        {ok ? (
          <path
            d="M2.5 6.5 5 9l4.5-5.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path d="M6 3v3.5M6 8.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
      {label}
    </span>
  );
}

function EvalRow({ item }: { item: EvalItem }) {
  const href = `/library/${item.retrieved.document_slug}?cs=${item.retrieved.char_start}&ce=${item.retrieved.char_end}`;
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-border px-5 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
      <div>
        <p className="text-sm font-medium text-ink">{item.question}</p>
        <p className="mt-1 text-xs text-muted">
          Expected: {item.expected_document} ·{" "}
          <span className="text-faint">{item.expected_section}</span>
        </p>
      </div>
      <div className="min-w-0">
        <Link href={href} className="group block">
          <p className="truncate text-xs font-medium text-ink-soft group-hover:text-accent-ink">
            {item.retrieved.section ?? item.retrieved.document_title}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-faint">
            cosine {item.retrieved.score.toFixed(3)} · view passage →
          </p>
        </Link>
      </div>
      <div className="md:justify-self-end">
        <StatusPill ok={item.passed} label={item.passed ? "Correct" : "Review"} />
      </div>
    </div>
  );
}

function GuardrailRow({ item }: { item: GuardrailItem }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3.5 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-ink">{item.question}</p>
        <p className="mt-0.5 font-mono text-[10px] text-faint">
          top cosine {item.top_score.toFixed(3)} — below threshold
        </p>
      </div>
      <StatusPill ok={item.declined} label={item.declined ? "Declined" : "Answered"} />
    </div>
  );
}

export default async function TrustPage() {
  let report;
  try {
    report = await getEvals();
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Trust & evals" />
        <ErrorState description="Could not run the evals — the Clause API is unreachable. Start the backend and refresh." />
      </div>
    );
  }

  const allPass = report.passed === report.total;
  const allDeclined = report.guardrail.every((g) => g.declined);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Trust & evals"
        description="Clause is only useful if it retrieves the right passage and refuses when the corpus can't back an answer. These checks run live against the retriever every time you load this page."
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-ink">
              {report.passed}/{report.total}
            </span>
            <span className={`text-sm font-medium ${allPass ? "text-success" : "text-warn"}`}>
              {allPass ? "passing" : "passing — review the rest"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Retrieval evals: the expected source passage is ranked #1.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-ink">
              {report.guardrail.filter((g) => g.declined).length}/{report.guardrail.length}
            </span>
            <span className={`text-sm font-medium ${allDeclined ? "text-success" : "text-warn"}`}>
              {allDeclined ? "correctly declined" : "review"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Guardrail: out-of-corpus questions are refused, not answered.
          </p>
        </div>
      </div>

      {/* Retrieval evals */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Retrieval accuracy</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {report.items.map((it) => (
            <EvalRow key={it.question} item={it} />
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-faint">
          Embeddings: {report.embedding_provider} · support threshold (cosine) ≥{" "}
          {report.min_score.toFixed(2)}.
        </p>
      </section>

      {/* Guardrail */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">No-answer guardrail</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted">
          In compliance, a confident but unsupported answer is worse than no
          answer. When nothing clears the similarity threshold, Clause declines
          instead of guessing.
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {report.guardrail.map((g) => (
            <GuardrailRow key={g.question} item={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
