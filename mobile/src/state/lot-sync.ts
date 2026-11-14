import { Platform } from "react-native";
import { asyncStorageLotDataStore } from "../data/lotdata-store";
import { makeSrtmFetcher } from "../data/srtm";
import { onlineManager } from "@tanstack/react-query";
import { onReconnect } from "../net/reconnect";
import { useFarmStore } from "./farm-store";
import { useLotDataRev } from "./lotdata-rev";
import { syncPendingLots } from "./lot-sync-core";

let running: Promise<unknown> | null = null;
let again = false;

/**
 * Safety net: if lots are still pending while the device reports online (weak signal,
 * Wi-Fi without internet), no reconnect event may come, so try again after this delay.
 */
export const RETRY_WHILE_ONLINE_MS = 60_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const hasPending = () =>
  useFarmStore.getState().lots.some((l) => l.data_status === "pending" && l.data_ref.startsWith("lotdata:"));

function scheduleRetry() {
  if (retryTimer || !hasPending() || !onlineManager.isOnline()) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runLotSync();
  }, RETRY_WHILE_ONLINE_MS);
}

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
    // NASA SRTM field elevation and slope; the web build goes through our same-origin proxy.
    srtmFetcher: makeSrtmFetcher(Platform.OS === "web"),
    onDataChanged: () => useLotDataRev.getState().bump(),
  })
    .catch((e: unknown) => console.warn(`[lot-sync] ${String(e)}`))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void runLotSync();
      } else {
        scheduleRetry();
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
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };
}
