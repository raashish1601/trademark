"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Community search lives in the site header (LinkedIn/Twitter pattern) and is
 * URL-driven — submitting navigates to /community?q=… so results are
 * shareable and survive reloads. Desktop: compact input that widens on focus.
 * Phones: an icon that toggles a full-width bar under the header.
 */
export function CommunitySearch() {
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams().get("q") ?? "";
  const [value, setValue] = React.useState(q);
  const [open, setOpen] = React.useState(false);

  // Keep the field in sync when navigation changes the query (back button).
  React.useEffect(() => setValue(q), [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = value.trim();
    router.push(term ? `/community?q=${encodeURIComponent(term)}` : "/community");
    setOpen(false);
  };

  const clear = () => {
    setValue("");
    if (q && pathname === "/community") router.push("/community");
  };

  const field = (
    <form role="search" onSubmit={submit} className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search posts…"
        aria-label="Search posts"
        className="h-8 w-full pl-9 pr-8 text-sm"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );

  return (
    <>
      <div className="hidden w-44 transition-[width] duration-200 focus-within:w-64 md:block">
        {field}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Search community"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Search className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b bg-bg/95 p-2 backdrop-blur md:hidden">
          {field}
        </div>
      )}
    </>
  );
}
