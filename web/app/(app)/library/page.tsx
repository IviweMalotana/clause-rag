import Link from "next/link";
import { listDocuments, type DocumentSummary } from "@/lib/api";
import { DocTypeBadge, EmptyState, ErrorState, PageHeader } from "@/components/ui";

export const metadata = { title: "Library" };

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
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              indexed ? "bg-success" : "bg-faint"
            }`}
          />
          {indexed ? `${doc.num_chunks} passages indexed` : "Seeded"}
        </span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-ink group-hover:text-accent-ink">
        {doc.title}
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">
        {doc.summary}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
        Open document
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M6 3.5 10.5 8 6 12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

export default async function LibraryPage() {
  let docs: DocumentSummary[];
  try {
    docs = await listDocuments();
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Document library" />
        <ErrorState description="Could not reach the Clause API. Make sure the backend is running on the configured API URL, then refresh." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document library"
        description="The compliance corpus Clause reasons over. Every answer is grounded in a passage from one of these source documents."
      />

      {docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Run the seed script to load the synthetic compliance corpus, then refresh this page."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {docs.map((doc) => (
            <DocumentCard key={doc.slug} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
