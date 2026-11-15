// SI for one month of the year strip (2026-11-15). Builds what is sent to /v1/explain-month from
// engine output and the lot's NASA numbers for that month (no location, no names: CLAUDE.md rule 8),
// and keeps answers on the device so hovering the same month again, or coming back later, does not
// call the model again. Pure TypeScript, no React Native imports.
import type { RotationOption } from "../engine";
import type { LotData } from "../types";
import { monthStates } from "./season-guide-core";
import { yearCalendarLines } from "./year-calendar-core";

export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Matches `explainMonthBody` in api/src/routes/explain.ts. */
export type ExplainMonthRequest = { month: string; suggestion: string[]; yours: string[]; climate: string; satellite?: string[] };

/** One month of the strip: its calendar month (0-11), year, and whether it is past, now or ahead. */
export interface StripMonth {
  month: number;
  year: number;
  when: "past" | "now" | "ahead";
}

/** `back` months before this month, this month, then `ahead` months after it. */
export function stripMonths(today: Date, back = 12, ahead = 23): StripMonth[] {
  const out: StripMonth[] = [];
  for (let i = -back; i <= ahead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    out.push({ month: d.getMonth(), year: d.getFullYear(), when: i < 0 ? "past" : i === 0 ? "now" : "ahead" });
  }
  return out;
}

const r = (v: number | null | undefined) => (v == null ? null : Math.round(v));

/** NASA POWER, the data the scores use: "Rain in a typical year: 244 mm (dry year 164 mm, wet year 305 mm). Water the air takes: 102 mm." */
export function monthClimate(monthly: Pick<LotData["monthly"], "precip_mm" | "et0_mm">, month: number): string {
  const p50 = r(monthly.precip_mm.p50[month]);
  const p20 = r(monthly.precip_mm.p20[month]);
  const p80 = r(monthly.precip_mm.p80[month]);
  const et0 = r(monthly.et0_mm[month]);
  const rain = p50 == null ? "Rain: not known." : `Rain in a typical year: ${p50} mm (dry year ${p20 ?? "?"} mm, wet year ${p80 ?? "?"} mm).`;
  const air = et0 == null ? "" : ` Water the air takes from the soil: ${et0} mm.`;
  return rain + air;
}

/** The engine's own lines for one calendar month (0-11) of a plan. */
export function monthLines(option: RotationOption, month: number, name: (id: string) => string): string[] {
  return yearCalendarLines(monthStates(option)[month], name).map((l) => l.text);
}

export function explainMonthRequest(args: {
  month: number;
  pick: RotationOption;
  a: RotationOption | undefined;
  monthly: Pick<LotData["monthly"], "precip_mm" | "et0_mm">;
  name: (id: string) => string;
  /** NASA satellite lines for this month (`satelliteMonthFacts`); left out when there are none. */
  satellite?: (month: number) => string[];
}): ExplainMonthRequest {
  const { month, pick, a, monthly, name } = args;
  const sat = args.satellite?.(month).slice(0, 8) ?? [];
  return {
    month: MONTH_LONG[month],
    suggestion: monthLines(pick, month, name).slice(0, 8),
    yours: a ? monthLines(a, month, name).slice(0, 8) : [],
    climate: monthClimate(monthly, month).slice(0, 300),
    ...(sat.length ? { satellite: sat.map((l) => l.slice(0, 400)) } : {}),
  };
}

const PREFIX = "si-month:";

/** A saved answer for this request, or null (no storage, or not asked before). */
export function readSaved(storage: Pick<Storage, "getItem"> | null, key: string): string | null {
  try {
    return storage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function save(storage: Pick<Storage, "setItem"> | null, key: string, text: string): void {
  try {
    storage?.setItem(PREFIX + key, text);
  } catch {
    // Storage full or blocked: the answer is still kept for this visit.
  }
}
