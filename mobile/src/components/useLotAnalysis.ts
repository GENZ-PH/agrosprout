import { useEffect, useMemo, useState } from "react";

import demoLanaoNorte1 from "../../assets/data/demo/lanao-norte-demo-1.json";
import { CROP_LIBRARY } from "../data/crops";
import { asyncStorageLotDataStore } from "../data/lotdata-store";
import type { Scenario } from "../engine/scenario";
import type { Farm, Lot, LotData } from "../types";
import { lotView, readLotData, type DemoFarms, type LotView } from "./lot-analysis-core";

// The dashboard's results for one lot (#29, #43). Reads the lot's climate data from the phone
// and runs the engine offline. When the lot sync finishes a download, the lot's `data_status`
// changes and this reads the data again.

const DEMO_FARMS: DemoFarms = { "lanao-norte-demo-1": demoLanaoNorte1 as LotData };

/** `LotView` from lot-analysis-core, plus `loading` while the saved data is being read. */
export type DashboardLotView = LotView | { kind: "loading" };

/**
 * The lot's climate data saved on the phone (live download or bundled demo farm). `undefined` while it
 * is being read, `null` when there is none yet. Read again on a new download (status) or a moved lot.
 * Used by the dashboard (below) and S2's top 5 for the lot (#152).
 */
export function useLotData(lot: Pick<Lot, "data_ref" | "data_status" | "centroid">): LotData | null | undefined {
  const readKey = `${lot.data_ref}|${lot.data_status}|${lot.centroid.join(",")}`;
  const [read, setRead] = useState<{ key: string; data: LotData | null } | null>(null);

  useEffect(() => {
    let current = true;
    readLotData(lot.data_ref, asyncStorageLotDataStore, DEMO_FARMS).then((data) => {
      if (current) setRead({ key: readKey, data });
    });
    return () => {
      current = false;
    };
  }, [readKey, lot.data_ref]);

  return read?.key === readKey ? read.data : undefined;
}

/**
 * `scenario` is the what-if slider's value (#47). Keep the object stable between renders (state, or `useMemo`),
 * because a new object each render runs the engine again.
 */
export function useLotAnalysis(
  farm: Pick<Farm, "destinations" | "priorities">,
  lot: Lot,
  scenario: Scenario | null = null,
): DashboardLotView {
  const data = useLotData(lot);
  const { destinations, priorities } = farm;
  return useMemo<DashboardLotView>(() => {
    if (data === undefined && lot.crops.length > 0) return { kind: "loading" };
    const view = lotView({ farm: { destinations, priorities }, lot, data: data ?? null, library: CROP_LIBRARY, scenario });
    if (view.kind === "failed") console.warn(`[dashboard] ${lot.id}: ${view.message}`);
    return view;
  }, [data, destinations, priorities, lot, scenario]);
}

/**
 * `useLotAnalysis` for every lot at once, by lot id, for the dashboard's farm map (#124), which
 * colors each lot by its crop fit. Same data reads and the same engine run per lot, no scenario.
 */
export function useFarmLotViews(farm: Pick<Farm, "destinations" | "priorities" | "lots">): Record<string, DashboardLotView> {
  const { lots, destinations, priorities } = farm;
  // One key for the whole farm: any lot's new download, moved outline, or added/removed lot reads again.
  const readKey = lots.map((l) => `${l.id}|${l.data_ref}|${l.data_status}|${l.centroid.join(",")}`).join(";");
  const [read, setRead] = useState<{ key: string; data: Record<string, LotData | null> } | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all(lots.map(async (l) => [l.id, await readLotData(l.data_ref, asyncStorageLotDataStore, DEMO_FARMS)] as const)).then(
      (entries) => {
        if (current) setRead({ key: readKey, data: Object.fromEntries(entries) });
      },
    );
    return () => {
      current = false;
    };
    // `readKey` covers every field of `lots` that is read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readKey]);

  const data = read?.key === readKey ? read.data : undefined;
  return useMemo(() => {
    const out: Record<string, DashboardLotView> = {};
    for (const lot of lots) {
      const lotData = data?.[lot.id];
      if (lotData === undefined && lot.crops.length > 0) {
        out[lot.id] = { kind: "loading" };
        continue;
      }
      out[lot.id] = lotView({ farm: { destinations, priorities }, lot, data: lotData ?? null, library: CROP_LIBRARY });
    }
    return out;
  }, [data, destinations, priorities, lots]);
}
