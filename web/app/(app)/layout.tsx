import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { CommandPalette } from "@/components/CommandPalette";

// Shell for the operator tools (Ask, Library, Ingest, Trust).
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
