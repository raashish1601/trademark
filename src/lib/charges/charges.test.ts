import { describe, expect, it } from "vitest";
import { computeCharges, computeGrossPnl, computeRMultiple } from "./charges";
import { getChargeProfile } from "@/config/brokers";

const zerodha = getChargeProfile("zerodha");

describe("computeGrossPnl", () => {
  it("long: profit when exit > entry", () => {
    expect(computeGrossPnl({ direction: "long", qty: 75, entryPrice: 100, exitPrice: 120 })).toBe(1500);
  });
  it("short: profit when exit < entry", () => {
    expect(computeGrossPnl({ direction: "short", qty: 75, entryPrice: 100, exitPrice: 80 })).toBe(1500);
  });
  it("long: loss when exit < entry", () => {
    expect(computeGrossPnl({ direction: "long", qty: 50, entryPrice: 200, exitPrice: 180 })).toBe(-1000);
  });
});

describe("computeCharges (options) — Budget 2026 rates", () => {
  const trade = { segment: "OPT" as const, qty: 75, entryPrice: 100, exitPrice: 120, direction: "long" as const };
  const breakdown = computeCharges(zerodha, trade);

  it("charges flat ₹20 brokerage per order (2 orders)", () => {
    expect(breakdown.brokerage).toBe(40);
  });
  it("applies STT only on the sell-side premium (0.15%)", () => {
    // sell turnover = 120 * 75 = 9000 → 0.15% = 13.5
    expect(breakdown.stt).toBeCloseTo(13.5, 2);
  });
  it("NSE transaction charge 0.03553% on premium turnover", () => {
    // total premium turnover = 7500 + 9000 = 16500 → 0.03553% = 5.86
    expect(breakdown.exchange).toBeCloseTo(5.86, 2);
  });
  it("applies stamp duty only on the buy side", () => {
    // buy turnover = 100 * 75 = 7500 → 0.003% = 0.23
    expect(breakdown.stampDuty).toBeCloseTo(0.23, 2);
  });
  it("total = sum of components", () => {
    const sum =
      breakdown.brokerage + breakdown.stt + breakdown.exchange + breakdown.sebi + breakdown.gst + breakdown.stampDuty;
    expect(breakdown.total).toBeCloseTo(sum, 1);
  });
});

describe("computeCharges (futures) — Budget 2026 rates", () => {
  it("applies 0.05% STT on the sell side", () => {
    const b = computeCharges(zerodha, { segment: "FUT", qty: 75, entryPrice: 24000, exitPrice: 24100, direction: "long" });
    // sell turnover = 24100 * 75 = 18,07,500 → 0.05% = 903.75
    expect(b.stt).toBeCloseTo(903.75, 1);
  });
});

describe("computeCharges (equity intraday)", () => {
  it("uses percentage brokerage cap when lower than flat", () => {
    // tiny turnover → 0.03% beats ₹20 flat
    const b = computeCharges(zerodha, { segment: "EQ", qty: 1, entryPrice: 100, exitPrice: 101, direction: "long" });
    expect(b.brokerage).toBeLessThan(40);
  });
  it("applies 0.025% STT on the sell side", () => {
    const b = computeCharges(zerodha, { segment: "EQ", qty: 100, entryPrice: 500, exitPrice: 510, direction: "long" });
    // sell turnover 51,000 → 0.025% = 12.75
    expect(b.stt).toBeCloseTo(12.75, 2);
  });
});

describe("per-broker brokerage differences", () => {
  it("Upstox futures cap (0.05%) differs from equity cap (0.1%)", () => {
    const upstox = getChargeProfile("upstox");
    const small = { qty: 1, entryPrice: 1000, exitPrice: 1000, direction: "long" as const };
    const eq = computeCharges(upstox, { segment: "EQ", ...small });
    const fut = computeCharges(upstox, { segment: "FUT", ...small });
    // per-order turnover 1000 → eq: 1000*0.1% = 1 ×2; fut: 1000*0.05% = 0.5 ×2
    expect(eq.brokerage).toBeCloseTo(2, 2);
    expect(fut.brokerage).toBeCloseTo(1, 2);
  });
});

describe("computeRMultiple", () => {
  it("computes +2R when reward = 2x risk", () => {
    expect(
      computeRMultiple({ direction: "long", entryPrice: 100, exitPrice: 120, plannedEntry: 100, plannedSl: 90 })
    ).toBe(2);
  });
  it("computes -1R at stop loss", () => {
    expect(
      computeRMultiple({ direction: "long", entryPrice: 100, exitPrice: 90, plannedEntry: 100, plannedSl: 90 })
    ).toBe(-1);
  });
  it("handles shorts", () => {
    expect(
      computeRMultiple({ direction: "short", entryPrice: 100, exitPrice: 90, plannedEntry: 100, plannedSl: 105 })
    ).toBe(2);
  });
  it("returns null without a stop", () => {
    expect(
      computeRMultiple({ direction: "long", entryPrice: 100, exitPrice: 110, plannedEntry: null, plannedSl: null })
    ).toBeNull();
  });
});
