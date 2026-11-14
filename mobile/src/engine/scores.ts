// Component scores (0-100, higher = better) and priority weights for one
// rotation on one lot (docs/07-rotation-engine.md §4, #26).
// Pure TypeScript (no React Native imports). Coefficients live in ./params.ts.
//
//   W Water fit           100 x (1 - mean WSI of the rotation's crops), P50
//   H Climate risk        100 x (1 - risky crop days / crop days)
//   S Soil building       legume, cover, not-bare and family-diversity shares
//   E Erosion protection  100 x (1 - slope factor x share of rain on bare soil)
//   B Pest break          100 x (1 - same-family crop changes / crop changes)
//   I Income              field-day-weighted market level (null until crops.json has it)
//   M Market access       mean of the per-crop scores from #27 (null with no destination)
//   L Labor               field-day-weighted inverse labor level (null until crops.json has it)
//
// A score is `null` when its data is missing; it is then left out of the
// total and the weights renormalize (never a guess).
import { DAYS_IN_MONTH } from "../data/et0";
import type { Crop, LotDetails, LotMonthly, Priorities, RiceExtraDetail } from "../types";
import {
  COVER_CREDIT,
  EROSION_SLOPE_FACTOR,
  FAMILIES_FOR_FULL_CREDIT,
  HARD_FILTER_WATERLOG_WETNESS_MIN,
  HARD_FILTER_WSI_MAX,
  INCOME_LEVEL_SCORE,
  LABOR_LEVEL_SCORE,
  PLANTING_DAY_OF_MONTH,
  PRIORITY_COMPONENTS,
  SOIL_WEIGHTS,
  WATERLOG_WETNESS_MIN,
} from "./params";
import { monthStartDay, seasonMonths } from "./season";
import { waterBalanceRange, type Scenario } from "./waterBalance";

export type ComponentKey = "W" | "H" | "S" | "E" | "B" | "I" | "M" | "L";
export const COMPONENT_KEYS: readonly ComponentKey[] = ["W", "H", "S", "E", "B", "I", "M", "L"];
export type PriorityKey = keyof Priorities;
export type ComponentScores = Record<ComponentKey, number | null>;
/** Share of the total per component; sums to 1 (or all 0 when nothing can be scored). */
export type ComponentWeights = Record<ComponentKey, number>;

const SCENARIOS: readonly Scenario[] = ["p20", "p50", "p80"];
const YEAR_DAYS = 365;

/** farmer = the farmer's months · typical-calendar = crops.json calendar (assumed) · engine = generated alternative. */
export type SlotOrigin = "farmer" | "typical-calendar" | "engine";

/** One crop in a rotation: planted on PLANTING_DAY_OF_MONTH of `plant_month`. */
export interface RotationSlot {
  crop_id: string;
  plant_month: number;
  harvest_month: number;
  season_days: number;
  origin: SlotOrigin;
}

/** Why a generated slot is not offered (docs/07 §3 hard filters). */
export type HardFilterReason = "water" | "too-hot" | "too-cold" | "waterlogging" | "missing-data";

/** A slot plus the per-slot numbers the scores need. */
export interface SlotEval {
  slot: RotationSlot;
  crop: Crop;
  /** 0-based day of the year the crop is planted. */
  start_day: number;
  /** Crop days in each calendar month, index 0 = January. */
  days_by_month: number[];
  /** Water stress index (0-1) in a dry, typical and wet year; `null` = not computable. */
  wsi: Record<Scenario, number | null>;
  /** Months in the typical-year (P50) stress window. */
  stress_months: number[];
  /** Crop days with heat or waterlogging risk; `null` when temperature data or the crop's range is missing. */
  risk_days: number | null;
  heat_months: number[];
  waterlog_months: number[];
  /** Hard-filter failures; empty = the slot may be offered as an alternative. */
  rejected: HardFilterReason[];
}

export interface ScoreContext {
  monthly: LotMonthly;
  details: LotDetails;
  riceDetail: RiceExtraDetail | null;
  /** Per-crop market access score, 0-100 (#27). `null` = no destination yet: M is left out. */
  marketAccess: Readonly<Record<string, number | null>> | null;
}

/** Monthly mean temperature, same rounding as crop fit. `null` when either value is missing. */
function meanTemp(monthly: LotMonthly, month: number): number | null {
  const tx = monthly.tmax_c[month - 1];
  const tn = monthly.tmin_c[month - 1];
  return tx == null || tn == null ? null : Number(((tx + tn) / 2).toFixed(2));
}

/** Water balance, climate risk and hard filters for one crop slot. */
export function evaluateSlot(crop: Crop, slot: RotationSlot, ctx: Omit<ScoreContext, "marketAccess">): SlotEval {
  // Kc does not matter for the calendar split, so flat placeholders are used when the crop has none.
  const months = seasonMonths(slot.plant_month, slot.season_days, crop.stages_days ?? [1, 1, 1, 1], crop.kc ?? [1, 1, 1]);
  const days_by_month = Array.from({ length: 12 }, () => 0);
  for (const m of months) days_by_month[m.month - 1] += m.days;

  const water = waterBalanceRange({
    crop,
    plantMonth: slot.plant_month,
    seasonDays: slot.season_days,
    monthly: ctx.monthly,
    details: ctx.details,
    riceDetail: ctx.riceDetail,
  });
  const wsi = {} as Record<Scenario, number | null>;
  for (const s of SCENARIOS) {
    const o = water[s];
    wsi[s] = o.ok ? o.result.wsi : null;
  }
  const p50 = water.p50;

  const rejected = new Set<HardFilterReason>();
  const heat_months: number[] = [];
  const waterlog_months: number[] = [];
  let risk = 0;
  let riskKnown = crop.temp_c !== null;
  for (const m of months) {
    const t = meanTemp(ctx.monthly, m.month);
    let risky = false;
    if (t === null || !crop.temp_c) {
      riskKnown = false;
      rejected.add("missing-data");
    } else {
      if (t > crop.temp_c.max) rejected.add("too-hot");
      if (t < crop.temp_c.min) rejected.add("too-cold");
      if (t > crop.temp_c.opt_high) {
        risky = true;
        heat_months.push(m.month);
      }
    }
    const wet = ctx.monthly.rootzone_wetness[m.month - 1];
    if (crop.waterlogging_tolerance === "low" && wet != null) {
      if (wet >= WATERLOG_WETNESS_MIN) {
        risky = true;
        waterlog_months.push(m.month);
      }
      if (wet >= HARD_FILTER_WATERLOG_WETNESS_MIN) rejected.add("waterlogging");
    }
    if (risky) risk += m.days;
  }
  if (wsi.p50 === null) rejected.add("missing-data");
  else if (wsi.p50 > HARD_FILTER_WSI_MAX) rejected.add("water");

  return {
    slot,
    crop,
    start_day: monthStartDay(slot.plant_month) + PLANTING_DAY_OF_MONTH - 1,
    days_by_month,
    wsi,
    stress_months: p50.ok ? p50.result.stress_months : [],
    risk_days: riskKnown ? risk : null,
    heat_months,
    waterlog_months,
    rejected: [...rejected],
  };
}

export interface RotationMetrics {
  /** Mean WSI of the rotation's crops per scenario; `null` if any crop's WSI is missing. */
  wsi_mean: Record<Scenario, number | null>;
  stress_months: number[];
  heat_months: number[];
  waterlog_months: number[];
  /** Days in the year with no crop in the field. */
  bare_days: number;
  /** Calendar months that are more than half bare. */
  bare_months: number[];
  /** Field days of nitrogen-fixing crops (crops.json `n_fixing`). */
  legume_days: number;
  /** Field days x cover credit (crops.json `cover_value`). */
  cover_credit_days: number;
  families: string[];
  /** Crop changes (one per crop, cyclic: the last crop is followed by next year's first). */
  crop_changes: number;
  same_family_changes: number;
  /** Share (0-1) of the year's rain weight falling while the lot is bare; `null` when rain data is missing. */
  bare_rain_share: number | null;
  rain_weight: "heavy-rain-days" | "p50-rain";
}

export interface ScoredRotation {
  slots: SlotEval[];
  scores: ComponentScores;
  /** Water fit (W) in a dry (P20), typical (P50) and wet (P80) year. */
  water_fit_range: Record<Scenario, number | null>;
  metrics: RotationMetrics;
}

const sortedUnique = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Crop days per calendar month for the whole rotation, counting overlapping crops once. */
function occupiedDaysByMonth(slots: SlotEval[], mayOverlap: boolean): number[] {
  if (!mayOverlap || slots.length < 2) {
    const out = Array.from({ length: 12 }, () => 0);
    for (const s of slots) s.days_by_month.forEach((d, i) => (out[i] += d));
    return out.map((d, i) => Math.min(d, DAYS_IN_MONTH[i]));
  }
  const day = new Uint8Array(YEAR_DAYS);
  for (const s of slots) {
    const n = Math.round(s.slot.season_days);
    for (let d = 0; d < Math.min(n, YEAR_DAYS); d++) day[(s.start_day + d) % YEAR_DAYS] = 1;
  }
  const out = Array.from({ length: 12 }, () => 0);
  let m = 0;
  let monthEnd = DAYS_IN_MONTH[0];
  for (let d = 0; d < YEAR_DAYS; d++) {
    if (d >= monthEnd) monthEnd += DAYS_IN_MONTH[++m];
    out[m] += day[d];
  }
  return out;
}

/** Field-day-weighted mean of a per-crop value; `null` if any crop's value is missing. */
function dayWeighted(slots: SlotEval[], value: (c: Crop) => number | null): number | null {
  let sum = 0;
  let days = 0;
  for (const s of slots) {
    const v = value(s.crop);
    if (v === null) return null;
    const d = s.days_by_month.reduce((a, b) => a + b, 0);
    sum += v * d;
    days += d;
  }
  return days > 0 ? sum / days : null;
}

/**
 * Score one rotation. `mayOverlap` is true for the farmer's own crops
 * (intercropping, or typical calendars that overlap); generated
 * alternatives never overlap.
 */
export function scoreRotation(slots: SlotEval[], ctx: ScoreContext, mayOverlap: boolean): ScoredRotation {
  const { monthly, details } = ctx;
  const n = slots.length;

  // Water fit, per scenario.
  const wsi_mean = {} as Record<Scenario, number | null>;
  const water_fit_range = {} as Record<Scenario, number | null>;
  for (const sc of SCENARIOS) {
    const vals = slots.map((s) => s.wsi[sc]);
    const mean = n > 0 && vals.every((v) => v !== null) ? (vals as number[]).reduce((a, b) => a + b, 0) / n : null;
    wsi_mean[sc] = mean;
    water_fit_range[sc] = mean === null ? null : 100 * (1 - mean);
  }

  // Climate risk.
  const cropDays = slots.reduce((a, s) => a + s.days_by_month.reduce((x, y) => x + y, 0), 0);
  const riskKnown = n > 0 && slots.every((s) => s.risk_days !== null);
  const riskDays = slots.reduce((a, s) => a + (s.risk_days ?? 0), 0);
  const H = riskKnown && cropDays > 0 ? 100 * (1 - riskDays / cropDays) : null;

  // Bare soil.
  const occupied = occupiedDaysByMonth(slots, mayOverlap);
  const bareByMonth = occupied.map((d, i) => DAYS_IN_MONTH[i] - d);
  const bare_days = bareByMonth.reduce((a, b) => a + b, 0);
  const bare_months = bareByMonth.flatMap((b, i) => (b > DAYS_IN_MONTH[i] / 2 ? [i + 1] : []));

  // Soil building.
  const fieldDays = (s: SlotEval) => s.days_by_month.reduce((a, b) => a + b, 0);
  const legume_days = slots.reduce((a, s) => a + (s.crop.n_fixing === true ? fieldDays(s) : 0), 0);
  const cover_credit_days = slots.reduce(
    (a, s) => a + (s.crop.cover_value ? COVER_CREDIT[s.crop.cover_value] * fieldDays(s) : 0),
    0,
  );
  const families = [...new Set(slots.map((s) => s.crop.family))].sort();
  const familyTerm =
    FAMILIES_FOR_FULL_CREDIT > 1 ? clamp((families.length - 1) / (FAMILIES_FOR_FULL_CREDIT - 1), 0, 1) : 0;
  const w = SOIL_WEIGHTS;
  const S =
    100 *
    (w.legume * clamp(legume_days / YEAR_DAYS, 0, 1) +
      w.cover * clamp(cover_credit_days / YEAR_DAYS, 0, 1) +
      w.covered * clamp(1 - bare_days / YEAR_DAYS, 0, 1) +
      w.families * familyTerm);

  // Erosion protection: share of the year's rain (or heavy-rain days) falling on bare soil.
  const heavy = monthly.heavy_rain_days_gt50mm;
  const useHeavy = heavy !== null && heavy.every((v) => v !== null);
  const rainWeight = useHeavy ? heavy : monthly.precip_mm.p50;
  let bare_rain_share: number | null = null;
  if (rainWeight.every((v) => v !== null)) {
    const rw = rainWeight as number[];
    const total = rw.reduce((a, b) => a + b, 0);
    bare_rain_share = total > 0 ? rw.reduce((a, r, i) => a + r * (bareByMonth[i] / DAYS_IN_MONTH[i]), 0) / total : 0;
  }
  const E =
    bare_rain_share === null ? null : clamp(100 * (1 - EROSION_SLOPE_FACTOR[details.land_type] * bare_rain_share), 0, 100);

  // Pest break: crop changes in planting order, cyclic.
  const order = [...slots].sort((a, b) => a.start_day - b.start_day);
  let same = 0;
  for (let i = 0; i < n; i++) if (order[i].crop.family === order[(i + 1) % n].crop.family) same++;
  const B = n > 0 ? 100 * (1 - same / n) : null;

  // Income, labor, market access.
  const I = dayWeighted(slots, (c) => (c.market ? INCOME_LEVEL_SCORE[c.market] : null));
  const L = dayWeighted(slots, (c) => (c.labor ? LABOR_LEVEL_SCORE[c.labor] : null));
  let M: number | null = null;
  if (ctx.marketAccess && n > 0) {
    const vals = slots.map((s) => ctx.marketAccess?.[s.slot.crop_id] ?? null);
    M = vals.every((v) => v !== null) ? (vals as number[]).reduce((a, b) => a + b, 0) / n : null;
  }

  return {
    slots,
    scores: { W: water_fit_range.p50, H, S, E, B, I, M, L },
    water_fit_range,
    metrics: {
      wsi_mean,
      stress_months: sortedUnique(slots.flatMap((s) => s.stress_months)),
      heat_months: sortedUnique(slots.flatMap((s) => s.heat_months)),
      waterlog_months: sortedUnique(slots.flatMap((s) => s.waterlog_months)),
      bare_days,
      bare_months,
      legume_days,
      cover_credit_days,
      families,
      crop_changes: n,
      same_family_changes: same,
      bare_rain_share,
      rain_weight: useHeavy ? "heavy-rain-days" : "p50-rain",
    },
  };
}

/**
 * Component weights from the farmer's priorities (docs/07 §4). Each
 * priority's slider value is split equally among its components that are
 * `available`; the result is normalized to sum to 1. All sliders at 0 counts
 * as equal priorities (the default). A priority above 0 with no available
 * component is reported in `not_scored` (e.g. "income" before crops.json has
 * market levels and before the farmer adds a destination).
 */
export function priorityWeights(
  priorities: Priorities,
  available: ReadonlySet<ComponentKey>,
): { weights: ComponentWeights; not_scored: PriorityKey[] } {
  const keys = Object.keys(PRIORITY_COMPONENTS) as PriorityKey[];
  const raw = keys.map((k) => Math.max(0, Number.isFinite(priorities[k]) ? priorities[k] : 0));
  const values = raw.every((v) => v === 0) ? raw.map(() => 1) : raw;
  const weights = Object.fromEntries(COMPONENT_KEYS.map((k) => [k, 0])) as ComponentWeights;
  const not_scored: PriorityKey[] = [];
  keys.forEach((p, i) => {
    if (values[i] === 0) return;
    const comps = (PRIORITY_COMPONENTS[p] as readonly ComponentKey[]).filter((c) => available.has(c));
    if (comps.length === 0) {
      not_scored.push(p);
      return;
    }
    for (const c of comps) weights[c] += values[i] / comps.length;
  });
  const total = COMPONENT_KEYS.reduce((a, k) => a + weights[k], 0);
  if (total > 0) for (const k of COMPONENT_KEYS) weights[k] /= total;
  return { weights, not_scored };
}

/** Weighted total, 0-100. Null scores are left out and the remaining weights renormalize. */
export function totalScore(scores: ComponentScores, weights: ComponentWeights): number | null {
  let sum = 0;
  let wsum = 0;
  for (const k of COMPONENT_KEYS) {
    const s = scores[k];
    if (s === null || weights[k] <= 0) continue;
    sum += weights[k] * s;
    wsum += weights[k];
  }
  return wsum > 0 ? sum / wsum : null;
}
