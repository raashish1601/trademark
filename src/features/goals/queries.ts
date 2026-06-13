"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDb } from "@/providers/db-session-provider";
import { sanitizeGoalSettings, type GoalSettings } from "./compute";

/**
 * Goal settings live in the journal DB's key/value `settings` table, so they
 * persist identically in hosted, BYOD and local modes and travel with
 * mode-switch copies and backups. Additive only — no migration needed.
 */
const SETTINGS_KEY = "goals.v1";

export function useGoalSettings() {
  const { db } = useDb();
  return useQuery({
    queryKey: ["goal-settings"],
    queryFn: async (): Promise<GoalSettings> => {
      const res = await db.execute(`SELECT value FROM settings WHERE key = ?`, [SETTINGS_KEY]);
      const raw = res.rows[0]?.value;
      let parsed: unknown = null;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      return sanitizeGoalSettings(parsed);
    },
  });
}

export function useSaveGoalSettings() {
  const { db } = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: GoalSettings) => {
      await db.execute(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [
        SETTINGS_KEY,
        JSON.stringify(sanitizeGoalSettings(settings)),
      ]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["goal-settings"] }),
  });
}
