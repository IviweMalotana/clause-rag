import { Skeleton } from "@/components/ui";

export default function LibraryLoading() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-3 h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-border bg-surface p-5"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-3 h-5 w-3/4" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <Skeleton className="mt-4 h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
