// Clause wordmark. The mark is a citation-bracket motif — original, not derived
// from any reference product's logo.
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="7" fill="var(--color-accent)" />
      <path
        d="M12 8.5H9.5A1.5 1.5 0 0 0 8 10v8a1.5 1.5 0 0 0 1.5 1.5H12M16 8.5h2.5A1.5 1.5 0 0 1 20 10v8a1.5 1.5 0 0 1-1.5 1.5H16"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="1.4" fill="white" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark className="h-7 w-7" />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          Clause
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-faint">
          Compliance copilot
        </span>
      </div>
    </div>
  );
}
