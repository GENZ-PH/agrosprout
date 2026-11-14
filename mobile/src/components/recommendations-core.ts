// Pure helpers behind the dashboard's "Your crops here" and "Recommendations" cards (#29,
// docs/11-user-flow.md S3). No React Native imports, so `npm test` runs them in Node.
//
// They only put the engine's own numbers into words: crop fit reasons (engine/cropFit.ts),
// option scores (engine/rotations.ts) and confidence reasons (engine/explain.ts). Nothing here
// computes a new number, and the cut-offs stay in engine/params.ts.
// Values come from the engine files themselves: Node's test runner can't import a folder index.
import type { ConfidenceLevel, ConfidenceReason, CropFit, FitLevel, FitReason, OptionKey, RotationOption } from "../engine";
import { COMPONENT_LABELS } from "../engine/explain";
import { PLANTING_DAY_OF_MONTH } from "../engine/params";
import { COMPONENT_KEYS, type ComponentKey, type RotationSlot } from "../engine/scores";
import { monthStartDay } from "../engine/season";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const monthName = (m: number) => MONTHS[m - 1] ?? `month ${m}`;
/** "a", "a and b", "a, b and c". */
const listAnd = (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** "Jun", "Jun and Jul", "Jun, Jul and Aug". */
export const monthList = (months: readonly number[]): string => listAnd(months.map(monthName));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const degC = (x: number) => `${Number(x.toFixed(1))} °C`;

/**
 * Crop name without the clarifying part in brackets, e.g. "Lowland rice (irrigated or rainfed
 * paddy)" -> "Lowland rice", so option rows don't wrap on a phone. Same rule as engine/explain.ts.
 */
export function shortCropName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "").trim() || name;
}

// ---------------------------------------------------------------------------
// Your crops here
// ---------------------------------------------------------------------------

/** Badge text per fit level (docs/11 S3). `unknown` = the data to judge it is missing. */
export const FIT_LABELS: Readonly<Record<FitLevel, string>> = {
  good: "Good fit",
  watch: "Watch out",
  poor: "Poor fit",
  unknown: "Not sure yet",
};

/** Shown for a Good fit, which has no reasons: what was checked and found fine. */
export const GOOD_FIT_TEXT = "No problem found with water, temperature or waterlogging.";

/** One crop fit reason in plain words, with the number and the cut-off the engine compared it with. */
export function fitReasonText(r: FitReason): string {
  const when = r.months.length > 0 ? ` in ${monthList(r.months)}` : "";
  switch (r.code) {
    case "water":
      return r.value === null
        ? `Short of water in a typical year${when}.`
        : `In a typical year, ${pct(r.value)} of its water need is not covered${r.months.length ? ` (short${when})` : ""}.`;
    case "dry-year":
      return r.value === null
        ? `Fine in a typical year, but short of water in a dry year${when}.`
        : `Fine in a typical year, but in a dry year ${pct(r.value)} of its water need is not covered${r.months.length ? ` (short${when})` : ""}.`;
    case "too-hot":
      return r.value !== null && r.limit !== null
        ? `Too hot${when}: the average reaches ${degC(r.value)}, above its limit of ${degC(r.limit)}.`
        : `Too hot${when}.`;
    case "too-cold":
      return r.value !== null && r.limit !== null
        ? `Too cold${when}: the average drops to ${degC(r.value)}, below its limit of ${degC(r.limit)}.`
        : `Too cold${when}.`;
    case "warm":
      return r.value !== null && r.limit !== null
        ? `Warmer than it likes${when}: the average reaches ${degC(r.value)}, above its best range (up to ${degC(r.limit)}).`
        : `Warmer than it likes${when}.`;
    case "cool":
      return r.value !== null && r.limit !== null
        ? `Cooler than it likes${when}: the average drops to ${degC(r.value)}, below its best range (from ${degC(r.limit)}).`
        : `Cooler than it likes${when}.`;
    case "waterlogging":
      return r.value !== null
        ? `The soil is often soaked${when} (root-zone wetness up to ${r.value.toFixed(2)} on a 0 to 1 scale), and this crop does not tolerate waterlogging.`
        : `The soil is often soaked${when}, and this crop does not tolerate waterlogging.`;
    case "no-crop-data":
      return "The crop library has no water-use data for this crop, so its fit can't be worked out.";
    case "no-months":
      return "No planting months are known for this crop yet. Add your months to check its fit.";
    case "missing-climate":
      return `NASA data is missing${when}, so its fit can't be worked out.`;
  }
}

/** Which months were checked: "Checked for Jun–Oct and Nov–Mar (typical local months, assumed)." */
export function fitSeasonsText(fit: Pick<CropFit, "seasons" | "assumed_calendar">): string | null {
  if (fit.seasons.length === 0) return null;
  const ranges = fit.seasons.map((s) => `${monthName(s.season.plant_month)}–${monthName(s.season.harvest_month)}`);
  return `Checked for ${listAnd(ranges)} (${fit.assumed_calendar ? "typical local months, assumed" : "your months"}).`;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export const CONFIDENCE_LABELS: Readonly<Record<ConfidenceLevel, string>> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Why the confidence badge is not High, one sentence per engine reason (engine/explain.ts). */
export function confidenceReasonText(r: ConfidenceReason): string {
  switch (r) {
    case "ranking-flips-dry-wet":
      return "This option and your crops swap places between a dry year and a wet year.";
    case "dry-wet-not-checked":
      return "The dry-year and wet-year check could not run, because a water score is missing.";
    case "unknown-inputs":
      return "Two or more answers are unknown or assumed (land type, water source, soil feel or planting months).";
    case "one-unknown-input":
      return "One answer is unknown or assumed (land type, water source, soil feel or planting months).";
    case "scores-missing":
      return "Some scores could not be worked out for lack of data.";
    case "crop-data-missing":
      return "The crop library is missing some values for these crops.";
    case "water-not-scored":
      return "Water fit could not be scored.";
  }
}

/** Days of the year a slot is in the field, placed the way the engine places it (scores.ts). */
function slotDays(s: RotationSlot): [number, number] {
  const start = monthStartDay(s.plant_month) + PLANTING_DAY_OF_MONTH - 1;
  return [start, start + Math.round(s.season_days)];
}

/** True when two slots are in the field on the same day (crops grown together), across the year end too. */
export function slotsOverlap(slots: readonly RotationSlot[]): boolean {
  const spans = slots.map(slotDays);
  return spans.some(([s1, e1], i) =>
    spans.slice(i + 1).some(([s2, e2]) => [-365, 0, 365].some((k) => s1 < e2 + k && s2 + k < e1)),
  );
}

/**
 * The option's crops and months. One after the other: "Mungbean Apr–Jun, then Eggplant Jul–Dec".
 * When crops share the field (option A with typical calendars, or an intercrop), "then" would be
 * wrong, so each crop is listed once with its seasons: "Mungbean Feb–Apr and May–Jul · Lowland rice Jun–Oct".
 */
export function optionCropsText(option: Pick<RotationOption, "slots">, cropName: (id: string) => string): string {
  const range = (s: RotationSlot) => `${monthName(s.plant_month)}–${monthName(s.harvest_month)}`;
  const name = (id: string) => shortCropName(cropName(id));
  if (!slotsOverlap(option.slots)) return option.slots.map((s) => `${name(s.crop_id)} ${range(s)}`).join(", then ");
  const byCrop = new Map<string, string[]>();
  for (const s of option.slots) byCrop.set(s.crop_id, [...(byCrop.get(s.crop_id) ?? []), range(s)]);
  return [...byCrop].map(([id, rs]) => `${name(id)} ${listAnd(rs)}`).join(" · ");
}

export interface ScoreRow {
  key: ComponentKey;
  label: string;
  /** 0-100, or `null` when the option has no value for it. */
  value: number | null;
  /**
   * Points vs option A (your crops), rounded the way the engine's Benefits and Trade-offs lines
   * round them (`pts` in engine/explain.ts), so the bar and the line under it show the same number.
   * `null` for A itself or when either value is missing.
   */
  delta: number | null;
  /** True when this lot has no data for the component, so no option is scored on it. */
  left_out: boolean;
}

/** Same rounding as `pts` in engine/explain.ts: the size is rounded, the sign kept (-7.5 -> -8). */
const roundPoints = (d: number) => (d < 0 ? -1 : 1) * Math.round(Math.abs(d));

/** The eight component scores of an option, in the fixed order, each with its change vs option A. */
export function scoreRows(
  option: Pick<RotationOption, "key" | "scores">,
  a: Pick<RotationOption, "key" | "scores"> | undefined,
  leftOut: readonly ComponentKey[],
): ScoreRow[] {
  return COMPONENT_KEYS.map((k) => {
    const value = option.scores[k];
    const base = a && a.key !== option.key ? a.scores[k] : null;
    return {
      key: k,
      label: COMPONENT_LABELS[k],
      value: value === null ? null : Math.round(value),
      delta: value === null || base === null ? null : roundPoints(value - base),
      left_out: leftOut.includes(k),
    };
  });
}

/** "+12", "−8" or "same", for a change in points. */
export function deltaText(d: number): string {
  return d === 0 ? "same" : d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

/** Screen-reader summary of one option's header row. */
export function optionSummary(o: {
  key: OptionKey;
  title: string;
  total: number | null;
  confidence: ConfidenceLevel;
  top: boolean;
  crops: string;
}): string {
  const total = o.total === null ? "no total score" : `total score ${Math.round(o.total)} out of 100`;
  return `Option ${o.key}, ${o.title}${o.top ? ", top score" : ""}: ${total}, confidence ${CONFIDENCE_LABELS[o.confidence]}. ${o.crops}.`;
}

/**
 * The option the dashboard leads with (#165): the one with the top total, the first if tied.
 * It can be A when the farmer's own crops score highest. Null when no option has a total.
 */
export function topPick<T extends Pick<RotationOption, "key" | "top_total">>(options: readonly T[]): T | null {
  return options.find((o) => o.top_total) ?? null;
}

/**
 * Options that grow the same crops as an earlier option, only in other months, so the farmer can
 * tell them apart (e.g. D Balanced = C Best for soil, shifted). Maps the later key to the earlier one.
 */
export function sameCropsAs(
  options: readonly Pick<RotationOption, "key" | "slots">[],
): Partial<Record<OptionKey, OptionKey>> {
  const cropSet = (o: Pick<RotationOption, "slots">) => [...new Set(o.slots.map((s) => s.crop_id))].sort().join("|");
  const out: Partial<Record<OptionKey, OptionKey>> = {};
  options.forEach((o, i) => {
    const earlier = options.slice(0, i).find((e) => cropSet(e) === cropSet(o));
    if (earlier && o.slots.length > 0) out[o.key] = earlier.key;
  });
  return out;
}
