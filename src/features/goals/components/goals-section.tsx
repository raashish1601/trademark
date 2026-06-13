"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toPaise, type GoalSettings } from "../compute";
import { useGoalSettings, useSaveGoalSettings } from "../queries";

/** "" → off (null); rupee inputs keep paise via toPaise. */
const rupeesToPaise = (v: FormDataEntryValue | null): number | null => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? toPaise(n) : null;
};
const intOrNull = (v: FormDataEntryValue | null): number | null => {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
};
const paiseToInput = (paise: number | null): string | number => (paise == null ? "" : paise / 100);

export function GoalsSection() {
  const { data: settings } = useGoalSettings();
  const save = useSaveGoalSettings();

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals & risk limits</CardTitle>
        <CardDescription>
          Daily guardrails warn loudly on the dashboard and trades screens when crossed — they never
          block logging. Weekly goals show as progress on the dashboard. Leave a field blank to turn
          it off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const next: GoalSettings = {
              dailyMaxLossPaise: rupeesToPaise(f.get("dailyMaxLoss")),
              dailyMaxTrades: intOrNull(f.get("dailyMaxTrades")),
              weeklyProfitTargetPaise: rupeesToPaise(f.get("weeklyProfitTarget")),
              weeklyJournalDaysTarget: intOrNull(f.get("weeklyJournalDays")),
            };
            save.mutate(next, { onSuccess: () => toast.success("Goals saved") });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="goal-max-loss">Daily max loss ₹</Label>
            <Input
              id="goal-max-loss"
              name="dailyMaxLoss"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 2500"
              defaultValue={paiseToInput(settings.dailyMaxLossPaise)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="goal-max-trades">Max trades per day</Label>
            <Input
              id="goal-max-trades"
              name="dailyMaxTrades"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 3"
              defaultValue={settings.dailyMaxTrades ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="goal-weekly-profit">Weekly profit goal ₹</Label>
            <Input
              id="goal-weekly-profit"
              name="weeklyProfitTarget"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 10000"
              defaultValue={paiseToInput(settings.weeklyProfitTargetPaise)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="goal-journal-days">Journaling goal (days per week)</Label>
            <Input
              id="goal-journal-days"
              name="weeklyJournalDays"
              type="number"
              min="1"
              max="7"
              step="1"
              placeholder="e.g. 5"
              defaultValue={settings.weeklyJournalDaysTarget ?? ""}
            />
          </div>
          <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={save.isPending}>
            Save goals
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
