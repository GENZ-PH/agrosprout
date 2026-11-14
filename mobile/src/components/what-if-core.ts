import { SCENARIO_RANGE } from "../engine/params";
import type { Scenario } from "../engine/scenario";

// The "What if it is drier or warmer?" card (#47): the choices, and the words for a scenario.
// Pure TypeScript. The ranges are the team's spec in engine/params.ts (SCENARIO_RANGE); the step
// sizes below are only a choice of buttons, not data.

const RAIN_STEP = 10;
const TEMP_STEP = 1;

function steps(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max; v += step) out.push(v);
  return out;
}

/** Rainfall changes the farmer can pick, in percent, from the driest to the wettest. */
export const RAIN_CHOICES: readonly number[] = steps(SCENARIO_RANGE.rain_pct.min, SCENARIO_RANGE.rain_pct.max, RAIN_STEP);
/** Temperature rises the farmer can pick, in degrees C. */
export const TEMP_CHOICES: readonly number[] = steps(SCENARIO_RANGE.temp_c.min, SCENARIO_RANGE.temp_c.max, TEMP_STEP);

export const NO_CHANGE: Scenario = { rain_pct: 0, temp_c: 0 };

/** `null` (today's climate) when both are 0, so the engine skips the scenario. */
export function toScenario(rain_pct: number, temp_c: number): Scenario | null {
  return rain_pct === 0 && temp_c === 0 ? null : { rain_pct, temp_c };
}

export const rainLabel = (pct: number): string => (pct === 0 ? "Same rain" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% rain`);
export const tempLabel = (c: number): string => (c === 0 ? "Same temperature" : `+${c} °C`);

/** One line for the notice above the results while a scenario is on. */
export function describeScenario(s: Scenario): string {
  const parts: string[] = [];
  if (s.rain_pct !== 0) parts.push(`${Math.abs(s.rain_pct)}% ${s.rain_pct < 0 ? "less" : "more"} rain`);
  if (s.temp_c !== 0) parts.push(`${s.temp_c} °C warmer`);
  return parts.join(" and ");
}
