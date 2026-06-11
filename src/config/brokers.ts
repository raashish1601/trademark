/**
 * Indian broker charge profiles — DATA, not code. Update here (or per-account
 * overrides in Settings) without touching the engine.
 *
 * Statutory rates verified June 2026 against zerodha.com/charges (kept current)
 * and the Budget 2026 STT revision (effective 1 Apr 2026):
 *   STT: options 0.15% sell-side premium · futures 0.05% sell · eq intraday 0.025% sell
 *   NSE txn: options 0.03553% premium · futures 0.00183% · equity 0.00307%
 *   SEBI ₹10/crore · GST 18% on (brokerage + txn + SEBI) · stamp (buy): opt/eq 0.003%, fut 0.002%
 * Percentages are fractions (0.0015 = 0.15%).
 */
export interface ChargeProfile {
  id: string;
  label: string;
  /** Flat brokerage per executed order (always applies to options). */
  brokeragePerOrder: number;
  /** Equity intraday: % of turnover per order, capped at the flat fee (0 = flat only). */
  brokerageEqMaxPct: number;
  /** Futures: % of turnover per order, capped at the flat fee (0 = flat only). */
  brokerageFutMaxPct: number;
  /** STT: options — on premium, SELL side. */
  sttOptionSellPct: number;
  /** STT: futures — on turnover, SELL side. */
  sttFutureSellPct: number;
  /** STT: equity intraday — SELL side. */
  sttEquityIntradaySellPct: number;
  /** Exchange transaction charges (NSE) — options on premium. */
  exchangeOptionPct: number;
  exchangeFuturePct: number;
  exchangeEquityPct: number;
  /** SEBI charges per crore of turnover. */
  sebiPerCrore: number;
  /** GST on (brokerage + exchange + SEBI). */
  gstPct: number;
  /** Stamp duty — BUY side. */
  stampOptionBuyPct: number;
  stampFutureBuyPct: number;
  stampEquityIntradayBuyPct: number;
}

// Statutory charges are identical across brokers (set by govt/exchanges).
const statutory = {
  sttOptionSellPct: 0.0015, // 0.15% on premium (sell) — Budget 2026
  sttFutureSellPct: 0.0005, // 0.05% (sell) — Budget 2026
  sttEquityIntradaySellPct: 0.00025, // 0.025% (sell)
  exchangeOptionPct: 0.0003553, // NSE 0.03553% on premium
  exchangeFuturePct: 0.0000183, // NSE 0.00183%
  exchangeEquityPct: 0.0000307, // NSE 0.00307%
  sebiPerCrore: 10,
  gstPct: 0.18,
  stampOptionBuyPct: 0.00003, // 0.003% (buy)
  stampFutureBuyPct: 0.00002, // 0.002% (buy)
  stampEquityIntradayBuyPct: 0.00003, // 0.003% (buy)
};

// Brokerage differs per broker (from each broker's pricing page, June 2026).
export const CHARGE_PROFILES: ChargeProfile[] = [
  { id: "zerodha", label: "Zerodha", brokeragePerOrder: 20, brokerageEqMaxPct: 0.0003, brokerageFutMaxPct: 0.0003, ...statutory },
  { id: "upstox", label: "Upstox", brokeragePerOrder: 20, brokerageEqMaxPct: 0.001, brokerageFutMaxPct: 0.0005, ...statutory },
  { id: "angelone", label: "Angel One", brokeragePerOrder: 20, brokerageEqMaxPct: 0.0025, brokerageFutMaxPct: 0.0025, ...statutory },
  { id: "dhan", label: "Dhan", brokeragePerOrder: 20, brokerageEqMaxPct: 0.0003, brokerageFutMaxPct: 0.0003, ...statutory },
  { id: "fyers", label: "Fyers", brokeragePerOrder: 20, brokerageEqMaxPct: 0.0003, brokerageFutMaxPct: 0.0003, ...statutory },
  { id: "groww", label: "Groww", brokeragePerOrder: 20, brokerageEqMaxPct: 0.001, brokerageFutMaxPct: 0.001, ...statutory },
  {
    id: "zero",
    label: "No charges (manual)",
    brokeragePerOrder: 0,
    brokerageEqMaxPct: 0,
    brokerageFutMaxPct: 0,
    ...statutory,
    sttOptionSellPct: 0,
    sttFutureSellPct: 0,
    sttEquityIntradaySellPct: 0,
    exchangeOptionPct: 0,
    exchangeFuturePct: 0,
    exchangeEquityPct: 0,
    sebiPerCrore: 0,
    gstPct: 0,
    stampOptionBuyPct: 0,
    stampFutureBuyPct: 0,
    stampEquityIntradayBuyPct: 0,
  },
];

export function getChargeProfile(id: string): ChargeProfile {
  return CHARGE_PROFILES.find((p) => p.id === id) ?? CHARGE_PROFILES[0]!;
}

export const BROKERS = CHARGE_PROFILES.filter((p) => p.id !== "zero").map((p) => ({
  id: p.id,
  label: p.label,
}));
