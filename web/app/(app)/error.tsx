"use client";

import { ErrorState } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-6">
      <ErrorState description="An unexpected error occurred while loading this view." />
      <div className="flex justify-center">
        <button
          onClick={reset}
          className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
