"use client";

import { HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PnlText } from "@/components/shared/pnl-text";
import { TagChip } from "@/components/shared/tag-chip";
import { useTagStats } from "../queries";

/** Emotions vs P&L — what does trading "anxious" actually cost you? */
export function EmotionsPanel({ from, to }: { from: string | null; to: string | null }) {
  const { data: stats = [] } = useTagStats("emotion", from, to);

  return (
    <Card>
      <CardHeader><CardTitle>Emotions vs P&L</CardTitle></CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="No emotions tagged yet"
            description="Tag how you felt on each trade (calm, anxious, greedy…) to see which states make you money — and which don't."
            className="border-0 py-8"
          />
        ) : (
          <div className="space-y-2">
            {stats.map((m) => (
              <div key={m.tagId} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <TagChip name={m.name} color={m.color} />
                  <span className="text-xs text-muted">×{m.count}</span>
                </div>
                <PnlText value={m.cost} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
