// Pure helpers for the 3-year Soil Health chart (#43, docs/07-rotation-engine.md §4).
// No React Native imports, so `npm test` runs them in Node. The chart itself is
// SoilHealthChart.tsx.
//
// The index is a RELATIVE INDICATOR FROM THIS MODEL for comparing options on one
// lot. Nothing here may show it as a % or as a change in nitrogen or carbon (gap F1).
import type { OptionKey, OptionSoilHealth, RotationOption, SoilHealthResult } from "../engine";
import { SHI_GAIN_PER_YEAR, SHI_LOSS_PER_YEAR, SHI_START, SHI_YEARS } from "../engine/params";

/** Option names as in docs/07 §4 ("Present") and the header of engine/rotations.ts. */
export const OPTION_LABELS: Readonly<Record<OptionKey, string>> = {
  A: "Your crops",
  B: "Best for water",
  C: "Best for soil",
  D: "Balanced",
};

export interface ShiAxis {
  min: number;
  start: number;
  max: number;
  years: number;
}

/** Smallest distance the y-axis shows above and below the start (index points). A chart choice, not data. */
export const SHI_AXIS_MIN_HALF = 10;

/**
 * y-axis centred on the start value. It spans the start ± 10 at least and
 * widens in steps of 10 to fit the line that moves furthest, up to the most any
 * line can move in SHI_YEARS. So a 2-point gap between options stays small on
 * screen, and the lines still don't sit on top of each other.
 */
export function shiAxis(rows: readonly Pick<SoilHealthRow, "values">[]): ShiAxis {
  const reach = SHI_YEARS * Math.max(SHI_GAIN_PER_YEAR, SHI_LOSS_PER_YEAR);
  const dev = Math.max(0, ...rows.flatMap((r) => (r.values ?? []).map((v) => Math.abs(v - SHI_START))));
  const half = Math.min(Math.max(SHI_AXIS_MIN_HALF, Math.ceil(dev / 10) * 10), Math.max(SHI_AXIS_MIN_HALF, reach));
  return {
    min: Math.max(0, SHI_START - half),
    start: SHI_START,
    max: Math.min(100, SHI_START + half),
    years: SHI_YEARS,
  };
}

export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** x of a year (0 = start) inside the plot. */
export function xForYear(year: number, box: PlotBox, years: number = SHI_YEARS): number {
  return box.left + ((box.right - box.left) * year) / years;
}

/** y of an index value inside the plot (higher value = higher on screen). */
export function yForValue(value: number, box: PlotBox, axis: ShiAxis): number {
  const t = (value - axis.min) / (axis.max - axis.min);
  return box.bottom - (box.bottom - box.top) * Math.min(1, Math.max(0, t));
}

/**
 * Nudge the labels at the end of the lines apart so none overlap. Keeps their
 * order and stays inside [lo, hi] when they fit. Returns y in the input order.
 */
export function spreadLabels(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const out = order.map((o) => o.y);
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1] + gap);
  if (out.length && out[out.length - 1] > hi) {
    out[out.length - 1] = hi;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - gap);
  }
  if (out.length && out[0] < lo) {
    out[0] = lo;
    for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1] + gap);
  }
  const res = new Array<number>(ys.length);
  order.forEach((o, k) => (res[o.i] = out[k]));
  return res;
}

export interface MonthCell {
  /** 1-12. */
  month: number;
  /** "bare" when the engine counts the month as more than half bare (metrics.bare_months). */
  kind: "crop" | "bare";
  /** Crop in the field that month; `null` when bare and no season touches it. */
  crop_id: string | null;
}

const inSeason = (month: number, plant: number, harvest: number) =>
  (month - plant + 12) % 12 <= (harvest - plant + 12) % 12;

/**
 * One year of the option's calendar, month by month. The option repeats every
 * year, so the chart draws the same 12 cells under Year 1, 2 and 3. Bare months
 * come from the engine (the same months that lower "Protects from washout").
 */
export function monthCells(option: Pick<RotationOption, "slots" | "metrics">): MonthCell[] {
  const bare = new Set(option.metrics.bare_months);
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const slot = option.slots.find((s) => inSeason(month, s.plant_month, s.harvest_month));
    return { month, kind: bare.has(month) ? "bare" : "crop", crop_id: slot?.crop_id ?? null };
  });
}

export interface SoilHealthRow {
  key: OptionKey;
  title: string;
  /** Crops in planting order, a repeated crop once with its count, e.g. "Mungbean, Rice ×2". */
  crops: string;
  /** Index values from year 0, unrounded, for drawing the line; `null` when the option has no line. */
  line: number[] | null;
  /** The same values rounded, for the words on screen. */
  values: number[] | null;
  /** Rounded last-year value. */
  end: number | null;
  /** Last-year gap to "Your crops" from the rounded ends; `null` for A or when either is missing. */
  vs_yours: number | null;
  /** Index points gained and lost each year (what moves the line), one decimal. */
  gain_per_year: number | null;
  loss_per_year: number | null;
  /** "Year 3: 62 (up 12)" or why there is no line. */
  summary: string;
  /** "12 above your crops", "4 below your crops", "Same as your crops", or `null`. */
  vs_text: string | null;
}

const round = (x: number) => Math.round(x);
/** One decimal, so the yearly gain and loss add up to the line's slope. */
const round1 = (x: number) => Math.round(x * 10) / 10;

/** "Mungbean, Rice ×2": each crop once, in planting order, with how many seasons it has. */
export function cropList(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
}

function changeWords(change: number): string {
  if (change === 0) return "no change";
  return change > 0 ? `up ${change}` : `down ${-change}`;
}

function vsWords(vs: number): string {
  if (vs === 0) return "Same as your crops";
  return vs > 0 ? `${vs} above your crops` : `${-vs} below your crops`;
}

/** One row per option, in the engine's order, with the words the chart shows. */
export function soilHealthRows(
  result: SoilHealthResult,
  options: readonly Pick<RotationOption, "key" | "slots">[],
  cropName: (id: string) => string = (id) => id,
): SoilHealthRow[] {
  const ends = new Map(
    result.options.map((o) => [o.option_key, o.trajectory ? round(o.trajectory.points[o.trajectory.points.length - 1].value) : null]),
  );
  return result.options.map((o: OptionSoilHealth) => {
    const opt = options.find((x) => x.key === o.option_key);
    const crops = opt?.slots.length ? cropList(opt.slots.map((s) => cropName(s.crop_id))) : "No crops";
    const t = o.trajectory;
    const line = t ? t.points.map((p) => p.value) : null;
    const values = line ? line.map(round) : null;
    const end = ends.get(o.option_key) ?? null;
    const yours = ends.get("A") ?? null;
    // From the rounded ends, so the gap always matches the numbers on screen.
    const vs = o.vs_yours === null || end === null || yours === null ? null : end - yours;
    return {
      key: o.option_key,
      title: OPTION_LABELS[o.option_key],
      crops,
      line,
      values,
      end,
      vs_yours: vs,
      gain_per_year: t ? round1(t.gain_per_year) : null,
      loss_per_year: t ? round1(t.loss_per_year) : null,
      summary:
        end === null
          ? "No line: a score it needs is missing for this option."
          : `Year ${result.years}: ${end} (${changeWords(end - result.start)})`,
      vs_text: vs === null ? null : vsWords(vs),
    };
  });
}

/** Text alternative for the whole chart (screen readers). */
export function chartSummary(result: SoilHealthResult, rows: readonly SoilHealthRow[]): string {
  const parts = rows.map((r) =>
    r.end === null
      ? `${r.title}: no line, a score is missing.`
      : `${r.title}: ${result.start} at the start, ${r.end} by year ${result.years}` +
        (r.vs_text ? `, ${r.vs_text.charAt(0).toLowerCase()}${r.vs_text.slice(1)}.` : "."),
  );
  return [`${result.label.text}.`, ...parts].join(" ");
}

/** "+6.4 from building soil, −2.6 from rain on bare soil" for the ⓘ panel. */
export function movesText(row: SoilHealthRow): string | null {
  if (row.gain_per_year === null || row.loss_per_year === null) return null;
  return `+${row.gain_per_year} from building soil, −${row.loss_per_year} from rain on bare soil`;
}

export interface SoilHealthSummary {
  /** Where every option starts (SHI_START). */
  start: number;
  /** Highest rounded last-year value among options with a line; `null` when none has one. */
  best: number | null;
  /** Every option that reaches `best` (more than one on a tie), in the engine's order. */
  best_keys: OptionKey[];
  /** `best - start`; `null` when there is no best. */
  change: number | null;
}

/**
 * The card's summary row, from the same rounded numbers the rows show.
 * Ties are kept as ties: every option on the top value is named.
 */
export function soilHealthSummary(result: Pick<SoilHealthResult, "start">, rows: readonly Pick<SoilHealthRow, "key" | "end">[]): SoilHealthSummary {
  const ends = rows.filter((r): r is typeof r & { end: number } => r.end !== null);
  if (!ends.length) return { start: result.start, best: null, best_keys: [], change: null };
  const best = Math.max(...ends.map((r) => r.end));
  return {
    start: result.start,
    best,
    best_keys: ends.filter((r) => r.end === best).map((r) => r.key),
    change: best - result.start,
  };
}

/** "+13", "−2", "0": change from the start, with a real minus sign. */
export function signed(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${-n}`;
}

/** "Your crops and Best for soil" for a list of option keys. */
export function optionNames(keys: readonly OptionKey[]): string {
  const names = keys.map((k) => OPTION_LABELS[k]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Label for step `y` on the x-axis: "Start", then "Year 1".."Year N". The model
 * repeats the lot's 12-month plan every year, so the card says so next to the chart.
 */
export function stepLabel(y: number): string {
  return y === 0 ? "Start" : `Year ${y}`;
}
