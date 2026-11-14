import { monthStartDay } from "../engine/season";
import type { RotationOption } from "../engine/rotations";
import { bandPieces, inFieldMonths, occupiedMonths } from "./field-year-core";

// The farmer's season guide (plant view): what happens on the lot in each month of the chosen
// plan, and what to do now. Only engine output is used: the plan's slots (plant and harvest
// months, season length) and its risk months. No React Native imports.

type Plan = Pick<RotationOption, "slots" | "metrics">;

export type MonthRisk = "dry" | "hot" | "wet";

export interface MonthState {
  month: number;
  /** Crops planted this month. */
  plant: string[];
  /** Crops harvested this month. */
  harvest: string[];
  /** Crops in the field for at least one day of the month. */
  field: string[];
  /** Risks that touch a crop in the field this month. */
  risks: MonthRisk[];
}

const YEAR = 365;

export function monthStates(plan: Plan): MonthState[] {
  const { pieces } = bandPieces(plan.slots);
  const occupied = occupiedMonths(plan.slots);
  const dry = new Set(inFieldMonths(plan.metrics.stress_months, occupied));
  const hot = new Set(inFieldMonths(plan.metrics.heat_months, occupied));
  const wet = new Set(inFieldMonths(plan.metrics.waterlog_months, occupied));
  const out: MonthState[] = [];
  for (let m = 1; m <= 12; m++) {
    const from = monthStartDay(m);
    const to = m === 12 ? YEAR : monthStartDay(m + 1);
    const field = [...new Set(pieces.filter((p) => p.start < to && from < p.end).map((p) => p.crop_id))];
    const risks: MonthRisk[] = [];
    if (dry.has(m)) risks.push("dry");
    if (hot.has(m)) risks.push("hot");
    if (wet.has(m)) risks.push("wet");
    out.push({
      month: m,
      plant: plan.slots.filter((s) => s.plant_month === m).map((s) => s.crop_id),
      harvest: plan.slots.filter((s) => s.harvest_month === m).map((s) => s.crop_id),
      field,
      risks,
    });
  }
  return out;
}

export interface NowSummary {
  month: number;
  plant: string[];
  harvest: string[];
  /** Crops growing this month that are not planted or harvested in it, with their harvest month. */
  growing: { crop_id: string; harvest_month: number }[];
  /** The next planting after this month, if the plan has one. */
  next: { crop_id: string; month: number; inMonths: number } | null;
  risks: MonthRisk[];
}

/** What the plan asks of the farmer in `month` (1-12), and what comes next. */
export function nowSummary(plan: Plan, month: number): NowSummary {
  const states = monthStates(plan);
  const s = states[month - 1];
  const growing = s.field
    .filter((id) => !s.plant.includes(id) && !s.harvest.includes(id))
    .map((id) => ({ crop_id: id, harvest_month: plan.slots.find((x) => x.crop_id === id && x.plant_month !== month)?.harvest_month ?? 0 }))
    .filter((g) => g.harvest_month > 0);
  let next: NowSummary["next"] = null;
  for (let k = 1; k <= 12 && !next; k++) {
    const m = ((month - 1 + k) % 12) + 1;
    const slot = plan.slots.find((x) => x.plant_month === m);
    if (slot) next = { crop_id: slot.crop_id, month: m, inMonths: k };
  }
  return { month, plant: s.plant, harvest: s.harvest, growing, next, risks: s.risks };
}
