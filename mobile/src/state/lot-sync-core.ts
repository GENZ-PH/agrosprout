import { ensureLotData, type LotDataStore, type PowerFetcher } from "../data/power";
import type { DailyFetcher } from "../data/power-daily";
import type { SrtmFetcher } from "../data/srtm";
import type { DataStatus, Lot } from "../types";

// Fetches NASA POWER data for lots saved as `pending` (06-architecture: "Save the lot and mark
// its data pending; fetch automatically when back online"). No React Native imports.

export interface LotSyncDeps {
  getLots: () => Lot[];
  setStatus: (lotId: string, status: DataStatus) => void;
  store: LotDataStore;
  fetcher?: PowerFetcher;
  /** NASA SRTM elevation fetcher. When given, ready live lots without a field elevation are filled in too. */
  srtmFetcher?: SrtmFetcher;
  /**
   * NASA POWER daily fetcher (heat, heavy-rain and frost days, trends). When given, ready live
   * lots without daily data are filled in too, and a lot that just became ready gets it right
   * after its status is set (so the monthly data is never held back by the larger download).
   */
  dailyFetcher?: DailyFetcher;
  /** Called when a lot's saved data changed but its status did not (SRTM or daily data filled in later). */
  onDataChanged?: (lotId: string) => void;
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
  const live = deps.getLots().filter((l) => l.data_ref.startsWith("lotdata:"));
  const todo = live.filter((l) => l.data_status === "pending" || ((deps.srtmFetcher || deps.dailyFetcher) && l.data_status === "ready"));
  for (const lot of todo) {
    if (deps.signal?.aborted) break;
    const [lon, lat] = lot.centroid;
    const pendingBefore = lot.data_status === "pending";
    const r = await ensureLotData({
      lotId: lot.id, lat, lon, store: deps.store, fetcher: deps.fetcher, srtmFetcher: deps.srtmFetcher,
      // A pending lot gets its daily data in a second step below, after its status is ready.
      dailyFetcher: pendingBefore ? undefined : deps.dailyFetcher,
      signal: deps.signal,
    });
    result.checked.push(lot.id);
    result[r.status].push(lot.id);
    // The farmer may have deleted or moved the lot meanwhile: only update a lot that is still pending.
    const now = deps.getLots().find((l) => l.id === lot.id);
    if (now && now.data_status === "pending" && now.centroid[0] === lon && now.centroid[1] === lat) {
      deps.setStatus(lot.id, r.status);
      if (r.status === "ready" && deps.dailyFetcher && !deps.signal?.aborted) {
        // Saved monthly data for the same rounded point: no second POWER monthly request.
        const d = await ensureLotData({ lotId: lot.id, lat, lon, store: deps.store, fetcher: deps.fetcher, dailyFetcher: deps.dailyFetcher, signal: deps.signal });
        const still = deps.getLots().find((l) => l.id === lot.id);
        if (d.fetched && d.status === "ready" && still && still.centroid[0] === lon && still.centroid[1] === lat) deps.onDataChanged?.(lot.id);
      }
    } else if (lot.data_status === "ready" && r.fetched && r.status === "ready") {
      deps.onDataChanged?.(lot.id);
    }
    if (r.status === "pending") break;
  }
  return result;
}
