import { useSyncExternalStore } from "react";
import { allStoresSettled, getHydrationSnapshot, subscribeHydration } from "./persist-core";

// Latches: once every store has loaded, a store created later does not hide the app again.
let latched = false;
const getReady = () => (latched ||= allStoresSettled());

/**
 * True once every persisted store has finished loading its saved data.
 * Used by the root layout so no screen can read or change a store before its saved data is in.
 */
export function useStoresReady() {
  return useSyncExternalStore(subscribeHydration, getReady, getReady);
}

/**
 * Loading outcome of every persisted store, for feature screens that want to tell the farmer
 * when saved data was recovered from a backup or could not be read (no UI is provided here).
 */
export function useHydrationReport() {
  return useSyncExternalStore(subscribeHydration, getHydrationSnapshot, getHydrationSnapshot);
}
