import { useEffect, useMemo, useState } from "react";

import demoLanaoNorte1 from "../../assets/data/demo/lanao-norte-demo-1.json";
import { CROP_LIBRARY } from "../data/crops";
import { asyncStorageLotDataStore } from "../data/lotdata-store";
import type { Farm, Lot, LotData } from "../types";
import { lotView, readLotData, type DemoFarms, type LotView } from "./lot-analysis-core";

// The dashboard's results for one lot (#29, #43). Reads the lot's climate data from the phone
// and runs the engine offline. When the lot sync finishes a download, the lot's `data_status`
// changes and this reads the data again.

const DEMO_FARMS: DemoFarms = { "lanao-norte-demo-1": demoLanaoNorte1 as LotData };

/** `LotView` from lot-analysis-core, plus `loading` while the saved data is being read. */
export type DashboardLotView = LotView | { kind: "loading" };

export function useLotAnalysis(farm: Pick<Farm, "destinations" | "priorities">, lot: Lot): DashboardLotView {
  // Read again when the data could have changed: a new download (status) or a moved lot.
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

  const data = read?.key === readKey ? read.data : undefined;
  const { destinations, priorities } = farm;
  return useMemo<DashboardLotView>(() => {
    if (data === undefined && lot.crops.length > 0) return { kind: "loading" };
    const view = lotView({ farm: { destinations, priorities }, lot, data: data ?? null, library: CROP_LIBRARY });
    if (view.kind === "failed") console.warn(`[dashboard] ${lot.id}: ${view.message}`);
    return view;
  }, [data, destinations, priorities, lot]);
}
