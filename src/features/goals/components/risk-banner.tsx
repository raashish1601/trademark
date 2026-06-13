"use client";

import * as React from "react";
import { ListX, OctagonAlert, X } from "lucide-react";
import { useTrades } from "@/features/trades";
import { formatINR } from "@/lib/utils";
import {
  dayRiskUsage,
  evaluateDayBreaches,
  istTodayKey,
  type Breach,
  type BreachKind,
} from "../compute";
import { dismissBreachKind, readDismissedKinds } from "../dismiss";
import { useGoalSettings } from "../queries";

function breachCopy(b: Breach): { title: string; body: string } {
  if (b.kind === "loss") {
    const loss = formatINR(b.lossPaise / 100, { decimals: true });
    const limit = formatINR(b.limitPaise / 100);
    return {
      title: "Daily max loss hit — stop for today",
      body: `You're down ${loss} today, ${
        b.lossPaise > b.limitPaise ? "past" : "at"
      } your ${limit} limit. Trading on from here is how small losses become big ones. Close the terminal and journal the day instead.`,
    };
  }
  return {
    title: "Daily trade limit reached — stop for today",
    body: `${b.count} trades today against your cap of ${b.limit}. More entries rarely fix a day — step away, or review what you've already taken.`,
  };
}

/**
 * Loud, non-blocking guardrail banners for today's breached risk limits.
 * Dismissing one silences that breach for the rest of the IST day (local-only).
 * Computed client-side from the already-fetched trade list — works the same in
 * hosted, BYOD and local modes.
 */
export function RiskGuardrailBanner() {
  const { data: trades } = useTrades({});
  const { data: settings } = useGoalSettings();
  const today = istTodayKey();
  // Dismissals are read after mount: localStorage is unavailable during SSR.
  const [dismissed, setDismissed] = React.useState<BreachKind[] | null>(null);
  React.useEffect(() => setDismissed(readDismissedKinds(today)), [today]);

  if (!trades || !settings || dismissed === null) return null;
  const breaches = evaluateDayBreaches(settings, dayRiskUsage(trades, today)).filter(
    (b) => !dismissed.includes(b.kind)
  );
  if (breaches.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="risk-banners">
      {breaches.map((b) => {
        const { title, body } = breachCopy(b);
        const Icon = b.kind === "loss" ? OctagonAlert : ListX;
        return (
          <div
            key={b.kind}
            role="alert"
            data-breach={b.kind}
            className="flex items-start gap-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2.5"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-loss" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-loss">{title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{body}</p>
            </div>
            <button
              type="button"
              aria-label={`Dismiss ${b.kind === "loss" ? "max-loss" : "trade-limit"} warning for today`}
              className="rounded p-1 text-muted transition-colors hover:bg-loss/15 hover:text-foreground"
              onClick={() => setDismissed(dismissBreachKind(b.kind, today))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
