"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { useAdminOverview } from "./analytics-tab";

const CATEGORY_VARIANT = { bug: "loss", idea: "default", other: "secondary" } as const;

export function FeedbackTab() {
  const { data, isLoading } = useAdminOverview();
  if (isLoading) return <Skeleton className="h-60 rounded-xl" />;
  const items = data?.feedback ?? [];

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted">No feedback yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((f) => (
        <article key={f.id} className="rounded-xl border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge variant={CATEGORY_VARIANT[f.category as keyof typeof CATEGORY_VARIANT] ?? "secondary"}>
              {f.category}
            </Badge>
            {f.email && <span>{f.email}</span>}
            {f.path && <span className="font-mono">{f.path}</span>}
            <time dateTime={f.createdAt} className="ml-auto">
              {timeAgo(f.createdAt)} ago
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{f.message}</p>
        </article>
      ))}
    </div>
  );
}
