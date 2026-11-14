import type { IconName } from "./Icon";
import type { MonthState } from "./season-guide-core";

// The lines under the "Your year" calendar for one month. No React Native imports.
// Words as in preview/dashboard-ui (en), kept in one place so they can be checked and translated.

export type LineTone = "good" | "muted" | "warn" | "risk-dry" | "risk-hot" | "risk-wet";
export interface CalendarLine {
  icon: IconName;
  tone: LineTone;
  text: string;
}

export const RISK_TIPS = {
  dry: "Short of water: water if you can, or mulch to keep the soil wet.",
  hot: "Too hot for the crop this month.",
  wet: "Too wet for the crop: keep the drains open.",
} as const;

/** "Sorghum", "Sorghum and Corn", "Sorghum, Corn and Rice". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function yearCalendarLines(month: MonthState, name: (id: string) => string): CalendarLine[] {
  const out: CalendarLine[] = [];
  const growing = month.field.filter((id) => !month.plant.includes(id) && !month.harvest.includes(id));
  if (month.plant.length) out.push({ icon: "sprout", tone: "good", text: `Plant ${listNames(month.plant.map(name))}.` });
  if (month.harvest.length) out.push({ icon: "basket", tone: "good", text: `Harvest ${listNames(month.harvest.map(name))}.` });
  if (growing.length) out.push({ icon: "check", tone: "muted", text: `${listNames(growing.map(name))} in the field.` });
  if (month.field.length === 0) out.push({ icon: "alert", tone: "warn", text: "Nothing planted. Bare soil can wash away in heavy rain." });
  for (const r of month.risks) out.push({ icon: r === "dry" ? "sun" : r === "hot" ? "heat" : "drop", tone: `risk-${r}`, text: RISK_TIPS[r] });
  return out;
}
