import { describe, expect, it } from "vitest";
import { aggregateLegs } from "./utils";
import type { TradeLeg } from "./schemas";

const L = (
  side: "buy" | "sell",
  qty: number,
  price: number,
  time = "2026-06-11T10:00"
): TradeLeg => ({
  side,
  qty,
  price,
  time,
});

describe("aggregateLegs", () => {
  it("computes weighted averages for a scale-in long", () => {
    const a = aggregateLegs(
      [
        L("buy", 75, 100, "2026-06-11T09:30"),
        L("buy", 75, 110, "2026-06-11T09:45"),
        L("sell", 150, 120, "2026-06-11T10:15"),
      ],
      "long"
    );
    expect(a.qty).toBe(150);
    expect(a.avgEntry).toBe(105); // (75×100 + 75×110) / 150
    expect(a.avgExit).toBe(120);
    expect(a.closed).toBe(true);
    expect(a.orders).toBe(3);
    expect(a.openedAt).toBe("2026-06-11T09:30");
    expect(a.closedAt).toBe("2026-06-11T10:15");
  });

  it("partial exits keep the trade open (no avgExit)", () => {
    const a = aggregateLegs([L("buy", 100, 50), L("sell", 40, 55)], "long");
    expect(a.qty).toBe(100);
    expect(a.exitQty).toBe(40);
    expect(a.closed).toBe(false);
    expect(a.avgExit).toBeUndefined();
    expect(a.closedAt).toBeUndefined();
  });

  it("short trades treat sells as entries", () => {
    const a = aggregateLegs([L("sell", 50, 200), L("sell", 50, 210), L("buy", 100, 190)], "short");
    expect(a.qty).toBe(100);
    expect(a.avgEntry).toBe(205);
    expect(a.avgExit).toBe(190);
    expect(a.closed).toBe(true);
  });

  it("ignores incomplete rows and scale-out averages correctly", () => {
    const a = aggregateLegs(
      [
        L("buy", 100, 80),
        { side: "sell", qty: 0, price: 0, time: "" } as TradeLeg, // blank row
        L("sell", 60, 90),
        L("sell", 40, 100),
      ],
      "long"
    );
    expect(a.orders).toBe(3);
    expect(a.avgExit).toBe(94); // (60×90 + 40×100) / 100
    expect(a.closed).toBe(true);
  });
});
