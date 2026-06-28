import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getDocument } from "@/lib/api";
import { DocumentReader } from "@/components/DocumentReader";
import { DocTypeBadge } from "@/components/ui";

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

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
          <DocumentReader content={doc.content} />
        </div>
      </div>
    </div>
  );
}
