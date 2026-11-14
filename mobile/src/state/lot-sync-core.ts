import { ensureLotData, type LotDataStore, type PowerFetcher } from "../data/power";
import type { DataStatus, Lot } from "../types";

// Fetches NASA POWER data for lots saved as `pending` (06-architecture: "Save the lot and mark
// its data pending; fetch automatically when back online"). No React Native imports.

export interface LotSyncDeps {
  getLots: () => Lot[];
  setStatus: (lotId: string, status: DataStatus) => void;
  store: LotDataStore;
  fetcher?: PowerFetcher;
  signal?: AbortSignal;
}

export interface LotSyncResult {
  checked: string[];
  ready: string[];
  /** Still pending (offline or server trouble); tried again on the next reconnect. */
  pending: string[];
  /** Bad response or client error; not retried automatically. */
  error: string[];
}

/**
 * Checks every pending live lot, one at a time (a few lots, ~1.5 s each; gentle on POWER).
 * Stops early when a lot stays pending, because the next ones would fail the same way.
 */
export async function syncPendingLots(deps: LotSyncDeps): Promise<LotSyncResult> {
  const result: LotSyncResult = { checked: [], ready: [], pending: [], error: [] };
  const todo = deps.getLots().filter((l) => l.data_status === "pending" && l.data_ref.startsWith("lotdata:"));
  for (const lot of todo) {
    if (deps.signal?.aborted) break;
    const [lon, lat] = lot.centroid;
    const r = await ensureLotData({ lotId: lot.id, lat, lon, store: deps.store, fetcher: deps.fetcher, signal: deps.signal });
    result.checked.push(lot.id);
    result[r.status].push(lot.id);
    // The farmer may have deleted or moved the lot meanwhile: only update a lot that is still pending.
    const now = deps.getLots().find((l) => l.id === lot.id);
    if (now && now.data_status === "pending" && now.centroid[0] === lon && now.centroid[1] === lat) {
      deps.setStatus(lot.id, r.status);
    }
    if (r.status === "pending") break;
  }
  return result;
}
