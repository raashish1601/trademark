import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

// 2026-06-11 is a Thursday; 2026-06-08 Mon, 06-05 Fri, 06-06/07 weekend.
const days = (...d: string[]) => new Set(d);

describe("computeStreak", () => {
  it("counts consecutive logged weekdays ending today", () => {
    const r = computeStreak(days("2026-06-09", "2026-06-10", "2026-06-11"), "2026-06-11");
    expect(r.current).toBe(3);
    expect(r.todayLogged).toBe(true);
  });

  it("weekends bridge Friday → Monday", () => {
    const r = computeStreak(days("2026-06-05", "2026-06-08", "2026-06-09"), "2026-06-09");
    expect(r.current).toBe(3);
  });

  it("today unlogged is pending, not a break", () => {
    const r = computeStreak(days("2026-06-09", "2026-06-10"), "2026-06-11");
    expect(r.current).toBe(2);
    expect(r.todayLogged).toBe(false);
  });

  it("a missed weekday breaks the streak", () => {
    // 06-09 missing → only 06-10 + 06-11 count.
    const r = computeStreak(days("2026-06-08", "2026-06-10", "2026-06-11"), "2026-06-11");
    expect(r.current).toBe(2);
  });

  it("no-trade day keeps the chain alive (same as any logged day)", () => {
    // 06-10 was a deliberate sit-out, logged as no-trade.
    const r = computeStreak(days("2026-06-09", "2026-06-10", "2026-06-11"), "2026-06-11");
    expect(r.current).toBe(3);
  });

  it("best streak is the longest historical run", () => {
    const r = computeStreak(
      days("2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-06-11"),
      "2026-06-11"
    );
    expect(r.best).toBe(4);
    expect(r.current).toBe(1);
  });

  it("empty set → zeros", () => {
    const r = computeStreak(days(), "2026-06-11");
    expect(r).toEqual({ current: 0, best: 0, todayLogged: false });
  });

  it("weekend 'today' anchors on Friday", () => {
    // Saturday check-in: Fri+Thu logged → streak 2 intact.
    const r = computeStreak(days("2026-06-04", "2026-06-05"), "2026-06-06");
    expect(r.current).toBe(2);
  });

  it("weekend logging counts toward chain but not the number", () => {
    // Saturday journal entry shouldn't inflate the count.
    const r = computeStreak(days("2026-06-05", "2026-06-06", "2026-06-08"), "2026-06-08");
    expect(r.current).toBe(2);
  });
});
