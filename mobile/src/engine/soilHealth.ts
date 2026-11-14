// Soil Health Index (SHI): 3-year trajectory per rotation option
// (docs/07-rotation-engine.md §4, #43).
// Pure TypeScript (no React Native imports). Coefficients live in ./params.ts.
//
//   year 0    SHI = SHI_START (every option starts level)
//   each year SHI = clamp(SHI_prev + α x S/100 - β x (1 - E/100), 0, 100)
//
// S (Builds soil) and E (Protects from washout) are the option's component
// scores from scores.ts. The option's 12-month rotation is assumed to repeat
// every year, so the yearly change is the same each year until a limit is hit.
//
// This is a RELATIVE INDICATOR FROM THIS MODEL, for comparing options on one
// lot. It is not a measured soil property or a lab test, and it must never be
// shown as a % change in nitrogen or carbon (gap F1). A missing S or E gives
// no trajectory (never guessed).
import { COMPONENT_LABELS, type ExplainLine } from "./explain";
import { SHI_GAIN_PER_YEAR, SHI_LOSS_PER_YEAR, SHI_START, SHI_YEARS } from "./params";
import type { OptionKey, RotationOption } from "./rotations";
import type { ComponentScores } from "./scores";

export interface SoilHealthPoint {
  /** 0 = start, then 1..years. */
  year: number;
  /** Index value, 0-100. */
  value: number;
}

export interface SoilHealthTrajectory {
  /** Year 0 (SHI_START) through the last year, each clamped to 0-100. */
  points: SoilHealthPoint[];
  /** α x S/100: index points gained each year from soil building. */
  gain_per_year: number;
  /** β x (1 - E/100): index points lost each year to rain on bare soil. */
  loss_per_year: number;
  /** gain_per_year - loss_per_year, before the 0-100 limits. Above 0 = the line goes up. */
  change_per_year: number;
  /** Last point minus the start, after the 0-100 limits. */
  change: number;
}

export interface OptionSoilHealth {
  option_key: OptionKey;
  /** `null` when the option has no S or no E score. */
  trajectory: SoilHealthTrajectory | null;
  /** Last-year value minus option A's last-year value; `null` for A or when either is missing. */
  vs_yours: number | null;
}

export interface SoilHealthResult {
  start: number;
  years: number;
  /** One entry per option, in the same order as the input options. */
  options: OptionSoilHealth[];
  /** Chart label. Keep the words "relative indicator from this model" (docs/07 §4). */
  label: ExplainLine;
  /** ⓘ text for the chart: how it moves, how to read it, and what it is not. */
  info: ExplainLine[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Index values from year 0 to `years` for one rotation's S and E scores.
 * `null` when either score is missing.
 */
export function soilHealthTrajectory(
  scores: Pick<ComponentScores, "S" | "E">,
  years: number = SHI_YEARS,
): SoilHealthTrajectory | null {
  const { S, E } = scores;
  if (S === null || E === null || !Number.isFinite(S) || !Number.isFinite(E)) return null;
  const gain_per_year = (SHI_GAIN_PER_YEAR * S) / 100;
  const loss_per_year = SHI_LOSS_PER_YEAR * (1 - E / 100);
  const change_per_year = gain_per_year - loss_per_year;
  const points: SoilHealthPoint[] = [{ year: 0, value: SHI_START }];
  for (let y = 1; y <= years; y++) {
    points.push({ year: y, value: clamp(points[y - 1].value + change_per_year, 0, 100) });
  }
  return {
    points,
    gain_per_year,
    loss_per_year,
    change_per_year,
    change: points[points.length - 1].value - SHI_START,
  };
}

const lastValue = (t: SoilHealthTrajectory | null) => (t ? t.points[t.points.length - 1].value : null);

/** The 3-year Soil Health Index line for every option, with its label and ⓘ text. */
export function soilHealth(options: readonly Pick<RotationOption, "key" | "scores">[]): SoilHealthResult {
  const rows = options.map((o) => ({ key: o.key, trajectory: soilHealthTrajectory(o.scores) }));
  const yours = lastValue(rows.find((r) => r.key === "A")?.trajectory ?? null);
  return {
    start: SHI_START,
    years: SHI_YEARS,
    options: rows.map((r) => {
      const end = lastValue(r.trajectory);
      return {
        option_key: r.key,
        trajectory: r.trajectory,
        vs_yours: r.key === "A" || end === null || yours === null ? null : end - yours,
      };
    }),
    label: { code: "shi.label", text: "Soil health: a relative indicator from this model" },
    info: [
      {
        code: "shi.how",
        text:
          `Every option starts at ${SHI_START}. Each year the line goes up with "${COMPONENT_LABELS.S}" ` +
          `(legumes, cover crops, fewer bare months, more crop families) and down when rain falls on bare soil ` +
          `("${COMPONENT_LABELS.E}"). It assumes the same crops and months every year.`,
      },
      {
        code: "shi.compare",
        text:
          "Use it to compare the options on this lot with each other. How far the line moves each year is " +
          "an assumption of this app, not a measurement.",
      },
      {
        code: "shi.not-a-test",
        text:
          "It is not a lab test or a measured soil property, and it does not show nitrogen or carbon. " +
          "A soil test and your agricultural technician can tell you about your actual soil.",
      },
    ],
  };
}
