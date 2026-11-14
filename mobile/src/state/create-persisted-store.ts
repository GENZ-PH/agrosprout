import AsyncStorage from "@react-native-async-storage/async-storage";
import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * App state (lots, crops, settings...) that stays on the phone (D12).
 * Use TanStack Query (src/api/hooks.ts) for anything that comes from the API,
 * and a store made with this helper for anything the farmer creates.
 */
export function createPersistedStore<T>(
  name: string,
  initializer: StateCreator<T, [["zustand/persist", unknown]]>,
  options: {
    /** Bump when the saved shape changes, and handle the old shape in `migrate`. */
    version?: number;
    /** Turns data saved by an older version into the current shape. Without it, old data is dropped. */
    migrate?: (persisted: unknown, fromVersion: number) => T | Promise<T>;
  } = {},
) {
  return create<T>()(
    persist(initializer, {
      name: `agrosprout-${name}`,
      storage: createJSONStorage(() => AsyncStorage),
      version: options.version ?? 1,
      migrate: options.migrate,
    }),
  );
}
