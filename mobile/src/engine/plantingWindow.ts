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
  data: Pick<LotData, "monthly"> & Partial<Pick<LotData, "slope_pct">>;
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

/** Another season of the same lot that a month would run into (index into the farmer's own seasons). */
export interface WindowClash {
  crop_id: string;
  season_index: number;
}

/** A month that would clearly beat the farmer's, if it did not run into another season of the lot. */
export interface BlockedWindow {
  /** Scored as if this season were the only one on the lot, so the clash does not lower it. */
  month: WindowMetrics;
  /** Fit points the month would gain over the farmer's month, both scored as the only season on the lot. */
  delta: number;
  /** Shift of that month in months, 1-6 later (+) or earlier (-). */
  shift_months: number;
  /** The farmer's own seasons it would run into. */
  clashes: WindowClash[];
}

export interface SeasonWindow {
  crop_id: string;
  /** Index into the farmer's `seasons` for this crop (0-based). */
  season_index: number;
  /**
   * "better" = a month that fits the lot clearly beats the farmer's.
   * "blocked" = a month would clearly beat it, but only by running into another season of the lot: not offered as a move, shown as a trade-off.
   * "already-good" = nothing beats the farmer's month by the margin, even on a lot with nothing else on it.
   * "unknown" = Fit could not be computed.
   */
  status: "better" | "blocked" | "already-good" | "unknown";
  yours: WindowMetrics;
  better: WindowMetrics | null;
  /** Set only when `status` is "blocked". */
  blocked: BlockedWindow | null;
  /** Fit points gained by the better month; `null` when there is none (see `blocked.delta` for a blocked one). */
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
    slopePct: input.data.slope_pct ?? null,
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

  /**
   * Metrics for entry `i` planted in `month`, with every other season unchanged.
   * With `alone`, the lot is scored as if that season were the only one on it (used to
   * size a month that is blocked by another season, so the clash itself does not count).
   */
  const evaluate = (i: number, month: number, alone = false): { metrics: WindowMetrics; ev: SlotEval } => {
    const e = entries[i];
    const slot: RotationSlot = { ...e.slot, plant_month: month, harvest_month: harvestMonthOf(month, e.slot.season_days) };
    const ev = month === e.slot.plant_month ? base[i] : evaluateSlot(e.crop, slot, ctx);
    const rotation = scoreRotation(alone ? [ev] : base.map((b, j) => (j === i ? ev : b)), scoreCtx, true);
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

    // Alternatives that pass the hard filters. Those that run into one of the farmer's other
    // seasons are kept apart: never offered as a move, but a clearly better one is reported as "blocked".
    const feasible: WindowMetrics[] = [];
    const clashing: { metrics: WindowMetrics; clashes: WindowClash[] }[] = [];
    for (let m = 1; m <= 12; m++) {
      if (m === e.slot.plant_month) continue;
      const { metrics, ev } = evaluate(i, m);
      if (ev.rejected.length > 0) continue;
      const clashes: WindowClash[] = [];
      base.forEach((other, j) => {
        if (j === i) return;
        const wasTogether = gapDays(interval(base[i]), interval(other)) < 0; // intercropped in the farmer's own calendar
        if (wasTogether) return;
        if (gapDays(interval(ev), interval(other)) < TURNAROUND_DAYS) {
          clashes.push({ crop_id: entries[j].crop_id, season_index: entries[j].season_index });
        }
      });
      if (clashes.length === 0) feasible.push(metrics);
      else clashing.push({ metrics: evaluate(i, m, true).metrics, clashes });
    }

    if (yours.fit === null) {
      unknowns.push("fit-not-computable");
      return {
        crop_id: e.crop_id,
        season_index: e.season_index,
        status: "unknown",
        yours,
        better: null,
        blocked: null,
        delta: null,
        shift_months: null,
        drivers: [],
        unknowns,
        confidence: "low",
      };
    }

    const yoursFit = yours.fit;
    const scored = feasible.filter((m) => m.fit !== null);
    /**
     * The best month in `pool` that clearly beats `from` (the farmer's month): by the margin, or, when
     * `allowFewerStress`, by any gain that removes a stress month. `null` if none does.
     */
    const pickBetter = (pool: WindowMetrics[], from: WindowMetrics, allowFewerStress: boolean): WindowMetrics | null => {
      const base = from.fit as number;
      const qualifying = pool.filter((m) => {
        if (m.fit === null) return false;
        const gain = m.fit - base;
        return gain >= WINDOW_MARGIN_POINTS || (allowFewerStress && gain > 0 && m.stress_months.length < from.stress_months.length);
      });
      if (qualifying.length === 0) return null;
      const bestGain = Math.max(...qualifying.map((m) => (m.fit as number) - base));
      const enough = qualifying.filter((m) => (m.fit as number) - base >= WINDOW_GAIN_CAPTURE_SHARE * bestGain);
      enough.sort((a, b) => {
        const sa = signedShift(e.slot.plant_month, a.plant_month);
        const sb = signedShift(e.slot.plant_month, b.plant_month);
        // Smallest shift first; for equal size prefer the later month, then the higher Fit.
        return Math.abs(sa) - Math.abs(sb) || sb - sa || (b.fit as number) - (a.fit as number);
      });
      return enough[0];
    };
    const better = pickBetter(scored, yours, true);

    // Nothing fits the lot: would a month that runs into another season have beaten the farmer's by the
    // margin if the lot had nothing else on it? Both are scored alone, so the clash does not count against it.
    let blocked: BlockedWindow | null = null;
    if (!better && clashing.length > 0) {
      const yoursAlone = evaluate(i, e.slot.plant_month, true).metrics;
      const pick = yoursAlone.fit === null ? null : pickBetter(clashing.map((c) => c.metrics), yoursAlone, false);
      const hit = clashing.find((c) => c.metrics === pick);
      if (pick && hit) {
        blocked = {
          month: pick,
          delta: (pick.fit as number) - (yoursAlone.fit as number),
          shift_months: signedShift(e.slot.plant_month, pick.plant_month),
          clashes: hit.clashes,
        };
      }
    }

    // Dry-year check: does the best month change when the year is dry (P20) instead of typical (P50)?
    const pool = [yours, ...scored].filter((m) => m.fit_p20 !== null);
    const bestP20 = pool.reduce<WindowMetrics | null>((a, m) => (a === null || (m.fit_p20 as number) > (a.fit_p20 as number) ? m : a), null);
    const bestP50 = [yours, ...scored].reduce<WindowMetrics>((a, m) => ((m.fit as number) > (a.fit as number) ? m : a), yours);
    if (bestP20 && bestP20.plant_month !== bestP50.plant_month) unknowns.push("dry-year-differs");

    // What improves in the better month, or in the blocked one (so the text can say why it would help).
    const target = better ?? blocked?.month ?? null;
    const drivers: WindowDriver[] = [];
    if (target) {
      if (target.stress_months.length < yours.stress_months.length) drivers.push("fewer-stress-months");
      if ((target.scores.W ?? 0) > (yours.scores.W ?? 0)) drivers.push("better-water-fit");
      if ((target.scores.H ?? 0) > (yours.scores.H ?? 0)) {
        if (target.heat_months.length < yours.heat_months.length) drivers.push("less-heat-risk");
        if (target.waterlog_months.length < yours.waterlog_months.length) drivers.push("less-waterlogging");
      }
      if (keys.includes("E") && (target.scores.E ?? 0) > (yours.scores.E ?? 0)) drivers.push("less-erosion");
    }

    return {
      crop_id: e.crop_id,
      season_index: e.season_index,
      status: better ? "better" : blocked ? "blocked" : "already-good",
      yours,
      better,
      blocked,
      delta: better ? (better.fit as number) - yoursFit : null,
      shift_months: better ? signedShift(e.slot.plant_month, better.plant_month) : null,
      drivers,
      unknowns,
      confidence: unknowns.includes("lot-details-unknown") || unknowns.includes("dry-year-differs") ? "low" : "medium",
    };
  });

  return { seasons, gaps };
}
