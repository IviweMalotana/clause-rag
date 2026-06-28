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

      <div className="mt-auto px-5 py-4">
        <DemoBadge />
      </div>
    </aside>
  );
}
