import Link from "next/link";
import { Brand } from "./Brand";
import { DemoBadge, NavList } from "./nav";

// Desktop sidebar. Hidden below lg; the mobile drawer (MobileNav) takes over.
export function Sidebar() {
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="px-5 py-5">
        <Link href="/" className="inline-block">
          <Brand />
        </Link>
      </div>

      <div className="px-3">
        <NavList />
      </div>

      <div className="mt-auto space-y-2 px-5 py-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] text-muted">
          <span>Quick ask</span>
          <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint">
            ⌘K
          </kbd>
        </div>
        <DemoBadge />
      </div>
    </aside>
  );
}
