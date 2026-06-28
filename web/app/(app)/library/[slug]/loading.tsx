import { Skeleton } from "@/components/ui";

export default function DocumentLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-8 py-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-3 px-8 py-8 sm:px-12 sm:py-10">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}
