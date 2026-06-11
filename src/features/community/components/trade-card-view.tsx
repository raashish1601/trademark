import { TrendingDown, TrendingUp } from "lucide-react";
import { PnlText } from "@/components/shared/pnl-text";
import { cn } from "@/lib/utils";
import type { TradeCard } from "../types";

function instrumentLabel(t: TradeCard): string {
  if (t.segment === "OPT" && t.strike) {
    const exp = t.expiry
      ? ` · ${new Date(t.expiry + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : "";
    return `${t.symbol} ${t.strike} ${t.optionType ?? ""}${exp}`;
  }
  return t.segment === "FUT" ? `${t.symbol} FUT` : t.symbol;
}

/** The shared-trade snapshot, rendered as a structured idea card. */
export function TradeCardView({ card }: { card: TradeCard }) {
  const long = card.direction === "long";
  const rows: [string, string | null][] = [
    ["Entry", card.entry.toFixed(2)],
    ["Exit", card.exit != null ? card.exit.toFixed(2) : null],
    ["SL", card.sl != null ? card.sl.toFixed(2) : null],
    ["Target", card.target != null ? card.target.toFixed(2) : null],
  ];

  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-surface-2/40">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        {long ? (
          <TrendingUp className="h-4 w-4 text-profit" aria-hidden />
        ) : (
          <TrendingDown className="h-4 w-4 text-loss" aria-hidden />
        )}
        <span className="text-sm font-semibold">{instrumentLabel(card)}</span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase",
            long ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
          )}
        >
          {card.direction}
        </span>
        <span className="ml-auto flex items-center gap-2 font-money text-xs">
          {card.rMultiple != null && (
            <span className={card.rMultiple >= 0 ? "text-profit" : "text-loss"}>
              {card.rMultiple > 0 ? "+" : ""}
              {card.rMultiple}R
            </span>
          )}
          {card.netPnl != null && <PnlText value={card.netPnl} className="text-xs" />}
        </span>
      </div>
      <dl className="grid grid-cols-4 divide-x">
        {rows.map(([label, value]) => (
          <div key={label} className="px-3 py-2 text-center">
            <dt className="micro-label">{label}</dt>
            <dd className="mt-0.5 font-money text-sm">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {(card.holdMins != null || card.openedAt) && (
        <div className="border-t px-3 py-1.5 text-[11px] text-muted">
          {new Date(card.openedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {card.holdMins != null && <> · held {card.holdMins < 60 ? `${card.holdMins}m` : `${Math.round(card.holdMins / 60)}h`}</>}
        </div>
      )}
    </div>
  );
}
