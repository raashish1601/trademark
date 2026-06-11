import type { Metadata } from "next";
import Link from "next/link";
import { CandlestickChart, Github, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { QueryProvider } from "@/providers/query-provider";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { default: "Community", template: `%s · TradeMark Community` },
  description:
    "Trade ideas, lessons and discussion from Indian intraday & FnO traders. Educational only — no tips, no spam.",
  alternates: { canonical: "/community" },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <CandlestickChart className="h-5 w-5 text-accent" aria-hidden />
              Trade<span className="text-accent">Mark</span>
            </Link>
            <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted">Community</span>
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <Button variant="ghost" size="icon" asChild>
                <a href={siteConfig.github} target="_blank" rel="noreferrer" aria-label="GitHub">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/dashboard">
                  <NotebookPen className="h-3.5 w-3.5" aria-hidden /> My journal
                </Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6 text-center text-[11px] text-muted">
          Educational discussion only — nothing on TradeMark is investment advice.
        </footer>
      </div>
    </QueryProvider>
  );
}
