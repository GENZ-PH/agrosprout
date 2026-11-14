import { cropFit, type CropFit, type FitLevel, type FitReason } from "../engine/cropFit";
import { cropSeasonDays, harvestMonthOf } from "../engine/season";
import type { CropLibrary, LotData, LotDetails } from "../types";
import { monthShort } from "./months-core";

// S2 "Top 3 for this lot" (#152): every crop in the library rated on this lot's NASA data with the engine's
// crop fit (cropFit.ts), so the farmer sees which crops suit the lot, and when, before picking.
// Each crop is tried as one season of its usual length planted in each month (on the 15th, like
// the rotation engine's scan, docs/07 §3). No React Native imports, so it runs in Node tests.

export interface CropSuggestion {
  crop_id: string;
  /** Best fit over the 12 planting months; "unknown" when no month can be rated. */
  level: FitLevel;
  /** Planting months (1-12) rated Good fit. */
  good_months: number[];
  /** Planting months (1-12) that reach `level`; empty when unknown. */
  best_months: number[];
  /** The engine's reasons at the first of `best_months` (worst first); empty for Good and unknown. */
  reasons: FitReason[];
}

export interface LotSuggestions {
  /** One per library crop, in library order. */
  crops: CropSuggestion[];
}

/** Best first. Unknown is last: a month we cannot rate is never a reason to suggest a crop. */
const RANK: Record<FitLevel, number> = { good: 0, watch: 1, poor: 2, unknown: 3 };
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function lotSuggestions(details: LotDetails, data: Pick<LotData, "monthly">, library: CropLibrary): LotSuggestions {
  const crops = library.crops.map((crop): CropSuggestion => {
    const days = cropSeasonDays(crop).days;
    if (days === null) return { crop_id: crop.id, level: "unknown", good_months: [], best_months: [], reasons: [] };
    const fits: CropFit[] = MONTHS.map((m) =>
      cropFit({
        crop,
        lotCrop: { crop_id: crop.id, seasons: [{ plant_month: m, harvest_month: harvestMonthOf(m, days) }] },
        details,
        data,
        library,
      }),
    );
    const level = fits.map((f) => f.level).reduce((a, b) => (RANK[b] < RANK[a] ? b : a));
    const best_months = level === "unknown" ? [] : MONTHS.filter((_, i) => fits[i].level === level);
    return {
      crop_id: crop.id,
      level,
      good_months: MONTHS.filter((_, i) => fits[i].level === "good"),
      best_months,
      reasons: level === "watch" || level === "poor" ? fits[best_months[0] - 1].reasons : [],
    };
  });
  return { crops };
}

/**
 * The `n` crops that suit the lot best: best level first (Good, Watch out, Poor; unknown never), then more
 * planting months at that level (a team assumption: a wider window is more forgiving), then library order.
 */
export function topCrops(s: LotSuggestions, n = 3): CropSuggestion[] {
  return s.crops
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.level !== "unknown")
    .sort((a, b) => RANK[a.c.level] - RANK[b.c.level] || b.c.best_months.length - a.c.best_months.length || a.i - b.i)
    .slice(0, n)
    .map(({ c }) => c);
}

/** Good planting months as short ranges: [4..11] → "Apr–Nov", [1, 2, 11, 12] → "Nov–Feb", all 12 → "any month". */
export function goodMonthsText(months: readonly number[]): string {
  if (months.length === 0) return "";
  if (months.length === 12) return "any month";
  const set = new Set(months);
  // Start each run at a month whose previous month is not in the set, so a run can wrap over December.
  const starts = MONTHS.filter((m) => set.has(m) && !set.has(m === 1 ? 12 : m - 1));
  return starts
    .map((start) => {
      let end = start;
      while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
      return end === start ? monthShort(start) : `${monthShort(start)}–${monthShort(end)}`;
    })
    .join(", ");
}
