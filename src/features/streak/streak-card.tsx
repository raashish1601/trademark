"use client";

import { Flame, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStreak, useToggleNoTradeDay } from "./queries";

/**
 * Journaling streak — daily consistency is the whole product, so reward it.
 * Deliberately sitting out counts: "No trades today" keeps the streak alive.
 */
export function StreakCard() {
  const { data, isLoading } = useStreak();
  const toggle = useToggleNoTradeDay();
  if (isLoading || !data) return null;

  const { current, best, todayLogged, noTradeToday, tradedToday } = data;
  const active = current > 0;

  const mark = () =>
    toggle.mutate(true, {
      onSuccess: () => toast.success("Rest day logged — streak protected 🛡️"),
      onError: () => toast.error("Could not log the rest day"),
    });
  const unmark = () => toggle.mutate(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            active ? "bg-warning/15" : "bg-surface-2"
          )}
          aria-hidden
        >
          <Flame className={cn("h-5 w-5", active ? "text-warning" : "text-muted")} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-money text-lg font-bold leading-tight">{current}-day streak</p>
          <p className="text-xs text-muted">
            {best > current ? `Best: ${best} days · ` : ""}
            {todayLogged
              ? noTradeToday && !tradedToday
                ? "Rest day logged ✓"
                : "Today logged ✓"
              : "Log a trade, journal, or a rest day to keep it going"}
          </p>
        </div>
        {!todayLogged && (
          <Button size="sm" variant="outline" onClick={mark} disabled={toggle.isPending}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> No trades today
          </Button>
        )}
        {noTradeToday && !tradedToday && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Undo rest day"
            className="text-muted"
            onClick={unmark}
            disabled={toggle.isPending}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
