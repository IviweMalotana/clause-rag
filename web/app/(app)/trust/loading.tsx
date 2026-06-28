import { Skeleton } from "@/components/ui";

export default function TrustLoading() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-5">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-3 h-4 w-[32rem] max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2 rounded-xl border border-border bg-surface p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
