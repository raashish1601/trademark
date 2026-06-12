import type { BreachKind } from "./compute";

/**
 * Per-day breach-banner dismissal. A dismissal is scoped to one IST day key —
 * tomorrow the guardrail speaks again. Stored client-side only (localStorage):
 * it is UI state, not journal data, so it never syncs across devices.
 */

const STORAGE_KEY = "tm.risk-dismissed";

const isKind = (k: unknown): k is BreachKind => k === "loss" || k === "trades";

/** Parses a stored dismissal; anything stale (other day) or malformed = []. */
export function parseDismissal(raw: string | null | undefined, dayKey: string): BreachKind[] {
  if (!raw) return [];
  try {
    const o = JSON.parse(raw) as { date?: unknown; kinds?: unknown };
    if (o?.date !== dayKey || !Array.isArray(o.kinds)) return [];
    return [...new Set(o.kinds.filter(isKind))];
  } catch {
    return [];
  }
}

export function serializeDismissal(kinds: BreachKind[], dayKey: string): string {
  return JSON.stringify({ date: dayKey, kinds: [...new Set(kinds)] });
}

export function readDismissedKinds(dayKey: string): BreachKind[] {
  if (typeof window === "undefined") return [];
  return parseDismissal(window.localStorage.getItem(STORAGE_KEY), dayKey);
}

/** Records a dismissal for the day and returns the updated kind list. */
export function dismissBreachKind(kind: BreachKind, dayKey: string): BreachKind[] {
  const kinds = [...new Set([...readDismissedKinds(dayKey), kind])];
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeDismissal(kinds, dayKey));
  } catch {
    // Quota/private-mode failures just mean the dismissal won't survive reload.
  }
  return kinds;
}
