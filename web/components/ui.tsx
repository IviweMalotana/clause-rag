import Link from "next/link";

// Maps a document type to a restrained badge tone. One accent, muted neutrals.
const DOC_TYPE_TONE: Record<string, string> = {
  "AML Policy": "bg-accent-soft text-accent-ink",
  "KYC Procedure": "bg-accent-soft text-accent-ink",
  "Security Checklist": "bg-surface-2 text-ink-soft",
  "Operations Policy": "bg-surface-2 text-ink-soft",
};

export function DocTypeBadge({ type }: { type: string }) {
  const tone = DOC_TYPE_TONE[type] ?? "bg-surface-2 text-ink-soft";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {type}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted" fill="none">
          <path
            d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M14 4v5h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger-soft px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-danger" fill="none">
          <path
            d="M12 8v5m0 3.5h.01M10.3 4.3 3.5 16a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
