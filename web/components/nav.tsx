"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const NAV: NavItem[] = [
  {
    href: "/ask",
    label: "Ask Clause",
    icon: (
      <path
        d="M4 9.5a5.5 5.5 0 0 1 5.5-5.5h1A5.5 5.5 0 0 1 16 9.5v0a5.5 5.5 0 0 1-5.5 5.5H7l-3 2.5V9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/library",
    label: "Library",
    icon: (
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a1.5 1.5 0 0 1 1.5 1.5V16M4 5.5V16a1.5 1.5 0 0 0 1.5 1.5H9M4 5.5h6.5m0 0V16m0-10.5A1.5 1.5 0 0 1 12 4h2.5A1.5 1.5 0 0 1 16 5.5V16a1.5 1.5 0 0 1-1.5 1.5H12A1.5 1.5 0 0 1 10.5 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/ingest",
    label: "Ingest",
    icon: (
      <path
        d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4 13v2.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/trust",
    label: "Trust & evals",
    icon: (
      <path
        d="M10 3.5 4.5 5.5v4c0 3 2.3 5.3 5.5 6.5 3.2-1.2 5.5-3.5 5.5-6.5v-4L10 3.5Z M7.5 9.5 9.3 11.3 12.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={[
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent-ink"
                : "text-ink-soft hover:bg-surface-2 hover:text-ink",
            ].join(" ")}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DemoBadge() {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Demo mode
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-faint">
        Synthetic fintech corpus. No login required.
      </p>
    </div>
  );
}
