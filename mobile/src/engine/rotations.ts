// Candidate rotations and the A/B/C/D options per lot (docs/07-rotation-engine.md §3-4, #26).
// Pure TypeScript (no React Native imports). Coefficients live in ./params.ts.
//
// A Your crops         always shown, never filtered: the farmer's months, or the
//                      crop's typical calendar labeled "assumed" (stage 1)
// B Best for water     top total with only the "save water" priority
// C Best for soil      top total with only the "build soil" priority
// D Balanced           top total with the farmer's own priorities
//
// Alternatives are 1-3 crops in a 12-month cycle, planted on the 15th, with
// a turnaround between crops, passing the hard filters, keeping at least one
// of the farmer's crops and adding at most MAX_NEW_CROPS new ones. Every pair
// of options differs by a crop or by a shift of more than one month; when the
// best candidate is too close to an option already chosen, the next best is used.
import type { Crop, CropLibrary, Lot, LotData, Priorities } from "../types";
import {
  MAX_CROPS_PER_ROTATION,
  MAX_NEW_CROPS,
  SIMILAR_SHIFT_MONTHS,
  TURNAROUND_DAYS,
} from "./params";
import {
  COMPONENT_KEYS,
  evaluateSlot,
  priorityWeights,
  scoreRotation,
  totalScore,
  type ComponentKey,
  type ComponentScores,
  type ComponentWeights,
  type PriorityKey,
  type RotationMetrics,
  type RotationSlot,
  type ScoreContext,
  type ScoredRotation,
  type SlotEval,
} from "./scores";
import { cropSeasonDays, harvestMonthOf, seasonLengthDays } from "./season";
import type { Scenario } from "./waterBalance";

export type OptionKind = "yours" | "water" | "soil" | "balanced";
export type OptionKey = "A" | "B" | "C" | "D";
const KIND_KEY: Record<OptionKind, OptionKey> = { yours: "A", water: "B", soil: "C", balanced: "D" };

export interface RotationOption {
  key: OptionKey;
  kind: OptionKind;
  /** Crops in planting order through the calendar year. */
  slots: RotationSlot[];
  scores: ComponentScores;
  /** Water fit (W) in a dry (P20), typical (P50) and wet (P80) year. */
  water_fit_range: Record<Scenario, number | null>;
  /** Weighted total (0-100) with the farmer's priorities, the same weights for every option. */
  total: number | null;
  /**
   * True for the option(s) with the highest total. With de-duplication, D is
   * the best balanced candidate that is distinct from B and C, so B, C or even
   * A can have the top total; the UI should badge this one, not assume D.
   */
  top_total: boolean;
  /** Components used in the weights that this option has no value for (lowers confidence, #28). */
  missing_scores: ComponentKey[];
  metrics: RotationMetrics;
  /** Crops in this option the farmer does not grow on the lot. */
  new_crop_ids: string[];
  keeps_your_crop: boolean;
  /** True when months come from crops.json typical calendars, not the farmer (label "assumed"). */
  assumed_calendar: boolean;
}

/** Data gaps that explain left-out scores and missing crops (for "Unknowns", #28). */
export type RotationGap =
  | { code: "unknown-crop"; crop_id: string }
  | { code: "no-months"; crop_id: string }
  | { code: "no-season-length"; crop_id: string }
  /** crops.json has no `season_days`: the FAO-56 example stage lengths were summed instead. */
  | { code: "season-from-fao-stages"; crop_id: string }
  | { code: "crop-field-missing"; crop_id: string; field: "n_fixing" | "cover_value" | "market" | "labor" };

export interface RotationsInput {
  lot: Pick<Lot, "crops" | "details">;
  data: Pick<LotData, "monthly">;
  library: Pick<CropLibrary, "crops" | "rice_extra_detail">;
  priorities: Priorities;
  /**
   * Market access score (0-100) per crop id on this lot, from marketAccess
   * (#27). Omit or `null` while the farmer has no destination: M is left out
   * and the weights renormalize (docs/07 §4).
   */
  marketAccess?: Readonly<Record<string, number | null>> | null;
}

export interface RotationsResult {
  /** A first, then B, C, D when a distinct candidate exists for each. */
  options: RotationOption[];
  /** Component weights from the farmer's priorities (sum to 1). */
  weights: ComponentWeights;
  /** Components with no data on this lot, left out of every total. */
  components_left_out: ComponentKey[];
  /** Priorities the farmer set that no available component can score yet. */
  priorities_not_scored: PriorityKey[];
  /** Per crop in the library: planting months that pass the hard filters on this lot. */
  feasible_start_months: Record<string, number[]>;
  /** Alternatives generated and scored (after hard filters). */
  candidates_scored: number;
  gaps: RotationGap[];
}

interface Candidate extends ScoredRotation {
  newCrops: string[];
  keepsYourCrop: boolean;
  id: string;
}

const ONLY = (p: PriorityKey): Priorities => ({ water: 0, soil: 0, income: 0, labor: 0, [p]: 100 });

/** Crops the engine can place and filter: known season length, Kc, FAO-56 stages and temperature range. */
function isComplete(c: Crop): boolean {
  return cropSeasonDays(c).days !== null && c.kc !== null && c.stages_days !== null && c.temp_c !== null;
}

/** Plain code-point order, so ties break the same way on Hermes (Android) and V8 (web). */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Months between two calendar months the short way round (0-6). */
function monthDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * Two rotations are too similar to show both when they have the same crops
 * and each planting month is within SIMILAR_SHIFT_MONTHS of its match
 * (docs/07 §3 step 4).
 */
export function tooSimilar(a: readonly RotationSlot[], b: readonly RotationSlot[]): boolean {
  if (a.length !== b.length) return false;
  const crops = (r: readonly RotationSlot[]) => r.map((s) => s.crop_id).sort().join("|");
  if (crops(a) !== crops(b)) return false;
  return permutations([...b]).some((p) =>
    p.every((s, i) => s.crop_id === a[i].crop_id && monthDistance(s.plant_month, a[i].plant_month) <= SIMILAR_SHIFT_MONTHS),
  );
}

/** Harvest-to-planting gap check on the circular year, for slots sorted by start day. */
function gapOk(prev: SlotEval, next: SlotEval, wrap: boolean): boolean {
  const end = prev.start_day + Math.round(prev.slot.season_days) + TURNAROUND_DAYS;
  return end <= next.start_day + (wrap ? 365 : 0);
}

/** The farmer's crops as option A: their months, else the typical calendar (assumed). Never filtered. */
function yourSlots(input: RotationsInput, byId: Map<string, Crop>, ctx: ScoreContext, gaps: RotationGap[]): SlotEval[] {
  const out: SlotEval[] = [];
  for (const lc of input.lot.crops) {
    const crop = byId.get(lc.crop_id);
    if (!crop) {
      gaps.push({ code: "unknown-crop", crop_id: lc.crop_id });
      continue;
    }
    const farmer = lc.seasons.length > 0;
    const seasons = farmer ? lc.seasons : crop.typical_calendar;
    if (seasons.length === 0) {
      gaps.push({ code: "no-months", crop_id: crop.id });
      continue;
    }
    for (const season of seasons) {
      const len = seasonLengthDays(crop, season);
      if (len.days === null) {
        gaps.push({ code: "no-season-length", crop_id: crop.id });
        continue;
      }
      const slot: RotationSlot = {
        crop_id: crop.id,
        plant_month: season.plant_month,
        harvest_month: harvestMonthOf(season.plant_month, len.days),
        season_days: len.days,
        origin: farmer ? "farmer" : "typical-calendar",
      };
      out.push(evaluateSlot(crop, slot, ctx));
    }
  }
  return out.sort((a, b) => a.start_day - b.start_day);
}

/** Every alternative: 1-3 non-overlapping slots that pass the hard filters (docs/07 §3 steps 1-2). */
function generateCandidates(
  feasible: SlotEval[],
  yourIds: ReadonlySet<string>,
  ctx: ScoreContext,
): Candidate[] {
  const out: Candidate[] = [];
  const pick: SlotEval[] = [];
  const visit = (from: number) => {
    for (let i = from; i < feasible.length; i++) {
      const s = feasible[i];
      const prev = pick[pick.length - 1];
      if (prev && !gapOk(prev, s, false)) continue;
      // The new last slot must also leave a turnaround before next year's first slot.
      if (pick.length > 0 && !gapOk(s, pick[0], true)) continue;
      if (pick.length === 0 && !gapOk(s, s, true)) continue;
      pick.push(s);
      const ids = new Set(pick.map((p) => p.slot.crop_id));
      const newCrops = [...ids].filter((id) => !yourIds.has(id)).sort();
      if (newCrops.length <= MAX_NEW_CROPS) {
        const scored = scoreRotation([...pick], ctx, false);
        out.push({
          ...scored,
          newCrops,
          keepsYourCrop: [...ids].some((id) => yourIds.has(id)),
          id: pick.map((p) => `${p.slot.crop_id}@${p.slot.plant_month}`).join("|"),
        });
      }
      if (pick.length < MAX_CROPS_PER_ROTATION && newCrops.length <= MAX_NEW_CROPS) visit(i + 1);
      pick.pop();
    }
  };
  visit(0);
  return out;
}

/** Components with a value for every candidate (or for A when there are none). */
function availableComponents(candidates: ScoredRotation[], yours: ScoredRotation): Set<ComponentKey> {
  const pool = candidates.length > 0 ? candidates : [yours];
  return new Set(COMPONENT_KEYS.filter((k) => pool.every((r) => r.scores[k] !== null)));
}

/** A/B/C/D rotation options with component scores and totals for one lot (docs/07 §3-4). */
export function rotations(input: RotationsInput): RotationsResult {
  const ctx: ScoreContext = {
    monthly: input.data.monthly,
    details: input.lot.details,
    riceDetail: input.library.rice_extra_detail,
    marketAccess: input.marketAccess ?? null,
  };
  const byId = new Map(input.library.crops.map((c) => [c.id, c]));
  const yourIds = new Set(input.lot.crops.map((c) => c.crop_id));
  const gaps: RotationGap[] = [];

  // A: the farmer's own crops.
  const aSlots = yourSlots(input, byId, ctx, gaps);
  const yours = scoreRotation(aSlots, ctx, true);

  // Alternatives: every complete crop in the library, every planting month, hard-filtered.
  const feasible: SlotEval[] = [];
  const feasible_start_months: Record<string, number[]> = {};
  for (const crop of input.library.crops.filter(isComplete)) {
    const days = cropSeasonDays(crop).days as number;
    feasible_start_months[crop.id] = [];
    for (let m = 1; m <= 12; m++) {
      const slot: RotationSlot = {
        crop_id: crop.id,
        plant_month: m,
        harvest_month: harvestMonthOf(m, days),
        season_days: days,
        origin: "engine",
      };
      const ev = evaluateSlot(crop, slot, ctx);
      if (ev.rejected.length === 0) {
        feasible.push(ev);
        feasible_start_months[crop.id].push(m);
      }
    }
  }
  feasible.sort((a, b) => a.start_day - b.start_day || byCodePoint(a.slot.crop_id, b.slot.crop_id));
  const candidates = generateCandidates(feasible, yourIds, ctx);

  const available = availableComponents(candidates, yours);
  const balanced = priorityWeights(input.priorities, available);
  const totals = new Map<Candidate, number>(candidates.map((c) => [c, totalScore(c.scores, balanced.weights) ?? -1]));

  const chosen: { kind: OptionKind; rot: ScoredRotation; c: Candidate | null }[] = [
    { kind: "yours", rot: yours, c: null },
  ];
  const objectives: [OptionKind, Priorities][] = [
    ["water", ONLY("water")],
    ["soil", ONLY("soil")],
    ["balanced", input.priorities],
  ];
  for (const [kind, pri] of objectives) {
    const { weights } = kind === "balanced" ? balanced : priorityWeights(pri, available);
    const score = new Map(candidates.map((c) => [c, totalScore(c.scores, weights) ?? -1]));
    const ranked = [...candidates].sort(
      (a, b) =>
        (score.get(b) as number) - (score.get(a) as number) ||
        (totals.get(b) as number) - (totals.get(a) as number) ||
        a.newCrops.length - b.newCrops.length ||
        byCodePoint(a.id, b.id),
    );
    const distinct = (c: Candidate) =>
      !chosen.some((x) => tooSimilar(x.rot.slots.map((s) => s.slot), c.slots.map((s) => s.slot)));
    // Prefer alternatives that keep one of the farmer's crops (docs/07 §3 step 4).
    const pick = ranked.find((c) => c.keepsYourCrop && distinct(c)) ?? ranked.find(distinct);
    if (pick) chosen.push({ kind, rot: pick, c: pick });
  }

  const options: RotationOption[] = chosen.map(({ kind, rot, c }) => {
    const total = totalScore(rot.scores, balanced.weights);
    const ids = [...new Set(rot.slots.map((s) => s.slot.crop_id))];
    return {
      key: KIND_KEY[kind],
      kind,
      slots: rot.slots.map((s) => s.slot),
      scores: rot.scores,
      water_fit_range: rot.water_fit_range,
      total,
      top_total: false,
      missing_scores: COMPONENT_KEYS.filter((k) => balanced.weights[k] > 0 && rot.scores[k] === null),
      metrics: rot.metrics,
      new_crop_ids: c ? c.newCrops : [],
      keeps_your_crop: c ? c.keepsYourCrop : ids.length > 0,
      assumed_calendar: rot.slots.some((s) => s.slot.origin === "typical-calendar"),
    };
  });
  options.sort((a, b) => byCodePoint(a.key, b.key));
  const best = Math.max(...options.map((o) => o.total ?? -Infinity));
  if (Number.isFinite(best)) for (const o of options) o.top_total = o.total !== null && best - o.total < 1e-9;

  // Crop data gaps behind left-out or partial scores, for the crops shown.
  const seen = new Set<string>();
  for (const o of options) {
    for (const id of new Set(o.slots.map((s) => s.crop_id))) {
      const crop = byId.get(id);
      if (!crop || seen.has(id)) continue;
      seen.add(id);
      if (crop.season_days === null) gaps.push({ code: "season-from-fao-stages", crop_id: id });
      for (const field of ["n_fixing", "cover_value", "market", "labor"] as const) {
        if (crop[field] === null) gaps.push({ code: "crop-field-missing", crop_id: id, field });
      }
    }
  }

  return {
    options,
    weights: balanced.weights,
    components_left_out: COMPONENT_KEYS.filter((k) => !available.has(k)),
    priorities_not_scored: balanced.not_scored,
    feasible_start_months,
    candidates_scored: candidates.length,
    gaps,
  };
}
