"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Sends one lightweight page-view beacon per route change (first-party, path-only). */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    const payload = JSON.stringify({ path: pathname });
    try {
      if (!navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }))) {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* analytics must never break the app */
    }
  }, [pathname]);

  return null;
}
