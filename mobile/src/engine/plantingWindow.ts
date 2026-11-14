// "Your months vs better months" planting-window scan (docs/07-rotation-engine.md §3b, #33).
// Pure TypeScript (no React Native imports). Coefficients live in ./params.ts.
//
// For every season the farmer gave, scan start months 1-12 with the same
// season length, rescore the lot's rotation with only that season moved, and
// offer a better month only when it is feasible and clearly better.
//
// Text for "why" and "check locally" is written by the explanation layer
// (#28); this module returns the structured drivers and numbers behind it.
import type { Crop, CropLibrary, Lot, LotData } from "../types";
import {
  TURNAROUND_DAYS,
  WINDOW_FIT_WEIGHTS,
  WINDOW_GAIN_CAPTURE_SHARE,
  WINDOW_MARGIN_POINTS,
} from "./params";
import { evaluateSlot, scoreRotation, type RotationSlot, type ScoreContext, type SlotEval } from "./scores";
import { wetRoad } from "./harvestTrips";
import { harvestMonthOf, seasonLengthDays } from "./season";
import type { Scenario } from "./waterBalance";

const YEAR_DAYS = 365;

export interface PlantingWindowInput {
  lot: Pick<Lot, "crops" | "details">;
  data: Pick<LotData, "monthly">;
  library: Pick<CropLibrary, "crops" | "rice_extra_detail">;
}

export interface WindowMetrics {
  plant_month: number;
  harvest_month: number;
  season_days: number;
  /** Water stress index (0-1) in a dry (P20), typical (P50) and wet (P80) year; `null` = not computable. */
  wsi: Record<Scenario, number | null>;
  stress_months: number[];
  heat_months: number[];
  waterlog_months: number[];
  /**
   * Water fit (W) and climate risk (H) of the whole lot's rotation with this one
   * season at this month, 0-100; E only on sloping lots. They are rotation-level,
   * so two seasons of one lot share the same `yours` scores.
   */
  scores: { W: number | null; H: number | null; E: number | null };
  /** Weighted W + H (+ E): P50 water, and P20 water for the dry-year check. `null` when a score is missing. */
  fit: number | null;
  fit_p20: number | null;
  /** True when the harvest month is a heavy-rain month: slower roads and harder drying (#44). Informational, not in Fit. */
  harvest_road_wet: boolean;
}

export type WindowDriver =
  | "fewer-stress-months"
  | "better-water-fit"
  | "less-heat-risk"
  | "less-waterlogging"
  | "less-erosion";

export type WindowUnknown = "lot-details-unknown" | "fit-not-computable" | "dry-year-differs";

export interface SeasonWindow {
  crop_id: string;
  /** Index into the farmer's `seasons` for this crop (0-based). */
  season_index: number;
  /** "already-good" = nothing beat the farmer's month by the margin. "unknown" = Fit could not be computed. */
  status: "better" | "already-good" | "unknown";
  yours: WindowMetrics;
  better: WindowMetrics | null;
  /** Fit points gained by the better month; `null` when there is none. */
  delta: number | null;
  /** Shift of the better month in months, 1-6 later (+) or earlier (-); `null` when there is none. */
  shift_months: number | null;
  drivers: WindowDriver[];
  unknowns: WindowUnknown[];
  confidence: "low" | "medium";
}

export type WindowGap =
  | { code: "unknown-crop"; crop_id: string }
  | { code: "no-months"; crop_id: string }
  | { code: "no-season-length"; crop_id: string };

export interface PlantingWindowResult {
  seasons: SeasonWindow[];
  gaps: WindowGap[];
}

interface Entry {
  crop: Crop;
  crop_id: string;
  season_index: number;
  slot: RotationSlot;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Circular distance in days between the ends of two [start, start+len) intervals; <= 0 means they overlap. */
function gapDays(a: { start: number; len: number }, b: { start: number; len: number }): number {
  const forward = mod(b.start - (a.start + a.len), YEAR_DAYS); // end of a to start of b
  const backward = mod(a.start - (b.start + b.len), YEAR_DAYS);
  const overlaps = mod(b.start - a.start, YEAR_DAYS) < a.len || mod(a.start - b.start, YEAR_DAYS) < b.len;
  return overlaps ? -1 : Math.min(forward, backward);
}

const interval = (e: SlotEval) => ({ start: e.start_day, len: Math.round(e.slot.season_days) });

/** Weighted mean of the available scores in `keys`; `null` if any is missing. */
function weightedFit(scores: { W: number | null; H: number | null; E: number | null }, keys: ("W" | "H" | "E")[]): number | null {
  let sum = 0;
  let w = 0;
  for (const k of keys) {
    const v = scores[k];
    if (v === null) return null;
    sum += WINDOW_FIT_WEIGHTS[k] * v;
    w += WINDOW_FIT_WEIGHTS[k];
  }
  return w > 0 ? sum / w : null;
}

/** Months between two planting months the short way round, signed (+ later, - earlier). */
function signedShift(from: number, to: number): number {
  const d = mod(to - from, 12);
  return d <= 6 ? d : d - 12;
}

/** Scan planting months for every season the farmer gave (docs/07 §3b). */
export function plantingWindow(input: PlantingWindowInput): PlantingWindowResult {
  const ctx: Omit<ScoreContext, "marketAccess"> = {
    monthly: input.data.monthly,
    details: input.lot.details,
    riceDetail: input.library.rice_extra_detail,
  };
  const scoreCtx: ScoreContext = { ...ctx, marketAccess: null };
  const byId = new Map(input.library.crops.map((c) => [c.id, c]));
  const gaps: WindowGap[] = [];
  const keys: ("W" | "H" | "E")[] = input.lot.details.land_type === "sloping" ? ["W", "H", "E"] : ["W", "H"];

  // The farmer's own seasons only: stage 2 starts once months are given.
  const entries: Entry[] = [];
  for (const lc of input.lot.crops) {
    const crop = byId.get(lc.crop_id);
    if (!crop) {
      gaps.push({ code: "unknown-crop", crop_id: lc.crop_id });
      continue;
    }
    if (lc.seasons.length === 0) {
      gaps.push({ code: "no-months", crop_id: lc.crop_id });
      continue;
    }
    lc.seasons.forEach((season, season_index) => {
      const len = seasonLengthDays(crop, season);
      if (len.days === null) {
        gaps.push({ code: "no-season-length", crop_id: crop.id });
        return;
      }
      entries.push({
        crop,
        crop_id: crop.id,
        season_index,
        slot: {
          crop_id: crop.id,
          plant_month: season.plant_month,
          harvest_month: harvestMonthOf(season.plant_month, len.days),
          season_days: len.days,
          origin: "farmer",
        },
      });
    });
  }

  const base = entries.map((e) => evaluateSlot(e.crop, e.slot, ctx));

  /** Metrics for entry `i` planted in `month`, with every other season unchanged. */
  const evaluate = (i: number, month: number): { metrics: WindowMetrics; ev: SlotEval } => {
    const e = entries[i];
    const slot: RotationSlot = { ...e.slot, plant_month: month, harvest_month: harvestMonthOf(month, e.slot.season_days) };
    const ev = month === e.slot.plant_month ? base[i] : evaluateSlot(e.crop, slot, ctx);
    const rotation = scoreRotation(base.map((b, j) => (j === i ? ev : b)), scoreCtx, true);
    const scores = { W: rotation.scores.W, H: rotation.scores.H, E: input.lot.details.land_type === "sloping" ? rotation.scores.E : null };
    const fit = weightedFit(scores, keys);
    const w20 = rotation.water_fit_range.p20;
    const fit_p20 = weightedFit({ ...scores, W: w20 }, keys);
    return {
      ev,
      metrics: {
        plant_month: month,
        harvest_month: slot.harvest_month,
        season_days: slot.season_days,
        wsi: ev.wsi,
        stress_months: ev.stress_months,
        heat_months: ev.heat_months,
        waterlog_months: ev.waterlog_months,
        scores,
        fit,
        fit_p20,
        harvest_road_wet: wetRoad(slot.harvest_month, ctx.monthly).wet,
      },
    };
  };

  const detailsUnknown =
    input.lot.details.land_type === "unknown" || input.lot.details.water === "unknown" || input.lot.details.soil === "unknown";

  const seasons: SeasonWindow[] = entries.map((e, i) => {
    const yours = evaluate(i, e.slot.plant_month).metrics;
    const unknowns: WindowUnknown[] = [];
    if (detailsUnknown) unknowns.push("lot-details-unknown");

    // Feasible alternatives: pass the hard filters and do not collide with the farmer's other seasons.
    const feasible: WindowMetrics[] = [];
    for (let m = 1; m <= 12; m++) {
      if (m === e.slot.plant_month) continue;
      const { metrics, ev } = evaluate(i, m);
      if (ev.rejected.length > 0) continue;
      const collides = base.some((other, j) => {
        if (j === i) return false;
        const wasTogether = gapDays(interval(base[i]), interval(other)) < 0; // intercropped in the farmer's own calendar
        if (wasTogether) return false;
        return gapDays(interval(ev), interval(other)) < TURNAROUND_DAYS;
      });
      if (!collides) feasible.push(metrics);
    }

    if (yours.fit === null) {
      unknowns.push("fit-not-computable");
      return {
        crop_id: e.crop_id,
        season_index: e.season_index,
        status: "unknown",
        yours,
        better: null,
        delta: null,
        shift_months: null,
        drivers: [],
        unknowns,
        confidence: "low",
      };
    }

    const yoursFit = yours.fit;
    const scored = feasible.filter((m) => m.fit !== null);
    const qualifying = scored.filter((m) => {
      const gain = (m.fit as number) - yoursFit;
      return gain >= WINDOW_MARGIN_POINTS || (gain > 0 && m.stress_months.length < yours.stress_months.length);
    });
    let better: WindowMetrics | null = null;
    if (qualifying.length > 0) {
      const bestGain = Math.max(...qualifying.map((m) => (m.fit as number) - yoursFit));
      const enough = qualifying.filter((m) => (m.fit as number) - yoursFit >= WINDOW_GAIN_CAPTURE_SHARE * bestGain);
      enough.sort((a, b) => {
        const sa = signedShift(e.slot.plant_month, a.plant_month);
        const sb = signedShift(e.slot.plant_month, b.plant_month);
        // Smallest shift first; for equal size prefer the later month, then the higher Fit.
        return Math.abs(sa) - Math.abs(sb) || sb - sa || (b.fit as number) - (a.fit as number);
      });
      better = enough[0];
    }

    // Dry-year check: does the best month change when the year is dry (P20) instead of typical (P50)?
    const pool = [yours, ...scored].filter((m) => m.fit_p20 !== null);
    const bestP20 = pool.reduce<WindowMetrics | null>((a, m) => (a === null || (m.fit_p20 as number) > (a.fit_p20 as number) ? m : a), null);
    const bestP50 = [yours, ...scored].reduce<WindowMetrics>((a, m) => ((m.fit as number) > (a.fit as number) ? m : a), yours);
    if (bestP20 && bestP20.plant_month !== bestP50.plant_month) unknowns.push("dry-year-differs");

    const drivers: WindowDriver[] = [];
    if (better) {
      if (better.stress_months.length < yours.stress_months.length) drivers.push("fewer-stress-months");
      if ((better.scores.W ?? 0) > (yours.scores.W ?? 0)) drivers.push("better-water-fit");
      if ((better.scores.H ?? 0) > (yours.scores.H ?? 0)) {
        if (better.heat_months.length < yours.heat_months.length) drivers.push("less-heat-risk");
        if (better.waterlog_months.length < yours.waterlog_months.length) drivers.push("less-waterlogging");
      }
      if (keys.includes("E") && (better.scores.E ?? 0) > (yours.scores.E ?? 0)) drivers.push("less-erosion");
    }

    return {
      crop_id: e.crop_id,
      season_index: e.season_index,
      status: better ? "better" : "already-good",
      yours,
      better,
      delta: better ? (better.fit as number) - yoursFit : null,
      shift_months: better ? signedShift(e.slot.plant_month, better.plant_month) : null,
      drivers,
      unknowns,
      confidence: unknowns.includes("lot-details-unknown") || unknowns.includes("dry-year-differs") ? "low" : "medium",
    };
  });

  return { seasons, gaps };
}
