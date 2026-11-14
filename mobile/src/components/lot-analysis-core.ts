// What the dashboard (S3, #29) shows for one lot: its climate data read from the phone, then one
// `analyzeLot` run. No React Native imports, so it runs in Node tests; useLotAnalysis.ts binds it
// to AsyncStorage, the bundled demo farms and crops.json.
import { readStored, type LotDataStore } from "../data/power";
import { analyzeLot, type LotAnalysis } from "../engine/analyze";
import { plantingWindow, type PlantingWindowResult } from "../engine/plantingWindow";
import { isOtherCrop } from "../lots/crop-picks";
import { usualSeasons } from "../lots/months-core";
import type { Scenario } from "../engine/scenario";
import type { CropLibrary, DataStatus, Farm, Lot, LotCrop, LotData } from "../types";

/** Bundled demo farms by id (`demo/<id>` in `Lot.data_ref`). */
export type DemoFarms = Readonly<Record<string, LotData>>;

/**
 * A lot's climate data by its `data_ref`: live data saved by the lot sync (`lotdata:<id>`) or a
 * bundled demo farm (`demo/<id>`). `null` while nothing is saved yet, or when it can't be read.
 */
export async function readLotData(dataRef: string, store: Pick<LotDataStore, "get">, demos: DemoFarms): Promise<LotData | null> {
  if (dataRef.startsWith("demo/")) return demos[dataRef.slice("demo/".length)] ?? null;
  if (dataRef.startsWith("lotdata:")) return readStored(store, dataRef);
  return null;
}

/**
 * True when the lot's root-zone soil wetness (NASA POWER GWETROOT) is missing in every month: the spot is sea or
 * land ice, not farmland. Checked on the POWER monthly API on 2026-11-14 (2001-2025): open sea (12.0 N, 130.0 E)
 * and the Greenland (72.0 N, 40.0 W) and Antarctic (80.0 S, 0.0) ice returned -999 in all 300 months; land points
 * (near Iligan, Iligan Bay's land-and-sea cell, the Sahara) had a value every month. Water near the shore shares a
 * grid cell with land, so it is not caught here. A very small island can read the same: Pag-asa Island (11.05 N,
 * 114.28 E) was missing in all 60 months of 2020-2024 (POWER probe 2026-11-15), so the screens say so.
 */
export function hasNoSoilData(data: Pick<LotData, "monthly">): boolean {
  // Badly saved data is not "sea": it goes on to the engine, whose error the dashboard shows.
  const wetness: unknown = data.monthly?.rootzone_wetness;
  return Array.isArray(wetness) && wetness.length > 0 && wetness.every((v) => typeof v !== "number" || !Number.isFinite(v));
}

export type LotView =
  /** NASA has no soil data for the spot (`hasNoSoilData`): sea or ice. No results; the farmer moves the lot. */
  | { kind: "no-soil" }
  /** The farmer has not picked crops for this lot yet (S2). */
  | { kind: "no-crops" }
  /**
   * No climate data on the phone yet. `pending` = the lot sync downloads it when there is signal.
   * `error` (or `ready` with nothing saved) = it won't come by itself; offer to try again.
   */
  | { kind: "no-data"; status: DataStatus }
  /** `period` = the years the lot's data covers (e.g. "2001-2025"), for the ⓘ explainer texts. */
  | { kind: "ready"; analysis: LotAnalysis; period: string; months: MonthsCompare; data: LotData }
  /** The engine threw. Shown as a message instead of a blank screen; details go to the console. */
  | { kind: "failed"; message: string };

export interface LotViewInput {
  farm: Pick<Farm, "destinations" | "priorities">;
  lot: Lot;
  data: LotData | null;
  library: CropLibrary;
  /** What-if rainfall and temperature change (#47). `null` or omitted = today's climate. */
  scenario?: Scenario | null;
}

/**
 * S5 "Your months vs better months" (#34, #95), shown on the dashboard at all times: a crop the
 * farmer gave months for uses them; a crop without months uses its usual calendar from crops.json,
 * listed in `assumed` so the screen says so (the same rule Option A uses).
 */
export interface MonthsCompare {
  planting: PlantingWindowResult;
  /** The crops as compared, usual months filled in, so a clash names the right months. */
  crops: LotCrop[];
  /** Crop ids compared on their usual months (assumed), not the farmer's. */
  assumed: string[];
}

export function monthsCompare(lot: Pick<Lot, "crops" | "details">, data: LotData, library: CropLibrary): MonthsCompare {
  const byId = new Map(library.crops.map((c) => [c.id, c]));
  const assumed: string[] = [];
  const crops = lot.crops
    .filter((c) => !isOtherCrop(c.crop_id))
    .map((c) => {
      const crop = byId.get(c.crop_id);
      if (c.seasons.length > 0 || !crop) return c;
      assumed.push(c.crop_id);
      return { ...c, seasons: usualSeasons(crop) };
    });
  return { planting: plantingWindow({ lot: { crops, details: lot.details }, data, library }), crops, assumed };
}

export function lotView({ farm, lot, data: saved, library, scenario }: LotViewInput): LotView {
  let data = saved;
  if (data && hasNoSoilData(data)) {
    // Before "no crops": choosing crops for the sea is pointless.
    if (lot.data_status === "ready") return { kind: "no-soil" };
    // The lot was moved: this sea data is old, and the new download is on its way (or failed).
    data = null;
  }
  if (lot.crops.length === 0) return { kind: "no-crops" };
  if (!data) return { kind: "no-data", status: lot.data_status };
  try {
    return {
      kind: "ready",
      analysis: analyzeLot({ farm, lot, data, library, scenario }),
      period: data.period,
      months: monthsCompare(lot, data, library),
      data,
    };
  } catch (e) {
    return { kind: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
