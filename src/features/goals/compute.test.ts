import { describe, expect, it } from "vitest";
import {
  EMPTY_GOAL_SETTINGS,
  dayRiskUsage,
  evaluateDayBreaches,
  istDayKey,
  istTodayKey,
  istWeekRange,
  sanitizeGoalSettings,
  toPaise,
  weeklyProgress,
  type GoalSettings,
  type GoalTradeLike,
} from "./compute";
import { parseDismissal, serializeDismissal } from "./dismiss";

const trade = (over: Partial<GoalTradeLike>): GoalTradeLike => ({
  status: "closed",
  net_pnl: 0,
  opened_at: "2026-06-12T04:00:00.000Z", // 09:30 IST June 12
  closed_at: "2026-06-12T09:00:00.000Z", // 14:30 IST June 12
  ...over,
});

const limits = (over: Partial<GoalSettings>): GoalSettings => ({
  ...EMPTY_GOAL_SETTINGS,
  ...over,
});

describe("istDayKey — IST day boundaries on UTC-stored instants", () => {
  it("maps a regular market-hours instant to its IST day", () => {
    expect(istDayKey("2026-06-12T04:00:00.000Z")).toBe("2026-06-12");
  });

  it("23:59:59 IST still belongs to the same IST day", () => {
    // 18:29:59Z = 23:59:59 IST
    expect(istDayKey("2026-06-12T18:29:59.000Z")).toBe("2026-06-12");
  });

  it("rolls to the next IST day exactly at 18:30Z (IST midnight)", () => {
    expect(istDayKey("2026-06-12T18:30:00.000Z")).toBe("2026-06-13");
  });

  it("early-IST-morning instants land on the IST day, not the UTC day", () => {
    // 20:15Z June 12 = 01:45 IST June 13
    expect(istDayKey("2026-06-12T20:15:00.000Z")).toBe("2026-06-13");
  });

  it("istTodayKey delegates to the same arithmetic", () => {
    expect(istTodayKey(new Date("2026-06-12T19:00:00.000Z"))).toBe("2026-06-13");
  });
});

describe("istWeekRange — Monday→Sunday IST", () => {
  it("mid-week date returns its surrounding week", () => {
    // June 10 2026 is a Wednesday.
    expect(istWeekRange(new Date("2026-06-10T06:00:00.000Z"))).toEqual({
      from: "2026-06-08",
      to: "2026-06-14",
    });
  });

  it("Sunday belongs to the week that started the previous Monday", () => {
    expect(istWeekRange(new Date("2026-06-14T06:00:00.000Z"))).toEqual({
      from: "2026-06-08",
      to: "2026-06-14",
    });
  });

  it("late Sunday UTC that is already Monday IST starts a new week", () => {
    // June 14 20:00Z = June 15 01:30 IST (Monday).
    expect(istWeekRange(new Date("2026-06-14T20:00:00.000Z"))).toEqual({
      from: "2026-06-15",
      to: "2026-06-21",
    });
  });
});

describe("toPaise — paise edges", () => {
  it("keeps exact paise", () => {
    expect(toPaise(-1234.56)).toBe(-123456);
    expect(toPaise(0.01)).toBe(1);
  });

  it("absorbs float representation noise (broker values are paise-rounded)", () => {
    // 4609.83 * 100 === 460982.99999999994 in IEEE-754.
    expect(toPaise(4609.83)).toBe(460983);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
});

describe("dayRiskUsage", () => {
  it("counts trades opened that IST day (open positions too) and sums only closed P&L", () => {
    const u = dayRiskUsage(
      [
        trade({ net_pnl: -250.5 }),
        trade({ net_pnl: -100.25 }),
        trade({ status: "open", closed_at: null, net_pnl: 0 }),
        // Opened the previous day, closed today → realized today, not counted.
        trade({ opened_at: "2026-06-11T05:00:00.000Z", net_pnl: -50 }),
      ],
      "2026-06-12"
    );
    expect(u.tradeCount).toBe(3);
    expect(u.realizedPnlPaise).toBe(-40075);
  });

  it("assigns a post-midnight-IST close to the next day", () => {
    const t = trade({
      opened_at: "2026-06-12T17:00:00.000Z", // 22:30 IST June 12
      closed_at: "2026-06-12T19:00:00.000Z", // 00:30 IST June 13
      net_pnl: -500,
    });
    expect(dayRiskUsage([t], "2026-06-12")).toEqual({
      dayKey: "2026-06-12",
      tradeCount: 1,
      realizedPnlPaise: 0,
    });
    expect(dayRiskUsage([t], "2026-06-13")).toEqual({
      dayKey: "2026-06-13",
      tradeCount: 0,
      realizedPnlPaise: -50000,
    });
  });

  it("sums per-trade paise so float dust never moves a breach", () => {
    const u = dayRiskUsage(
      [trade({ net_pnl: -1666.67 }), trade({ net_pnl: -1666.67 }), trade({ net_pnl: -1666.66 })],
      "2026-06-12"
    );
    expect(u.realizedPnlPaise).toBe(-500000);
  });
});

describe("evaluateDayBreaches", () => {
  const day = (pnlPaise: number, count: number) => ({
    dayKey: "2026-06-12",
    realizedPnlPaise: pnlPaise,
    tradeCount: count,
  });

  it("no limits configured → never breaches", () => {
    expect(evaluateDayBreaches(EMPTY_GOAL_SETTINGS, day(-9_999_999, 99))).toEqual([]);
  });

  it("loss exactly at the limit breaches (the allowance is spent)", () => {
    const out = evaluateDayBreaches(limits({ dailyMaxLossPaise: 50000 }), day(-50000, 1));
    expect(out).toEqual([{ kind: "loss", limitPaise: 50000, lossPaise: 50000 }]);
  });

  it("one paise inside the limit does not breach", () => {
    expect(evaluateDayBreaches(limits({ dailyMaxLossPaise: 50000 }), day(-49999, 1))).toEqual([]);
  });

  it("a profitable day never trips the loss guardrail", () => {
    expect(evaluateDayBreaches(limits({ dailyMaxLossPaise: 50000 }), day(123456, 1))).toEqual([]);
  });

  it("trade count at the cap breaches; under it does not", () => {
    expect(evaluateDayBreaches(limits({ dailyMaxTrades: 3 }), day(0, 3))).toEqual([
      { kind: "trades", limit: 3, count: 3 },
    ]);
    expect(evaluateDayBreaches(limits({ dailyMaxTrades: 3 }), day(0, 2))).toEqual([]);
  });

  it("reports both breaches together", () => {
    const out = evaluateDayBreaches(
      limits({ dailyMaxLossPaise: 100, dailyMaxTrades: 1 }),
      day(-101, 2)
    );
    expect(out.map((b) => b.kind)).toEqual(["loss", "trades"]);
  });
});

describe("weeklyProgress", () => {
  const now = new Date("2026-06-12T06:00:00.000Z"); // Friday, week = Jun 8–14

  it("sums only this week's realized P&L and clamps pct to 0–100", () => {
    const s = limits({ weeklyProfitTargetPaise: 100000 });
    const p = weeklyProgress(
      s,
      [
        trade({ net_pnl: 250.5 }),
        trade({ closed_at: "2026-06-07T09:00:00.000Z", net_pnl: 9999 }), // last week
        trade({ status: "open", closed_at: null, net_pnl: 123 }), // unrealized
      ],
      [],
      now
    );
    expect(p.weekFrom).toBe("2026-06-08");
    expect(p.weekTo).toBe("2026-06-14");
    expect(p.profit).toEqual({ targetPaise: 100000, actualPaise: 25050, pct: 25 });
    expect(p.journalDays).toBeNull();
  });

  it("a losing week clamps profit progress to 0, an over-achieving one to 100", () => {
    const s = limits({ weeklyProfitTargetPaise: 100000 });
    const lose = weeklyProgress(s, [trade({ net_pnl: -800 })], [], now);
    expect(lose.profit?.pct).toBe(0);
    const win = weeklyProgress(s, [trade({ net_pnl: 5000 })], [], now);
    expect(win.profit).toEqual({ targetPaise: 100000, actualPaise: 500000, pct: 100 });
  });

  it("counts unique journal dates inside the IST week only", () => {
    const s = limits({ weeklyJournalDaysTarget: 5 });
    const p = weeklyProgress(
      s,
      [],
      ["2026-06-08", "2026-06-09", "2026-06-09", "2026-06-07", "2026-06-15"],
      now
    );
    expect(p.journalDays).toEqual({ target: 5, actual: 2, pct: 40 });
  });

  it("close at 00:10 IST Monday counts toward the new week", () => {
    const s = limits({ weeklyProfitTargetPaise: 1000 });
    const t = trade({ closed_at: "2026-06-07T18:40:00.000Z", net_pnl: 10 }); // Mon 00:10 IST
    expect(weeklyProgress(s, [t], [], now).profit?.actualPaise).toBe(1000);
  });
});

describe("sanitizeGoalSettings", () => {
  it("clamps garbage to empty settings", () => {
    expect(sanitizeGoalSettings(null)).toEqual(EMPTY_GOAL_SETTINGS);
    expect(sanitizeGoalSettings("nope")).toEqual(EMPTY_GOAL_SETTINGS);
    expect(sanitizeGoalSettings({ dailyMaxLossPaise: "5000", dailyMaxTrades: NaN })).toEqual(
      EMPTY_GOAL_SETTINGS
    );
  });

  it("rejects zero/negative/absurd values, keeps valid ones, rounds floats", () => {
    expect(
      sanitizeGoalSettings({
        dailyMaxLossPaise: 250000.4,
        dailyMaxTrades: -2,
        weeklyProfitTargetPaise: 1e14,
        weeklyJournalDaysTarget: 9,
      })
    ).toEqual({
      dailyMaxLossPaise: 250000,
      dailyMaxTrades: null,
      weeklyProfitTargetPaise: null,
      weeklyJournalDaysTarget: null,
    });
    expect(sanitizeGoalSettings({ weeklyJournalDaysTarget: 7, dailyMaxTrades: 1 })).toEqual(
      limits({ weeklyJournalDaysTarget: 7, dailyMaxTrades: 1 })
    );
  });

  it("survives a settings JSON roundtrip", () => {
    const s = limits({ dailyMaxLossPaise: 50000, weeklyProfitTargetPaise: 1000000 });
    expect(sanitizeGoalSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe("banner dismissal (per IST day)", () => {
  it("roundtrips kinds for the same day", () => {
    const raw = serializeDismissal(["loss", "trades", "loss"], "2026-06-12");
    expect(parseDismissal(raw, "2026-06-12")).toEqual(["loss", "trades"]);
  });

  it("a stale dismissal from yesterday is ignored", () => {
    const raw = serializeDismissal(["loss"], "2026-06-11");
    expect(parseDismissal(raw, "2026-06-12")).toEqual([]);
  });

  it("malformed payloads never throw", () => {
    expect(parseDismissal("{not json", "2026-06-12")).toEqual([]);
    expect(
      parseDismissal(JSON.stringify({ date: "2026-06-12", kinds: "loss" }), "2026-06-12")
    ).toEqual([]);
    expect(
      parseDismissal(JSON.stringify({ date: "2026-06-12", kinds: ["loss", "bogus"] }), "2026-06-12")
    ).toEqual(["loss"]);
    expect(parseDismissal(null, "2026-06-12")).toEqual([]);
  });
});
