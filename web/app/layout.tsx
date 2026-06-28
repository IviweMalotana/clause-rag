import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Clause — Compliance copilot",
    template: "%s · Clause",
  },
  description:
    "Clause answers compliance and policy questions over your document corpus — always with a cited source passage, never a guess.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
