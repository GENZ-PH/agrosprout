import { PLANTING_DAY_OF_MONTH } from "../engine/params";
import { monthStartDay } from "../engine/season";
import type { OptionKind, RotationOption } from "../engine/rotations";
import type { RotationSlot } from "../engine/scores";
import { type StringKey, type T, tEn } from "../i18n/strings";
import type { Crop } from "../types";

// Geometry and wording for the "field year" calendar: one Jan-Dec ruler, one row per
// rotation plan, each crop a band from planting day to harvest. No React Native imports.

export const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const YEAR = 365;

/** A piece of a crop band inside one calendar year, in days from Jan 1. */
export interface BandPiece {
  crop_id: string;
  /** 0-based day of year the piece starts and ends (end exclusive, at most 365). */
  start: number;
  end: number;
  /** Row inside the plan, for crops that share the field at the same time. */
  lane: number;
  /** True for the longer piece of a band that wraps past December (it carries the label). */
  labeled: boolean;
}

/** Splits each slot at the year end and stacks overlapping crops into lanes. */
export function bandPieces(slots: readonly RotationSlot[]): { pieces: BandPiece[]; lanes: number } {
  const laneEnds: [number, number][][] = [];
  const pieces: BandPiece[] = [];
  const ordered = [...slots].sort((a, b) => a.plant_month - b.plant_month);
  for (const slot of ordered) {
    const start = monthStartDay(slot.plant_month) + PLANTING_DAY_OF_MONTH - 1;
    const end = start + Math.max(1, slot.season_days);
    const parts: [number, number][] = end <= YEAR ? [[start, end]] : [[start, YEAR], [0, end - YEAR]];
    const overlaps = (lane: [number, number][]) => lane.some(([s, e]) => parts.some(([ps, pe]) => ps < e && s < pe));
    let lane = laneEnds.findIndex((l) => !overlaps(l));
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push([]);
    }
    laneEnds[lane].push(...parts);
    const longest = parts.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    for (const p of parts) pieces.push({ crop_id: slot.crop_id, start: p[0], end: p[1], lane, labeled: p === longest });
  }
  return { pieces, lanes: Math.max(1, laneEnds.length) };
}

/** Left edge (0-1) of a month (1-12) on the year ruler. */
export const monthX = (month: number) => monthStartDay(month) / YEAR;
export const dayX = (day: number) => day / YEAR;

/** Farmer-facing name of each plan kind (same words as the Soil Health card). */
export const PLAN_NAME: Readonly<Record<OptionKind, string>> = {
  yours: "Your crops",
  water: "Best for water",
  soil: "Best for soil",
  balanced: "Balanced",
};
/** One color per plan, the same as the Soil Health card, so a plan looks the same everywhere. */
export const PLAN_COLOR: Readonly<Record<string, string>> = { A: "#1B1F1A", B: "#1D5FA8", C: "#1E6B3B", D: "#A04A06" };
export const planName = (kind: OptionKind, t: T = tEn) => t(`plan.${kind}`);

/** Crop name without the clarifying part in brackets. */
export const shortCropName = (crop: Pick<Crop, "name"> | undefined, id: string) =>
  crop ? crop.name.replace(/\s*\(.*\)\s*$/, "").trim() || crop.name : id;

/**
 * Band color by plant family, so a change of color along a row is a change of family:
 * that is what breaks pest and disease cycles (component "Breaks pest cycles").
 */
export type FamilyStyle = { fill: string; ink: string; label: string; key: StringKey };
const FAMILY_COLOR: Readonly<Record<string, FamilyStyle>> = {
  Poaceae: { fill: "#E3B23C", ink: "#3A2A00", label: "Grains", key: "fam.grains" },
  Fabaceae: { fill: "#2F7D4B", ink: "#FFFFFF", label: "Legumes", key: "fam.legumes" },
  Solanaceae: { fill: "#6C4A8C", ink: "#FFFFFF", label: "Fruit vegetables", key: "fam.fruitveg" },
  Convolvulaceae: { fill: "#B5562B", ink: "#FFFFFF", label: "Root crops", key: "fam.root" },
};
const OTHER_FAMILY: FamilyStyle = { fill: "#6F7A72", ink: "#FFFFFF", label: "Other crops", key: "fam.other" };

export const familyStyle = (family: string | null | undefined) => (family && FAMILY_COLOR[family]) || OTHER_FAMILY;

/** Families present in these plans, in first-seen order, for the legend. */
export function familiesIn(options: readonly Pick<RotationOption, "slots">[], familyOf: (cropId: string) => string | null | undefined) {
  const seen = new Map<string, FamilyStyle>();
  for (const o of options) for (const s of o.slots) {
    const st = familyStyle(familyOf(s.crop_id));
    if (!seen.has(st.label)) seen.set(st.label, st);
  }
  return [...seen.values()];
}

/** "Mar", "Mar and Apr", "Mar to May" for one run; "Apr to May and Oct" for several. */
export function monthsText(months: readonly number[], t: T = tEn, names: readonly string[] = MONTH_NAMES): string {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  if (sorted.length === 0) return t("list.none");
  const runs: number[][] = [];
  for (const m of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] + 1 === m) last.push(m);
    else runs.push([m]);
  }
  // A run that crosses the year end (Nov, Dec, Jan) reads as one run, in order.
  if (runs.length > 1 && sorted[0] === 1 && sorted[sorted.length - 1] === 12) {
    const tail = runs.pop() as number[];
    runs[0] = [...tail, ...runs[0]];
    runs.push(runs.shift() as number[]);
  }
  const name = (m: number) => names[m - 1];
  const and = t("list.and");
  const single = runs.length === 1;
  const parts = runs.map((r) =>
    r.length === 1 ? name(r[0]) : r.length === 2 && single ? `${name(r[0])} ${and} ${name(r[1])}` : `${name(r[0])} ${t("list.to")} ${name(r[r.length - 1])}`,
  );
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}

/** One line under each plan: how long the field is empty, and when. */
export function bareText(
  metrics: Pick<RotationOption["metrics"], "bare_days" | "bare_months">,
  t: T = tEn,
  names: readonly string[] = MONTH_NAMES,
): string {
  if (metrics.bare_days <= 0) return t("bare.never");
  const when = metrics.bare_months.length > 0 ? t("bare.when", { months: monthsText(metrics.bare_months, t, names) }) : "";
  return `${t("bare.days", { days: metrics.bare_days })}${when}`;
}

/** Round axis steps for a rain chart: 0, step, 2 x step... up to the first value at or above `max`. */
export function axisTicks(max: number): number[] {
  const step = max > 400 ? 200 : max > 200 ? 100 : max > 80 ? 50 : 20;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}
