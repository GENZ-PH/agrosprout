import { asyncStorageLotDataStore } from "../data/lotdata-store";
import { onReconnect } from "../net/reconnect";
import { useFarmStore } from "./farm-store";
import { syncPendingLots } from "./lot-sync-core";

let running: Promise<unknown> | null = null;
let again = false;

/** Runs one pass over pending lots, never two at once. A call during a pass queues one more pass. */
export function runLotSync(): Promise<unknown> {
  if (running) {
    again = true;
    return running;
  }
  running = syncPendingLots({
    getLots: () => useFarmStore.getState().lots,
    setStatus: (id, data_status) => useFarmStore.getState().updateLot(id, { data_status }),
    store: asyncStorageLotDataStore,
  })
    .catch((e: unknown) => console.warn(`[lot-sync] ${String(e)}`))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void runLotSync();
      }
    });
  return running;
}

/**
 * Starts the pending-lot sync: now, on every reconnect, and whenever a lot becomes pending
 * (added or moved). Call once after the stores have loaded (the root layout does this).
 */
export function startLotSync() {
  const stopReconnect = onReconnect(() => void runLotSync(), { runNow: true });
  const pendingIds = (lots: { id: string; data_status: string }[]) =>
    lots.filter((l) => l.data_status === "pending").map((l) => l.id).join(",");
  let last = pendingIds(useFarmStore.getState().lots);
  const stopStore = useFarmStore.subscribe((s) => {
    const now = pendingIds(s.lots);
    if (now !== last && now) void runLotSync();
    last = now;
  });
  return () => {
    stopReconnect();
    stopStore();
  };
}
