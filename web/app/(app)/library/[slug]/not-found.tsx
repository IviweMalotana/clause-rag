import { EmptyState } from "@/components/ui";

export default function DocumentNotFound() {
  return (
    <EmptyState
      title="Document not found"
      description="That document isn't in the corpus. It may have been removed, or the link is out of date."
      action={{ label: "Back to library", href: "/library" }}
    />
  );
}
