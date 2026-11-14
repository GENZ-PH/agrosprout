import type { Crop, CropSeason } from "../types";

// S4 "When do you plant?" (#34): picking a season on a 12-month strip. Plain logic, no
// React Native imports, so it runs in Node tests. Months are 1-12 (Jan = 1).

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
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

export const monthShort = (m: number) => MONTH_SHORT[(m - 1 + 12) % 12];
export const monthLong = (m: number) => MONTH_LONG[(m - 1 + 12) % 12];

/** Months from planting through harvest, across the new year when needed: Nov → Mar = 11, 12, 1, 2, 3. */
export function monthRange(plant: number, harvest: number): number[] {
  const out = [plant];
  for (let m = plant; m !== harvest; ) {
    m = (m % 12) + 1;
    out.push(m);
  }
  return out;
}

/** "Jun → Oct" */
export const seasonLabel = (s: CropSeason) => `${monthShort(s.plant_month)} → ${monthShort(s.harvest_month)}`;

/** Word joiners keep "Nov–Mar" on one line (no break at the dash); they are invisible. */
const DASH = "\u2060–\u2060";

/** "Jun–Oct and Nov–Mar" */
export function seasonsText(seasons: readonly CropSeason[]): string {
  const parts = seasons.map((s) => `${monthShort(s.plant_month)}${DASH}${monthShort(s.harvest_month)}`);
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The crop's typical local calendar from crops.json (cited there), as seasons. Empty when it has none. */
export const usualSeasons = (crop: Pick<Crop, "typical_calendar">): CropSeason[] =>
  crop.typical_calendar.map((c) => ({ plant_month: c.plant_month, harvest_month: c.harvest_month }));

/** A season being picked: the planting month is tapped, the harvest month not yet. */
export type Draft = { plant: number } | null;

export type PickResult =
  | { kind: "draft"; draft: Draft }
  /** Both months tapped: save this season. */
  | { kind: "season"; season: CropSeason }
  /** The same month twice: a season needs a different harvest month. */
  | { kind: "same-month"; draft: Draft };

/** One tap on the strip: the first tap is the planting month, the second the harvest month. */
export function pickMonth(draft: Draft, month: number): PickResult {
  if (!draft) return { kind: "draft", draft: { plant: month } };
  if (month === draft.plant) return { kind: "same-month", draft };
  return { kind: "season", season: { plant_month: draft.plant, harvest_month: month } };
}

export type CellState = "plant" | "harvest" | "growing" | "none";

/** How one month cell looks: for a draft only the planting month shows; for a season the whole range. */
export function cellState(month: number, season: CropSeason | null, draft: Draft): CellState {
  if (draft) return month === draft.plant ? "plant" : "none";
  if (!season) return "none";
  if (month === season.plant_month) return "plant";
  if (month === season.harvest_month) return "harvest";
  return monthRange(season.plant_month, season.harvest_month).includes(month) ? "growing" : "none";
}
