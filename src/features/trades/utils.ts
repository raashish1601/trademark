import { computeCharges, computeGrossPnl, computeRMultiple } from "@/lib/charges/charges";
import { getChargeProfile } from "@/config/brokers";
import type { TradeFormValues, TradeLeg } from "./schemas";

export interface DerivedNumbers {
  status: "open" | "closed";
  gross: number;
  charges: number;
  net: number;
  r: number | null;
}

export interface LegAggregate {
  qty: number;
  avgEntry?: number;
  avgExit?: number;
  exitQty: number;
  closed: boolean;
  openedAt?: string;
  closedAt?: string;
  orders: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Aggregates executed legs into the trade's headline numbers.
 * Entry side follows direction (long → buys). The trade counts as closed only
 * when the exit quantity covers the entry quantity; partial exits stay open.
 */
export function aggregateLegs(legs: TradeLeg[], direction: "long" | "short"): LegAggregate {
  const entrySide = direction === "long" ? "buy" : "sell";
  let entryQty = 0,
    entryValue = 0,
    exitQty = 0,
    exitValue = 0;
  let first: string | undefined, last: string | undefined;
  let orders = 0;
  for (const leg of legs) {
    // Form inputs arrive as strings — coerce so we add numbers, not concatenate.
    const qty = Number(leg.qty);
    const price = Number(leg.price);
    if (!qty || !price) continue;
    orders++;
    if (leg.side === entrySide) {
      entryQty += qty;
      entryValue += qty * price;
    } else {
      exitQty += qty;
      exitValue += qty * price;
    }
    if (leg.time) {
      if (!first || leg.time < first) first = leg.time;
      if (!last || leg.time > last) last = leg.time;
    }
  }
  const closed = entryQty > 0 && exitQty >= entryQty;
  return {
    qty: entryQty,
    avgEntry: entryQty ? r2(entryValue / entryQty) : undefined,
    avgExit: closed && exitQty ? r2(exitValue / exitQty) : undefined,
    exitQty,
    closed,
    openedAt: first,
    closedAt: closed ? last : undefined,
    orders,
  };
}

/** Computes gross/charges/net/R for a trade form. Open trades carry zeros until closed. */
export function deriveTradeNumbers(
  values: TradeFormValues,
  chargeProfileId: string
): DerivedNumbers {
  if (values.avgExit == null) {
    return { status: "open", gross: 0, charges: 0, net: 0, r: null };
  }
  // Multi-leg trades pay brokerage per executed order, not per round trip.
  const orders = values.legs && values.legs.length >= 2 ? values.legs.length : 2;
  const gross = computeGrossPnl({
    direction: values.direction,
    qty: values.qty,
    entryPrice: values.avgEntry,
    exitPrice: values.avgExit,
  });
  const charges =
    values.manualCharges != null
      ? values.manualCharges
      : computeCharges(getChargeProfile(chargeProfileId), {
          segment: values.segment,
          qty: values.qty,
          entryPrice: values.avgEntry,
          exitPrice: values.avgExit,
          direction: values.direction,
          orders,
        }).total;
  const net = Math.round((gross - charges) * 100) / 100;
  const r = computeRMultiple({
    direction: values.direction,
    entryPrice: values.avgEntry,
    exitPrice: values.avgExit,
    plannedEntry: values.plannedEntry ?? null,
    plannedSl: values.plannedSl ?? null,
  });
  return { status: "closed", gross, charges, net, r };
}

/** datetime-local input value ("YYYY-MM-DDTHH:mm") → ISO string. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

/** ISO string → datetime-local input value in the user's timezone. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
}
