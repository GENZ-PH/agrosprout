// Season calendar helpers: which days of which months a crop occupies.
// Pure TypeScript (no React Native imports).
import { DAYS_IN_MONTH } from "../data/et0";
import type { Crop, CropSeason } from "../types";
import {
  FARMER_SEASON_TOLERANCE,
  MEAN_DAYS_PER_MONTH,
  PLANTING_DAY_OF_MONTH,
} from "./params";

/** Day of year (0-based, common year) of the 1st of a month (1-12). */
export function monthStartDay(month: number): number {
  let d = 0;
  for (let m = 0; m < month - 1; m++) d += DAYS_IN_MONTH[m];
  return d;
}

/** Calendar month (1-12) of a 0-based day of year, wrapping into the next year. */
export function monthOfDay(dayOfYear: number): number {
  let d = ((dayOfYear % 365) + 365) % 365;
  for (let m = 0; m < 12; m++) {
    if (d < DAYS_IN_MONTH[m]) return m + 1;
    d -= DAYS_IN_MONTH[m];
  }
  return 12;
}

/** Month after `month` steps (1-12, wraps). */
export function addMonths(month: number, steps: number): number {
  return ((((month - 1 + steps) % 12) + 12) % 12) + 1;
}

/** Number of months from plant to harvest month (11 -> 2 is 3). Same month = 12. */
export function monthSpan(plant: number, harvest: number): number {
  const span = (harvest - plant + 12) % 12;
  return span === 0 ? 12 : span;
}

/** Season length in days from the crop library: `season_days`, else the sum of FAO-56 stages. */
export function cropSeasonDays(crop: Crop): { days: number | null; fromFaoStages: boolean } {
  if (crop.season_days) return { days: crop.season_days, fromFaoStages: false };
  if (crop.stages_days) {
    return { days: crop.stages_days.reduce((a, b) => a + b, 0), fromFaoStages: true };
  }
  return { days: null, fromFaoStages: false };
}

/**
 * Season length for one farmer season: the farmer's plant-to-harvest
 * duration if it is within FARMER_SEASON_TOLERANCE of the crop's season
 * length (07 §3b), else the crop's season length.
 */
export function seasonLengthDays(
  crop: Crop,
  season: CropSeason,
): { days: number | null; source: "farmer" | "crop" | "fao-stages" } {
  const lib = cropSeasonDays(crop);
  const farmerDays = Math.round(monthSpan(season.plant_month, season.harvest_month) * MEAN_DAYS_PER_MONTH);
  if (lib.days === null) return { days: farmerDays, source: "farmer" };
  if (Math.abs(farmerDays - lib.days) <= FARMER_SEASON_TOLERANCE * lib.days) {
    return { days: farmerDays, source: "farmer" };
  }
  return { days: lib.days, source: lib.fromFaoStages ? "fao-stages" : "crop" };
}

/** Crop coefficient on day `d` (0-based) of a season, FAO-56 Eq. 66 (linear in dev and late stages). */
export function kcOnDay(
  d: number,
  stages: readonly [number, number, number, number],
  kc: readonly [number, number, number],
): number {
  const [ini, dev, mid] = stages;
  const late = stages[3];
  const [kcIni, kcMid, kcEnd] = kc;
  if (d < ini) return kcIni;
  if (d < ini + dev) return kcIni + ((d - ini) / dev) * (kcMid - kcIni);
  if (d < ini + dev + mid) return kcMid;
  return kcMid + (Math.min(d - ini - dev - mid, late) / late) * (kcEnd - kcMid);
}

/** FAO-56 stage lengths rescaled to a season length (FAO-56 advises adjusting to local season length). */
export function rescaleStages(
  stages: readonly [number, number, number, number],
  seasonDays: number,
): [number, number, number, number] {
  const total = stages.reduce((a, b) => a + b, 0);
  return stages.map((s) => (s * seasonDays) / total) as [number, number, number, number];
}

export interface SeasonMonth {
  /** Calendar month, 1-12. */
  month: number;
  /** Crop days falling in this month. */
  days: number;
  /** Mean Kc over those days. */
  kcMean: number;
}

/**
 * Split a season into calendar months, starting on PLANTING_DAY_OF_MONTH of
 * `plantMonth`. Returns months in season order (may wrap the year).
 */
export function seasonMonths(
  plantMonth: number,
  seasonDays: number,
  stages: readonly [number, number, number, number],
  kc: readonly [number, number, number],
): SeasonMonth[] {
  const scaled = rescaleStages(stages, seasonDays);
  const start = monthStartDay(plantMonth) + PLANTING_DAY_OF_MONTH - 1;
  const out: SeasonMonth[] = [];
  const n = Math.round(seasonDays);
  for (let d = 0; d < n; d++) {
    const month = monthOfDay(start + d);
    const k = kcOnDay(d + 0.5, scaled, kc);
    const last = out[out.length - 1];
    if (last && last.month === month) {
      last.kcMean += k;
      last.days += 1;
    } else {
      out.push({ month, days: 1, kcMean: k });
    }
  }
  for (const m of out) m.kcMean /= m.days;
  return out;
}

/** Calendar month (1-12) a season ends in. */
export function harvestMonthOf(plantMonth: number, seasonDays: number): number {
  return monthOfDay(monthStartDay(plantMonth) + PLANTING_DAY_OF_MONTH - 1 + Math.round(seasonDays) - 1);
}
