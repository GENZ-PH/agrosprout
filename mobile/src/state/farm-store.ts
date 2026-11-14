import AsyncStorage from "@react-native-async-storage/async-storage";
import { useShallow } from "zustand/react/shallow";
import { createPersistedStore } from "./create-persisted-store";
import { farmPersistOptions, farmStateCreator, toFarm, type FarmData, type FarmState } from "./farm-core";

/**
 * The farm store (#18). Every screen reads and writes the farm through this hook.
 *   const lots = useFarmStore((s) => s.lots);
 *   const addLot = useFarmStore((s) => s.addLot);
 * Outside React: useFarmStore.getState().addLot(...).
 */
export const useFarmStore = createPersistedStore<FarmState, FarmData>(
  "farm",
  farmStateCreator({ removeKey: (key) => AsyncStorage.removeItem(key) }),
  farmPersistOptions,
);

/** The whole farm as `Farm` (types.ts), for the engine and the dashboard. */
export const useFarm = () =>
  useFarmStore(useShallow((s) => toFarm(s)));

/** One lot by id, or undefined. */
export const useLot = (id: string) => useFarmStore((s) => s.lots.find((l) => l.id === id));
