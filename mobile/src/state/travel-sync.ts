import { onlineManager } from "@tanstack/react-query";
import { onReconnect } from "../net/reconnect";
import { useFarmStore } from "./farm-store";
import { syncTravel, type RouteKeys } from "./travel-sync-core";

const keys: RouteKeys = new Map();
let running: Promise<unknown> | null = null;
let again = false;

/** While a rough estimate is still on screen and the device says it is online, try the road route again after this. */
export const RETRY_WHILE_ONLINE_MS = 60_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const hasEstimate = () => useFarmStore.getState().lots.some((l) => l.travel.some((t) => t.source === "estimate"));

function scheduleRetry() {
  if (retryTimer || !hasEstimate() || !onlineManager.isOnline()) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runTravelSync();
  }, RETRY_WHILE_ONLINE_MS);
}

/** One pass over every lot and place, never two at once. A call during a pass queues one more pass. */
export function runTravelSync(): Promise<unknown> {
  if (running) {
    again = true;
    return running;
  }
  running = syncTravel({
    getLots: () => useFarmStore.getState().lots,
    getDestinations: () => useFarmStore.getState().destinations,
    setTravel: (lotId, travel) => useFarmStore.getState().setTravel(lotId, travel),
    keys,
  })
    .catch((e: unknown) => console.warn(`[travel-sync] ${String(e)}`))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void runTravelSync();
      } else {
        scheduleRetry();
      }
    });
  return running;
}

/** What decides the routes: where each lot and place is, and how the farmer gets there. */
const inputs = (s: { lots: { id: string; centroid: number[] }[]; destinations: { id: string; point: number[]; mode: string }[] }) =>
  JSON.stringify([s.lots.map((l) => [l.id, l.centroid]), s.destinations.map((d) => [d.id, d.point, d.mode])]);

/**
 * Starts the travel-time sync: now, on every reconnect, and whenever a lot or place is added, moved
 * or given another transport mode. Call once after the stores have loaded (the root layout does this).
 */
export function startTravelSync() {
  const stopReconnect = onReconnect(() => void runTravelSync(), { runNow: true });
  let last = inputs(useFarmStore.getState());
  const stopStore = useFarmStore.subscribe((s) => {
    const now = inputs(s);
    if (now !== last) void runTravelSync();
    last = now;
  });
  return () => {
    stopReconnect();
    stopStore();
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };
}
