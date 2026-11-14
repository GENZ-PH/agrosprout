import type { RotationOption } from "../engine/rotations";

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

type Plan = Pick<RotationOption, "total" | "metrics">;

const FACTS: readonly { key: FactKey; lowerIsBetter: boolean; value: (o: Plan) => number | null }[] = [
  { key: "empty", lowerIsBetter: true, value: (o) => o.metrics.bare_days },
  { key: "dry", lowerIsBetter: true, value: (o) => o.metrics.stress_months.length },
  { key: "risk", lowerIsBetter: true, value: (o) => new Set([...o.metrics.heat_months, ...o.metrics.waterlog_months]).size },
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
