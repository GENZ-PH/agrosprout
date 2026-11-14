import { PLANTING_DAY_OF_MONTH } from "../engine/params";
import { monthStartDay } from "../engine/season";
import type { RotationSlot } from "../engine/scores";

// Geometry for the "Your year" calendar: which months a crop is in the field, and one color per
// plant family. No React Native imports. Ported from preview/dashboard-ui (commit de8c086), English only.

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

/**
 * Band color by plant family, so a change of color along a row is a change of family:
 * that is what breaks pest and disease cycles (component "Breaks pest cycles").
 */
export type FamilyStyle = { fill: string; ink: string; label: string };
const FAMILY_COLOR: Readonly<Record<string, FamilyStyle>> = {
  Poaceae: { fill: "#E3B23C", ink: "#3A2A00", label: "Grains" },
  Fabaceae: { fill: "#2F7D4B", ink: "#FFFFFF", label: "Legumes" },
  Solanaceae: { fill: "#6C4A8C", ink: "#FFFFFF", label: "Fruit vegetables" },
  Convolvulaceae: { fill: "#B5562B", ink: "#FFFFFF", label: "Root crops" },
};
const OTHER_FAMILY: FamilyStyle = { fill: "#6F7A72", ink: "#FFFFFF", label: "Other crops" };

export const familyStyle = (family: string | null | undefined): FamilyStyle => (family && FAMILY_COLOR[family]) || OTHER_FAMILY;

/**
 * Calendar months (1-12) with a crop in the field for at least one day. Risk marks are drawn
 * only on these months: a month of empty field is shown as empty, not as a crop short of water
 * (the engine's water window can include the rice land-preparation month).
 */
export function occupiedMonths(slots: readonly RotationSlot[]): Set<number> {
  const { pieces } = bandPieces(slots);
  const out = new Set<number>();
  for (let m = 1; m <= 12; m++) {
    const from = monthStartDay(m);
    const to = m === 12 ? YEAR : monthStartDay(m + 1);
    if (pieces.some((p) => p.start < to && from < p.end)) out.add(m);
  }
  return out;
}

/** Risk months of one kind, kept to months with a crop in the field. */
export function inFieldMonths(months: readonly number[], occupied: ReadonlySet<number>): number[] {
  return months.filter((m) => occupied.has(m));
}
