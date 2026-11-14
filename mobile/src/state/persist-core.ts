import type { PersistOptions, PersistStorage, StorageValue } from "zustand/middleware";

// Save-to-device rules for farm data (D12). No React Native imports, so it runs in Node tests.
//
// Facts from zustand 5.1.0 `persist` (node_modules/zustand/esm/middleware.mjs, persistImpl):
// - Loading saved data from AsyncStorage is asynchronous. Until it finishes, the store holds its defaults.
// - Every `set()` writes the whole state to storage right away, even before loading has finished.
//   An early write therefore saves the defaults over the farmer's data.
// - When loading finishes, the saved data is merged over memory, so the early change is also lost in memory.
// - A saved version that differs from `version` with no `migrate` is dropped (console.error only).
// - If reading or `migrate` throws, `hasHydrated()` never becomes true.
//
// What this module guarantees instead:
// 1. Nothing is written until the saved data has been read, so defaults never replace saved data.
// 2. Before data is migrated, dropped or found unreadable, the raw saved text is copied to
//    `<key>:backup:<timestamp>`, so nothing the farmer entered is destroyed.
// 3. Loading always settles (ready, recovered or failed), so the app never waits forever.
// 4. If the device storage cannot be read at all, writes stay blocked, so saved data is never overwritten.

/** The string key-value storage underneath (AsyncStorage on the device, localStorage on web, a Map in tests). */
export interface RawStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type HydrationStatus =
  /** Still reading saved data. */
  | { state: "loading" }
  /** Saved data loaded (or there was none). */
  | { state: "ready" }
  /** Saved data could not be used as is; the original text is kept under `backupKey`. */
  | { state: "recovered"; reason: string; backupKey: string }
  /** Device storage could not be read. Changes stay in memory only and are not saved. */
  | { state: "failed"; reason: string };

export interface PersistedStoreOptions<T, P = T> {
  /** Bump when the saved shape changes, and handle the old shape in `migrate`. */
  version?: number;
  /** Turns data saved by an older version into the current shape. */
  migrate?: (persisted: unknown, fromVersion: number) => P | Promise<P>;
  /** Storage key. Default `agrosprout-<name>`. Use it when a data contract fixes the key (e.g. `farm`). */
  key?: string;
  /** Picks what is saved (e.g. data only, not actions). Default: the whole state. */
  partialize?: (state: T) => P;
}

type Listener = () => void;

const statuses = new Map<string, HydrationStatus>();
const listeners = new Set<Listener>();
let snapshot: Readonly<Record<string, HydrationStatus>> = {};

function setStatus(name: string, status: HydrationStatus) {
  statuses.set(name, status);
  snapshot = Object.fromEntries(statuses);
  listeners.forEach((l) => l());
}

/** Status of every persisted store, keyed by store name. Stable object between changes. */
export const getHydrationSnapshot = () => snapshot;

export function subscribeHydration(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when no registered store is still loading. */
export const allStoresSettled = () => [...statuses.values()].every((s) => s.state !== "loading");

/** Resolves when every store registered so far has finished loading (whatever the outcome). */
export function whenAllStoresSettled(): Promise<void> {
  if (allStoresSettled()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = subscribeHydration(() => {
      if (allStoresSettled()) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/** For tests only. */
export function resetHydrationRegistry() {
  statuses.clear();
  snapshot = {};
}

const warn = (message: string) => console.warn(`[persisted-store] ${message}`);

/**
 * Builds the zustand `persist` options for one store, with the guarantees listed at the top.
 * `createPersistedStore` (create-persisted-store.ts) is the only caller in the app.
 */
export function buildPersistOptions<T, P = T>(
  name: string,
  options: PersistedStoreOptions<T, P>,
  raw: RawStorage,
): PersistOptions<T, P> {
  const key = options.key ?? `agrosprout-${name}`;
  const version = options.version ?? 1;
  let readDone = false; // true once the saved data has been read; writes are blocked before that
  let readFailed = false;
  let recovered: Extract<HydrationStatus, { state: "recovered" }> | undefined;

  setStatus(name, { state: "loading" });

  async function backup(text: string, reason: string) {
    const backupKey = `${key}:backup:${Date.now()}`;
    await raw.setItem(backupKey, text);
    recovered = { state: "recovered", reason, backupKey };
    warn(`${name}: ${reason}. Original saved data kept under "${backupKey}".`);
  }

  const storage: PersistStorage<P> = {
    async getItem(k) {
      let text: string | null;
      try {
        text = await raw.getItem(k);
      } catch (e) {
        readFailed = true;
        throw e; // zustand reports it to onRehydrateStorage below
      }
      if (text === null) {
        readDone = true;
        return null;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      const value = parsed as StorageValue<P> | undefined;
      if (!value || typeof value !== "object" || !("state" in value)) {
        await backup(text, "saved data was unreadable");
        readDone = true;
        return null;
      }
      if (typeof value.version === "number" && value.version !== version) {
        // Keep a copy before migrate() reshapes it (or zustand drops it).
        await backup(text, `saved data was version ${value.version}, the app expects ${version}`);
      }
      readDone = true;
      return value;
    },
    async setItem(k, value) {
      if (!readDone) {
        warn(`${name}: change made before saved data finished loading was not saved. Wait for the store to be ready.`);
        return;
      }
      await raw.setItem(k, JSON.stringify(value));
    },
    async removeItem(k) {
      await raw.removeItem(k);
    },
  };

  const migrate = async (persisted: unknown, fromVersion: number): Promise<P> => {
    if (!options.migrate) {
      // Data was already backed up in getItem. Returning undefined makes zustand keep the defaults.
      return undefined as unknown as P;
    }
    try {
      return await options.migrate(persisted, fromVersion);
    } catch (e) {
      if (recovered) recovered = { ...recovered, reason: `${recovered.reason}; migrate failed: ${String(e)}` };
      warn(`${name}: migrate from version ${fromVersion} failed (${String(e)}). Starting from defaults.`);
      return undefined as unknown as P;
    }
  };

  return {
    name: key,
    version,
    storage,
    migrate: migrate as PersistOptions<T, P>["migrate"],
    ...(options.partialize ? { partialize: options.partialize } : {}),
    onRehydrateStorage: () => (_state, error) => {
      if (error) {
        if (readFailed) {
          setStatus(name, { state: "failed", reason: `could not read device storage: ${String(error)}` });
        } else {
          // Read succeeded but loading failed later: data is backed up if it was reshaped, so allow saving.
          readDone = true;
          setStatus(name, recovered ?? { state: "recovered", reason: String(error), backupKey: "" });
        }
        warn(`${name}: loading saved data failed: ${String(error)}`);
        return;
      }
      setStatus(name, recovered ?? { state: "ready" });
    },
  };
}
