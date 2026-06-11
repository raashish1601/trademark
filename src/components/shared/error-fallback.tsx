"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared error UI for route-level error boundaries. */
export function ErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred. You can retry, or head back.",
  reset,
  homeHref = "/",
}: {
  title?: string;
  message?: string;
  reset?: () => void;
  homeHref?: string;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-loss/15 text-loss">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-2 flex gap-2">
        {reset && (
          <Button onClick={reset}>
            <RotateCw className="h-4 w-4" aria-hidden /> Try again
          </Button>
        )}
        <Button variant="outline" onClick={() => location.assign(homeHref)}>
          Go back
        </Button>
      </div>
    </div>
  );
}
