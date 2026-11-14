// Crop fit per lot: Good fit / Watch out / Poor fit, with the 1-2 main
// reasons, for the dashboard's "Your crops here" card (#23, docs/11 S3).
// Pure TypeScript (no React Native imports). Reasons are codes plus numbers;
// the plain-language text comes from the explanation templates (#28).
import type { Crop, CropLibrary, CropSeason, LotCrop, LotData, LotDetails } from "../types";
import { TEMP_CHECK, WATERLOG_WETNESS_MIN, WSI_GOOD_MAX, WSI_POOR_MIN } from "./params";
import { seasonLengthDays, seasonMonths } from "./season";
import { waterBalanceRange, type Scenario, type WaterBalanceOutcome } from "./waterBalance";

export type FitLevel = "good" | "watch" | "poor" | "unknown";

export type FitReasonCode =
  | "water" // typical-year (P50) water stress
  | "dry-year" // fine in a typical year, stressed in a dry year (P20)
  | "too-hot" // monthly mean temperature above the crop's absolute maximum
  | "too-cold" // ... below the absolute minimum
  | "warm" // above the optimal range
  | "cool" // below the optimal range
  | "waterlogging" // low-tolerance crop in very wet months
  | "no-crop-data" // crops.json lacks Kc / stages for this crop
  | "no-months" // no farmer months and no typical calendar
  | "missing-climate"; // NASA data missing for a needed month

export interface FitReason {
  code: FitReasonCode;
  level: Exclude<FitLevel, "good">;
  /** Calendar months (1-12) involved. */
  months: number[];
  /** The value that triggered it (WSI 0-1, or temperature °C, or wetness 0-1). */
  value: number | null;
  /** The cut-off it was compared with (from params.ts or crops.json). */
  limit: number | null;
}

export interface SeasonFit {
  season: CropSeason;
  /** True when the months come from the crop's typical calendar, not the farmer. */
  assumed_calendar: boolean;
  season_days: number | null;
  season_days_source: "farmer" | "crop" | "fao-stages" | null;
  level: FitLevel;
  reasons: FitReason[];
  water: Record<Scenario, WaterBalanceOutcome> | null;
}

export interface CropFit {
  crop_id: string;
  level: FitLevel;
  /** Up to 2 main reasons, worst first (from the worst season). */
  reasons: FitReason[];
  assumed_calendar: boolean;
  seasons: SeasonFit[];
}

export interface CropFitInput {
  crop: Crop;
  lotCrop: LotCrop;
  details: LotDetails;
  data: Pick<LotData, "monthly">;
  library: Pick<CropLibrary, "rice_extra_detail">;
}

const SEVERITY: Record<FitLevel, number> = { good: 0, unknown: 1, watch: 2, poor: 3 };
/** Tie-break order within a level: water first, then temperature, then wetness. */
const CODE_ORDER: FitReasonCode[] = [
  "water",
  "too-hot",
  "too-cold",
  "waterlogging",
  "dry-year",
  "warm",
  "cool",
  "missing-climate",
  "no-crop-data",
  "no-months",
];

function worst(reasons: FitReason[]): FitLevel {
  return reasons.reduce<FitLevel>((lvl, r) => (SEVERITY[r.level] > SEVERITY[lvl] ? r.level : lvl), "good");
}

function rank(reasons: FitReason[]): FitReason[] {
  return [...reasons].sort(
    (a, b) => SEVERITY[b.level] - SEVERITY[a.level] || CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code),
  );
}

/** Add one reason per code, collecting months and keeping the most extreme value. */
function add(
  list: FitReason[],
  code: FitReasonCode,
  level: FitReason["level"],
  month: number | null,
  value: number | null,
  limit: number | null,
  moreExtreme: (a: number, b: number) => boolean = (a, b) => a > b,
) {
  const existing = list.find((r) => r.code === code);
  if (!existing) {
    list.push({ code, level, months: month === null ? [] : [month], value, limit });
    return;
  }
  if (month !== null && !existing.months.includes(month)) existing.months.push(month);
  if (value !== null && (existing.value === null || moreExtreme(value, existing.value))) existing.value = value;
}

function seasonFit(input: CropFitInput, season: CropSeason, assumed: boolean): SeasonFit {
  const { crop, details, data, library } = input;
  const len = seasonLengthDays(crop, season);
  const reasons: FitReason[] = [];
  const base = { season, assumed_calendar: assumed, season_days: len.days, season_days_source: len.days ? len.source : null };

  if (len.days === null) {
    reasons.push({ code: "no-crop-data", level: "unknown", months: [], value: null, limit: null });
    return { ...base, level: worst(reasons), reasons, water: null };
  }

  // Water (P50 for the rating, P20 for the dry-year warning).
  const water = waterBalanceRange({
    crop,
    plantMonth: season.plant_month,
    seasonDays: len.days,
    monthly: data.monthly,
    details,
    riceDetail: library.rice_extra_detail,
  });
  const p50 = water.p50;
  const p20 = water.p20;
  if (!p50.ok) {
    if (p50.reason === "no-crop-water-data") {
      reasons.push({ code: "no-crop-data", level: "unknown", months: [], value: null, limit: null });
    } else {
      reasons.push({ code: "missing-climate", level: "unknown", months: p50.missing_months, value: null, limit: null });
    }
  } else {
    const r = p50.result;
    if (r.wsi > WSI_POOR_MIN) {
      reasons.push({ code: "water", level: "poor", months: r.stress_months, value: r.wsi, limit: WSI_POOR_MIN });
    } else if (r.wsi > WSI_GOOD_MAX) {
      reasons.push({ code: "water", level: "watch", months: r.stress_months, value: r.wsi, limit: WSI_GOOD_MAX });
    } else if (p20.ok && p20.result.wsi > WSI_POOR_MIN) {
      reasons.push({
        code: "dry-year",
        level: "watch",
        months: p20.result.stress_months,
        value: p20.result.wsi,
        limit: WSI_POOR_MIN,
      });
    }
  }

  // Temperature and waterlogging, over the months the crop is in the field.
  // Kc does not matter here, so a flat placeholder Kc is used just to split the season into months.
  const months = seasonMonths(season.plant_month, len.days, [1, 1, 1, 1], [1, 1, 1]).map((m) => m.month);
  const { tmax_c, tmin_c, rootzone_wetness } = data.monthly;
  for (const m of months) {
    const tx = tmax_c[m - 1];
    const tn = tmin_c[m - 1];
    if (crop.temp_c && TEMP_CHECK === "monthly-mean" && tx != null && tn != null) {
      const t = Number(((tx + tn) / 2).toFixed(2));
      const lim = crop.temp_c;
      const lower = (a: number, b: number) => a < b;
      if (t > lim.max) add(reasons, "too-hot", "poor", m, t, lim.max);
      else if (t < lim.min) add(reasons, "too-cold", "poor", m, t, lim.min, lower);
      else if (t > lim.opt_high) add(reasons, "warm", "watch", m, t, lim.opt_high);
      else if (t < lim.opt_low) add(reasons, "cool", "watch", m, t, lim.opt_low, lower);
    }
    const w = rootzone_wetness[m - 1];
    if (crop.waterlogging_tolerance === "low" && w != null && w >= WATERLOG_WETNESS_MIN) {
      add(reasons, "waterlogging", "watch", m, w, WATERLOG_WETNESS_MIN);
    }
  }

  const ranked = rank(reasons);
  return { ...base, level: worst(ranked), reasons: ranked, water };
}

/** Fit of one crop on one lot, over all its seasons (farmer months, else the typical calendar). */
export function cropFit(input: CropFitInput): CropFit {
  const { crop, lotCrop } = input;
  const assumed = lotCrop.seasons.length === 0;
  const seasons = assumed ? crop.typical_calendar : lotCrop.seasons;
  if (seasons.length === 0) {
    const reason: FitReason = { code: "no-months", level: "unknown", months: [], value: null, limit: null };
    return { crop_id: crop.id, level: "unknown", reasons: [reason], assumed_calendar: assumed, seasons: [] };
  }
  const fits = seasons.map((s) => seasonFit(input, s, assumed));
  const worstSeason = fits.reduce((a, b) => (SEVERITY[b.level] > SEVERITY[a.level] ? b : a));
  return {
    crop_id: crop.id,
    level: worstSeason.level,
    reasons: worstSeason.reasons.slice(0, 2),
    assumed_calendar: assumed,
    seasons: fits,
  };
}
