import { listDocuments, type DocumentSummary } from "@/lib/api";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata = { title: "Library" };

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
        <LibraryBrowser docs={docs} />
      )}
    </div>
  );
}
