"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/shared/error-fallback";

/** Root route error boundary — catches render/runtime errors in any page. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);
  return <ErrorFallback reset={reset} />;
}
