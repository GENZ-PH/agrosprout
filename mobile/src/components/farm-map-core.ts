// The dashboard's farm map (#124): every lot colored by how well it suits its crops, with the
// result in words on the lot's label. No React Native imports, so `npm test` runs it in Node.
//
// No new thresholds (CLAUDE.md rule 3): the color comes only from the engine's existing crop-fit
// levels (cropFit.ts), the same Good fit / Watch out / Poor fit / Not sure yet as "Your crops here".
import type { CropFit, FitLevel } from "../engine";
import type { MapLot } from "../map/bridge";
import type { Lot } from "../types";
import type { LotView } from "./lot-analysis-core";
import { FIT_LABELS } from "./recommendations-core";
import { colors } from "./theme";

/** A lot's state on the dashboard: `LotView`, or `loading` while its saved data is read. */
export type MapLotView = LotView | { kind: "loading" };

/** Fit colors, shared with the badge text in CropFitCard so a level looks the same everywhere. */
export const FIT_COLORS: Readonly<Record<FitLevel, string>> = {
  good: colors.green,
  watch: colors.amber,
  poor: colors.danger,
  unknown: colors.muted,
};

/** Lots with no result yet (no crops, no NASA data yet, still loading): a light gray. */
export const NO_RESULT_COLOR = colors.dashed;

/** Same order as the engine's `worst()` in cropFit.ts: a lot is as good as its worst crop. */
const SEVERITY: Record<FitLevel, number> = { good: 0, unknown: 1, watch: 2, poor: 3 };

/** The lot's level: its worst crop. No crop results at all counts as `unknown`. */
export function lotFitLevel(fits: readonly Pick<CropFit, "level">[]): FitLevel {
  if (fits.length === 0) return "unknown";
  return fits.reduce<FitLevel>((lvl, f) => (SEVERITY[f.level] > SEVERITY[lvl] ? f.level : lvl), "good");
}

export interface FarmMapLotStatus {
  /** The fit level, or `null` when the lot has no result yet. */
  level: FitLevel | null;
  color: string;
  /** Short words on the map label and in the screen-reader summary. */
  status: string;
}

/** What one lot shows on the farm map. */
export function farmMapLotStatus(view: MapLotView): FarmMapLotStatus {
  switch (view.kind) {
    case "ready": {
      const level = lotFitLevel(view.analysis.crop_fits);
      return { level, color: FIT_COLORS[level], status: FIT_LABELS[level] };
    }
    case "no-crops":
      return { level: null, color: NO_RESULT_COLOR, status: "Pick crops" };
    case "no-data":
      return {
        level: null,
        color: NO_RESULT_COLOR,
        status: view.status === "pending" ? "Waiting for NASA data" : "No NASA data yet",
      };
    case "loading":
      return { level: null, color: NO_RESULT_COLOR, status: "Loading" };
    case "failed":
      return { level: null, color: NO_RESULT_COLOR, status: "No result" };
  }
}

/** The lots for the map bridge, each with its color and status words. */
export function farmMapLots(
  lots: readonly Pick<Lot, "id" | "name" | "geometry">[],
  views: Readonly<Record<string, MapLotView>>,
): MapLot[] {
  return lots.map((l) => {
    const s = farmMapLotStatus(views[l.id] ?? { kind: "loading" });
    return { id: l.id, name: l.name, geometry: l.geometry, style: { color: s.color, status: s.status } };
  });
}

/** One line for screen readers, since the map itself can't be read out: "Lot 1: Good fit. Lot 2: Watch out." */
export function farmMapSummary(
  lots: readonly Pick<Lot, "id" | "name">[],
  views: Readonly<Record<string, MapLotView>>,
): string {
  const parts = lots.map((l) => `${l.name}: ${farmMapLotStatus(views[l.id] ?? { kind: "loading" }).status}.`);
  return `Map of your lots. ${parts.join(" ")}`.trim();
}

/** The years of data for the ⓘ text, from the lots with results, e.g. "2001-2025" (each distinct period once). */
export function farmMapPeriod(views: Readonly<Record<string, MapLotView>>): string | null {
  const periods = new Set<string>();
  for (const v of Object.values(views)) if (v.kind === "ready") periods.add(v.period);
  return periods.size ? [...periods].join(" and ") : null;
}

/** Legend rows, in reading order. The words match the lot labels and the "Your crops here" badges. */
export const FARM_MAP_LEGEND: readonly { color: string; label: string }[] = [
  { color: FIT_COLORS.good, label: FIT_LABELS.good },
  { color: FIT_COLORS.watch, label: FIT_LABELS.watch },
  { color: FIT_COLORS.poor, label: FIT_LABELS.poor },
  { color: FIT_COLORS.unknown, label: FIT_LABELS.unknown },
  { color: NO_RESULT_COLOR, label: "No result yet" },
];
