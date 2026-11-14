// What the dashboard (S3, #29) shows for one lot: its climate data read from the phone, then one
// `analyzeLot` run. No React Native imports, so it runs in Node tests; useLotAnalysis.ts binds it
// to AsyncStorage, the bundled demo farms and crops.json.
import { readStored, type LotDataStore } from "../data/power";
import { analyzeLot, type LotAnalysis } from "../engine/analyze";
import type { CropLibrary, DataStatus, Farm, Lot, LotData } from "../types";

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

export type LotView =
  /** The farmer has not picked crops for this lot yet (S2). */
  | { kind: "no-crops" }
  /**
   * No climate data on the phone yet. `pending` = the lot sync downloads it when there is signal.
   * `error` (or `ready` with nothing saved) = it won't come by itself; offer to try again.
   */
  | { kind: "no-data"; status: DataStatus }
  | { kind: "ready"; analysis: LotAnalysis }
  /** The engine threw. Shown as a message instead of a blank screen; details go to the console. */
  | { kind: "failed"; message: string };

export interface LotViewInput {
  farm: Pick<Farm, "destinations" | "priorities">;
  lot: Lot;
  data: LotData | null;
  library: CropLibrary;
}

export function lotView({ farm, lot, data, library }: LotViewInput): LotView {
  if (lot.crops.length === 0) return { kind: "no-crops" };
  if (!data) return { kind: "no-data", status: lot.data_status };
  try {
    return { kind: "ready", analysis: analyzeLot({ farm, lot, data, library }) };
  } catch (e) {
    return { kind: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
