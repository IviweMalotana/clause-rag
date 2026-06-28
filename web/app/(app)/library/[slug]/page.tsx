import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getDocument } from "@/lib/api";
import { DocumentReader } from "@/components/DocumentReader";
import { DocTypeBadge } from "@/components/ui";

// Rendered per request: depends on live document data and the ?cs/?ce passage
// query params that drive the citation highlight.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const doc = await getDocument(slug);
    return { title: doc.title };
  } catch {
    return { title: "Document" };
  }
}

function parseHighlight(
  cs?: string,
  ce?: string,
): { start: number; end: number } | null {
  const start = Number(cs);
  const end = Number(ce);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return { start, end };
  }
  return null;
}

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cs?: string; ce?: string; m?: string }>;
}) {
  const { slug } = await params;
  const { cs, ce, m } = await searchParams;
  const highlight = parseHighlight(cs, ce);

  let doc;
  try {
    doc = await getDocument(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M10 3.5 5.5 8 10 12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Library
      </Link>

      {highlight && (
        <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-accent-ink" fill="none">
              <path
                d="M3 10.5 8 15.5 17 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-medium text-accent-ink">
              Showing the cited passage{m ? ` [${m}]` : ""}, highlighted below.
            </span>
          </div>
          <Link
            href={`/library/${slug}`}
            className="text-xs font-semibold text-accent-ink hover:underline"
          >
            Show full document
          </Link>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-8 py-4">
          <DocTypeBadge type={doc.doc_type} />
          <span className="text-xs font-medium text-faint">
            {doc.status === "indexed"
              ? `${doc.num_chunks} passages indexed`
              : "Seeded — not yet indexed"}
          </span>
        </div>
        <div className="px-8 py-8 sm:px-12 sm:py-10">
          <DocumentReader content={doc.content} highlight={highlight} />
        </div>
      </div>
    </div>
  );
}
