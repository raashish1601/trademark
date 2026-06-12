/**
 * Goals & risk limits — pure breach and progress math.
 *
 * Money: limits are stored as integer paise (settings JSON); trade rows store
 * rupees, so every comparison converts via toPaise() exactly once. Days: the
 * trading day is the IST calendar day (Indian market sessions; IST is a fixed
 * UTC+5:30 with no DST), computed arithmetically so results are identical on
 * any host timezone.
 */

const IST_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;
const MAX_PAISE = 1e13; // ₹100 crore ceiling — anything above is a typo.

export interface GoalSettings {
  /** Daily realized-loss guardrail, positive paise. null = off. */
  dailyMaxLossPaise: number | null;
  /** Max trades opened per day. null = off. */
  dailyMaxTrades: number | null;
  /** Weekly realized net-profit goal, positive paise. null = off. */
  weeklyProfitTargetPaise: number | null;
  /** Process goal: journal entries per week (1–7). null = off. */
  weeklyJournalDaysTarget: number | null;
}

export const EMPTY_GOAL_SETTINGS: GoalSettings = {
  dailyMaxLossPaise: null,
  dailyMaxTrades: null,
  weeklyProfitTargetPaise: null,
  weeklyJournalDaysTarget: null,
};

/** Rupees (DB REAL) → integer paise. Trades are paise-rounded at save time. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** IST calendar day (YYYY-MM-DD) of an instant. */
export function istDayKey(instant: string | Date): string {
  const t = typeof instant === "string" ? new Date(instant) : instant;
  return new Date(t.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function istTodayKey(now: Date = new Date()): string {
  return istDayKey(now);
}

/** Monday→Sunday IST week containing `now`, as inclusive day keys. */
export function istWeekRange(now: Date = new Date()): { from: string; to: string } {
  // In shifted-UTC space the UTC fields ARE the IST fields.
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const sinceMonday = (shifted.getUTCDay() + 6) % 7;
  const monday = new Date(shifted.getTime() - sinceMonday * DAY_MS);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

export interface GoalTradeLike {
  status: string;
  net_pnl: number;
  opened_at: string;
  closed_at: string | null;
}

export interface DayRiskUsage {
  dayKey: string;
  /** Net realized P&L (paise) of trades CLOSED on the day. */
  realizedPnlPaise: number;
  /** Trades OPENED on the day, any status — open positions count. */
  tradeCount: number;
}

export function dayRiskUsage(trades: GoalTradeLike[], dayKey: string): DayRiskUsage {
  let realizedPnlPaise = 0;
  let tradeCount = 0;
  for (const t of trades) {
    if (istDayKey(t.opened_at) === dayKey) tradeCount++;
    if (t.status === "closed" && t.closed_at && istDayKey(t.closed_at) === dayKey) {
      realizedPnlPaise += toPaise(t.net_pnl);
    }
  }
  return { dayKey, realizedPnlPaise, tradeCount };
}

export type BreachKind = "loss" | "trades";

export type Breach =
  | { kind: "loss"; limitPaise: number; lossPaise: number }
  | { kind: "trades"; limit: number; count: number };

/** A limit reached counts as breached — the allowance is spent. */
export function evaluateDayBreaches(settings: GoalSettings, usage: DayRiskUsage): Breach[] {
  const breaches: Breach[] = [];
  const { dailyMaxLossPaise, dailyMaxTrades } = settings;
  if (dailyMaxLossPaise != null && usage.realizedPnlPaise <= -dailyMaxLossPaise) {
    breaches.push({
      kind: "loss",
      limitPaise: dailyMaxLossPaise,
      lossPaise: -usage.realizedPnlPaise,
    });
  }
  if (dailyMaxTrades != null && usage.tradeCount >= dailyMaxTrades) {
    breaches.push({ kind: "trades", limit: dailyMaxTrades, count: usage.tradeCount });
  }
  return breaches;
}

export interface WeeklyProgress {
  weekFrom: string;
  weekTo: string;
  profit: { targetPaise: number; actualPaise: number; pct: number } | null;
  journalDays: { target: number; actual: number; pct: number } | null;
}

const clampPct = (actual: number, target: number): number =>
  target <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((actual / target) * 100)));

export function weeklyProgress(
  settings: GoalSettings,
  trades: GoalTradeLike[],
  journalDates: string[],
  now: Date = new Date()
): WeeklyProgress {
  const { from, to } = istWeekRange(now);
  let profit: WeeklyProgress["profit"] = null;
  if (settings.weeklyProfitTargetPaise != null) {
    let actualPaise = 0;
    for (const t of trades) {
      if (t.status !== "closed" || !t.closed_at) continue;
      const day = istDayKey(t.closed_at);
      if (day >= from && day <= to) actualPaise += toPaise(t.net_pnl);
    }
    const targetPaise = settings.weeklyProfitTargetPaise;
    profit = { targetPaise, actualPaise, pct: clampPct(actualPaise, targetPaise) };
  }
  let journalDays: WeeklyProgress["journalDays"] = null;
  if (settings.weeklyJournalDaysTarget != null) {
    const target = settings.weeklyJournalDaysTarget;
    // Journal dates are calendar day keys already (journal_entries.date).
    const actual = new Set(journalDates.filter((d) => d >= from && d <= to)).size;
    journalDays = { target, actual, pct: clampPct(actual, target) };
  }
  return { weekFrom: from, weekTo: to, profit, journalDays };
}

const posInt = (v: unknown, max: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 && n <= max ? n : null;
};

/** Clamps untrusted persisted JSON into a valid GoalSettings (never throws). */
export function sanitizeGoalSettings(raw: unknown): GoalSettings {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_GOAL_SETTINGS };
  const o = raw as Record<string, unknown>;
  return {
    dailyMaxLossPaise: posInt(o.dailyMaxLossPaise, MAX_PAISE),
    dailyMaxTrades: posInt(o.dailyMaxTrades, 1000),
    weeklyProfitTargetPaise: posInt(o.weeklyProfitTargetPaise, MAX_PAISE),
    weeklyJournalDaysTarget: posInt(o.weeklyJournalDaysTarget, 7),
  };
}
