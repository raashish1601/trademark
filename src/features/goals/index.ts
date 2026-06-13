// Public API of the goals feature — other features import only from here.
export { GoalsSection } from "./components/goals-section";
export { RiskGuardrailBanner } from "./components/risk-banner";
export { WeeklyGoalsWidget } from "./components/weekly-goals-widget";
export {
  EMPTY_GOAL_SETTINGS,
  dayRiskUsage,
  evaluateDayBreaches,
  istDayKey,
  istTodayKey,
  istWeekRange,
  sanitizeGoalSettings,
  toPaise,
  weeklyProgress,
} from "./compute";
export type {
  Breach,
  BreachKind,
  DayRiskUsage,
  GoalSettings,
  GoalTradeLike,
  WeeklyProgress,
} from "./compute";
export { parseDismissal, serializeDismissal } from "./dismiss";
export { useGoalSettings, useSaveGoalSettings } from "./queries";
