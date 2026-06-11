/**
 * Journaling-streak math. A day counts as "logged" when the user recorded a
 * trade, wrote a journal entry, or explicitly marked "no trades today" —
 * sitting out with discipline is activity too.
 *
 * Weekends (Sat/Sun) neither extend nor break a streak: markets are shut, so
 * Friday → Monday is consecutive. Today being unlogged doesn't break the
 * streak either — it's simply still pending.
 */

export interface StreakResult {
  current: number;
  best: number;
  todayLogged: boolean;
}

const DAY_MS = 86_400_000;

const toUtc = (key: string) => new Date(`${key}T00:00:00Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const isWeekend = (key: string) => {
  const dow = toUtc(key).getUTCDay();
  return dow === 0 || dow === 6;
};

/** Previous market day (skips Sat/Sun). */
function prevTradingDay(key: string): string {
  let d = new Date(toUtc(key).getTime() - DAY_MS);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - DAY_MS);
  return toKey(d);
}

export function computeStreak(loggedDays: ReadonlySet<string>, todayKey: string): StreakResult {
  const todayLogged = loggedDays.has(todayKey);

  // Current streak: anchor on today if logged, otherwise on the most recent
  // weekday before today (today pending), and walk back trading days.
  let anchor: string | null = null;
  if (todayLogged) anchor = todayKey;
  else {
    const prev = isWeekend(todayKey) ? todayKey : prevTradingDay(todayKey);
    const candidate = isWeekend(prev) ? prevTradingDay(prev) : prev;
    if (loggedDays.has(candidate)) anchor = candidate;
  }

  let current = 0;
  if (anchor) {
    let cursor: string = anchor;
    while (loggedDays.has(cursor)) {
      if (!isWeekend(cursor)) current++;
      cursor = prevTradingDay(cursor);
    }
  }

  // Best streak: scan logged weekdays ascending, chaining via prevTradingDay.
  const sorted = [...loggedDays].filter((d) => !isWeekend(d)).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev !== null && prevTradingDay(day) === prev ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }

  return { current, best: Math.max(best, current), todayLogged };
}
