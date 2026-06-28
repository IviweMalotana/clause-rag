"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "./Brand";
import { DemoBadge, NavList } from "./nav";

// Mobile top bar + slide-over drawer. Shown below lg; hidden on desktop.
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/">
          <Brand />
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-soft transition-colors hover:bg-surface-2"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-3">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-auto px-5 py-4">
              <DemoBadge />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
