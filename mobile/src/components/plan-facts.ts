import type { RotationOption } from "../engine/rotations";
import { inFieldMonths, occupiedMonths } from "./field-year-core";

// Field facts for the side-by-side table: things a farmer can check on the land, taken
// straight from the engine's metrics for each plan. No React Native imports.

export type FactKey = "empty" | "dry" | "risk" | "families" | "legume" | "score";

export interface FactRow {
  key: FactKey;
  /** One value per plan, in the order the plans were given; null = not known. */
  values: (number | null)[];
  /** True for the plan(s) with the best value on this line; all false when every plan is the same. */
  best: boolean[];
}

type Plan = Pick<RotationOption, "total" | "metrics" | "slots">;

/** Months a crop in the field is short of water, and months it is too hot or too wet. */
export function riskCounts(o: Plan): { dry: number; risk: number } {
  const occ = occupiedMonths(o.slots);
  const dry = inFieldMonths(o.metrics.stress_months, occ).length;
  const risk = new Set(inFieldMonths([...o.metrics.heat_months, ...o.metrics.waterlog_months], occ)).size;
  return { dry, risk };
}

const FACTS: readonly { key: FactKey; lowerIsBetter: boolean; value: (o: Plan) => number | null }[] = [
  { key: "empty", lowerIsBetter: true, value: (o) => o.metrics.bare_days },
  { key: "dry", lowerIsBetter: true, value: (o) => riskCounts(o).dry },
  { key: "risk", lowerIsBetter: true, value: (o) => riskCounts(o).risk },
  { key: "families", lowerIsBetter: false, value: (o) => o.metrics.families.length },
  { key: "legume", lowerIsBetter: false, value: (o) => o.metrics.legume_days },
  { key: "score", lowerIsBetter: false, value: (o) => (o.total === null ? null : Math.round(o.total)) },
];

/** One line per fact, with the best plan(s) marked. */
export function planFacts(options: readonly Plan[]): FactRow[] {
  return FACTS.map((f) => {
    const values = options.map(f.value);
    const known = values.filter((v): v is number => v !== null);
    const target = known.length === 0 ? null : f.lowerIsBetter ? Math.min(...known) : Math.max(...known);
    const allSame = values.every((v) => v === values[0]);
    return { key: f.key, values, best: values.map((v) => !allSame && v !== null && v === target) };
  });
}

/** A plain reason for or against a plan, compared with the farmer's crops now (plan A). */
export type Reason =
  | { key: "reason.cover"; n: number }
  | { key: "reason.legume"; crop_id: string }
  | { key: "reason.dry"; n: number }
  | { key: "reason.families"; n: number; base: number }
  | { key: "watch.dry"; n: number }
  | { key: "watch.empty"; n: number };

/**
 * What a plan does better and worse than the farmer's crops now, in field terms. Only
 * differences are listed; `isLegume` says which crops feed the soil (crops.json `n_fixing`).
 */
export function planReasons(plan: Plan, baseline: Plan, isLegume: (cropId: string) => boolean): { gains: Reason[]; watch: Reason[] } {
  const gains: Reason[] = [];
  const watch: Reason[] = [];
  const empty = baseline.metrics.bare_days - plan.metrics.bare_days;
  const p = riskCounts(plan);
  const b = riskCounts(baseline);
  if (empty > 0) gains.push({ key: "reason.cover", n: empty });
  const legume = plan.slots.find((s) => isLegume(s.crop_id));
  if (legume && baseline.metrics.legume_days === 0) gains.push({ key: "reason.legume", crop_id: legume.crop_id });
  if (p.dry < b.dry) gains.push({ key: "reason.dry", n: b.dry - p.dry });
  if (plan.metrics.families.length > baseline.metrics.families.length) {
    gains.push({ key: "reason.families", n: plan.metrics.families.length, base: baseline.metrics.families.length });
  }
  if (p.dry > b.dry) watch.push({ key: "watch.dry", n: p.dry - b.dry });
  if (empty < 0) watch.push({ key: "watch.empty", n: -empty });
  return { gains, watch };
}
