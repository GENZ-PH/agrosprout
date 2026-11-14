import AsyncStorage from "@react-native-async-storage/async-storage";
import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { buildPersistOptions, type PersistedStoreOptions } from "./persist-core";

/**
 * App state (lots, crops, settings...) that stays on the phone (D12).
 * Use TanStack Query (src/api/hooks.ts) for anything that comes from the API,
 * and a store made with this helper for anything the farmer creates or must keep offline.
 *
 * Saving rules (see persist-core.ts): nothing is written until saved data has loaded, and
 * saved data is backed up before it is migrated or replaced. Export every store from
 * src/state/stores.ts so the app waits for it before showing screens.
 */
export function createPersistedStore<T>(
  name: string,
  initializer: StateCreator<T, [["zustand/persist", unknown]]>,
  options: PersistedStoreOptions<T> = {},
) {
  return create<T>()(persist(initializer, buildPersistOptions<T>(name, options, AsyncStorage)));
}
