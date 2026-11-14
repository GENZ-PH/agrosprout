import { cropFit, type CropFit, type FitLevel, type FitReason, type FitReasonCode } from "../engine/cropFit";
import { cropSeasonDays, harvestMonthOf } from "../engine/season";
import type { CropLibrary, LotData, LotDetails } from "../types";
import { fitReasonText } from "../components/recommendations-core";
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
 * The `n` crops that suit the lot best: best level first (Good, then Watch out), then more planting months at
 * that level (a team assumption: a wider window is more forgiving), then library order. Never listed: Poor fit
 * and unknown crops, and crops rated without part of the check (`fullyRated`): a "top" crop that grows poorly
 * in every month, or whose water use was never checked, would mislead (`noCropFits` covers that case).
 */
export function topCrops(s: LotSuggestions, n = 3): CropSuggestion[] {
  return s.crops
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (c.level === "good" || c.level === "watch") && fullyRated(c))
    .sort((a, b) => RANK[a.c.level] - RANK[b.c.level] || b.c.best_months.length - a.c.best_months.length || a.i - b.i)
    .slice(0, n)
    .map(({ c }) => c);
}

/**
 * False when part of the crop's check could not run (a reason at level unknown: no Kc in crops.json, or NASA data
 * missing), so its Watch out or Poor comes from the other checks alone. E.g. Sesbania on the Sahara probe
 * (2026-11-14): Watch out for a cool January, its water need never checked. A Good fit is always fully rated.
 */
const fullyRated = (c: CropSuggestion) => c.reasons.every((r) => r.level !== "unknown");

/** The lot's trouble in plain words, from a crop's main reason. */
export type NoFitTrouble = "too dry" | "too cold" | "too hot" | "too wet";
const TROUBLE: Partial<Record<FitReasonCode, NoFitTrouble>> = {
  water: "too dry",
  "dry-year": "too dry",
  "too-cold": "too cold",
  cool: "too cold",
  "too-hot": "too hot",
  warm: "too hot",
  waterlogging: "too wet",
};

/**
 * Set when every crop that can be rated is a Poor fit in every planting month (e.g. a desert lot): S2 says none of
 * our crops grow well here instead of listing Poor crops. `why` is the trouble of more than half of those crops'
 * main reasons, or null when they differ. Null when some crop fits, or when no crop can be rated at all.
 */
export function noCropFits(s: LotSuggestions): { why: NoFitTrouble | null } | null {
  const rated = s.crops.filter((c) => c.level !== "unknown" && fullyRated(c));
  if (rated.length === 0 || rated.some((c) => c.level !== "poor")) return null;
  const counts = new Map<NoFitTrouble, number>();
  for (const c of rated) {
    const t = c.reasons[0] ? TROUBLE[c.reasons[0].code] : undefined;
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const [why] = [...counts].find(([, n]) => n > rated.length / 2) ?? [null];
  return { why };
}

/** S2's top block for a lot: `topCrops` and `noCropFits`. Never throws: bad saved data gives an empty block. */
export function safeLotTop(
  details: LotDetails,
  data: Pick<LotData, "monthly">,
  library: CropLibrary,
  n?: number,
): { top: CropSuggestion[]; noFit: { why: NoFitTrouble | null } | null } {
  try {
    const s = lotSuggestions(details, data, library);
    return { top: topCrops(s, n), noFit: noCropFits(s) };
  } catch (e) {
    console.warn(`[crops] top crops skipped: ${e instanceof Error ? e.message : String(e)}`);
    return { top: [], noFit: null };
  }
}

/**
 * The main problem of a Watch out or Poor fit crop, in plain words. The reason belongs to its first best month,
 * so with several best months it says which ("If planted in Jan: ..."); null for Good fit and unknown.
 */
export function topCropReason(s: CropSuggestion): string | null {
  if (s.level === "good" || s.level === "unknown" || s.reasons.length === 0) return null;
  const text = fitReasonText(s.reasons[0]);
  return s.best_months.length > 1 ? `If planted in ${monthShort(s.best_months[0])}: ${text}` : text;
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
