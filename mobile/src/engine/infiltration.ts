// Storm infiltration indicator: how much of a heavy storm soaks in (does not run off) on a lot,
// month by month, by whether the field is bare or cropped (docs/07-rotation-engine.md §4).
// USDA NRCS TR-55 curve number method; every coefficient is in ./params.ts with its source.
// Pure TypeScript (no React Native imports). Not a weighted score: bare soil already counts in
// the soil (S) and washout (E) scores, so this is shown as a metric and in the explanations.
import type { SoilFeel } from "../types";
import {
  CN_INITIAL_ABSTRACTION_RATIO,
  CURVE_NUMBER,
  MM_PER_INCH,
  REFERENCE_STORM_MM,
  SOIL_FEEL_HSG,
} from "./params";

export type HydrologicSoilGroup = "A" | "B" | "C" | "D";

/** TR-55 eq. 2-1, 2-2, 2-4: share (0-1) of a `stormMm` storm that does not run off at curve number `cn`. */
export function soakShare(cn: number, stormMm: number = REFERENCE_STORM_MM): number {
  if (!(stormMm > 0) || !(cn > 0) || cn > 100) return NaN;
  const p = stormMm / MM_PER_INCH;
  const s = 1000 / cn - 10;
  const ia = CN_INITIAL_ABSTRACTION_RATIO * s;
  const q = p > ia ? (p - ia) ** 2 / (p - ia + s) : 0;
  return 1 - q / p;
}

export interface StormInfiltration {
  /** Rain-weighted share (0-1) of the reference storm that soaks in over the year; `null` = not computed. */
  share: number | null;
  /** Per calendar month (index 0 = January); `null` for months left out (paddy rice in the field). */
  by_month: (number | null)[];
  hsg: HydrologicSoilGroup;
  /** soil-feel = from the farmer's answer (TR-55 Appendix A) · assumed = "I don't know" (params SOIL_FEEL_HSG). */
  hsg_source: "soil-feel" | "assumed";
  storm_mm: number;
  /** Months left out because a ponded paddy crop is in the field (TR-55 tables are for upland fields). */
  paddy_months: number[];
  /** The per-month rain weight used (same as erosion); `null` when rain data is missing. */
  rain_weight: number[] | null;
}

/**
 * Rain-weighted share over the given calendar months only (1-12), so two options with paddy rice
 * in different months are compared on the same months. `null` when nothing can be weighted.
 */
export function soakShareOver(inf: StormInfiltration, months: readonly number[]): number | null {
  if (!inf.rain_weight) return null;
  let sum = 0;
  let wsum = 0;
  for (const m of months) {
    const v = inf.by_month[m - 1];
    const w = inf.rain_weight[m - 1];
    if (v === null || !(w > 0)) continue;
    sum += w * v;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : null;
}

/**
 * @param bareShareByMonth share (0-1) of each month with no crop in the field.
 * @param rainWeight per-month weight (heavy-rain days or typical rain), as in the erosion score.
 * @param paddyMonths calendar months (1-12) with a ponded paddy crop in the field; left out.
 */
export function stormInfiltration(
  soil: SoilFeel,
  bareShareByMonth: readonly number[],
  rainWeight: readonly (number | null)[],
  paddyMonths: readonly number[],
): StormInfiltration {
  const hsg = SOIL_FEEL_HSG[soil];
  const bare = soakShare(CURVE_NUMBER.bare[hsg]);
  const crop = soakShare(CURVE_NUMBER.crop[hsg]);
  const paddy = new Set(paddyMonths);
  const by_month = bareShareByMonth.map((b, i) => (paddy.has(i + 1) ? null : b * bare + (1 - b) * crop));
  const weights = rainWeight.length === 12 && rainWeight.every((w) => w !== null) ? (rainWeight as number[]) : null;
  const out: StormInfiltration = {
    share: null,
    by_month,
    hsg,
    hsg_source: soil === "unknown" ? "assumed" : "soil-feel",
    storm_mm: REFERENCE_STORM_MM,
    paddy_months: [...paddy].sort((a, b) => a - b),
    rain_weight: weights ? [...weights] : null,
  };
  out.share = soakShareOver(out, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  return out;
}
