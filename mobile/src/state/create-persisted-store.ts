import AsyncStorage from "@react-native-async-storage/async-storage";
import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * App state (lots, crops, settings...) that stays on the phone (D12).
 * Use TanStack Query (src/api/hooks.ts) for anything that comes from the API,
 * and a store made with this helper for anything the farmer creates.
 */
export function createPersistedStore<T>(name: string, initializer: StateCreator<T, [["zustand/persist", unknown]]>, version = 1) {
  return create<T>()(
    persist(initializer, {
      name: `agrosprout-${name}`,
      storage: createJSONStorage(() => AsyncStorage),
      version,
    }),
  );
}
