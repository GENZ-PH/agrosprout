import type { StateCreator } from "zustand";
import type { CropSeason, Destination, Farm, Lot, LotCrop, LotDetails, Priorities, Travel } from "../types";
import { lotDataKey } from "../types";
import type { PersistedStoreOptions } from "./persist-core";

// The farm store (#18): everything the farmer enters, on the device only (D12).
// AsyncStorage key `farm` (06-architecture, types.ts). Climate data per lot is NOT here:
// it lives under `lotdata:<lotId>` and is written by `ensureLotData` (src/data/power.ts).
// No React Native imports, so the logic runs in Node tests; the app binds it in farm-store.ts.

/** What is saved under `farm`. `Farm` from types.ts plus the id counters. */
export interface FarmData {
  lots: Lot[];
  destinations: Destination[];
  priorities: Priorities;
  /** Next number for "lot-N" / "Lot N". Never reused after a delete, so ids stay unique. */
  next_lot_number: number;
  /** Next number for "dest-N". */
  next_destination_number: number;
}

/** Fields the caller gives for a new lot. The store fills id, name, data_ref, data_status and travel. */
export type NewLot = Pick<Lot, "geometry" | "area_ha" | "centroid"> &
  Partial<Pick<Lot, "name" | "details" | "crops" | "province_code">>;

export type LotPatch = Partial<Omit<Lot, "id" | "data_ref">>;
export type NewDestination = Omit<Destination, "id">;
export type DestinationPatch = Partial<Omit<Destination, "id">>;

export interface FarmActions {
  /** Adds a lot and returns its id ("lot-N"). Name defaults to "Lot N". */
  addLot: (lot: NewLot) => string;
  updateLot: (id: string, patch: LotPatch) => void;
  /** Removes the lot and its saved climate data (`lotdata:<id>`). */
  deleteLot: (id: string) => void;
  setCrops: (lotId: string, crops: LotCrop[]) => void;
  /** Sets the planting and harvest months of one crop on one lot. Empty = use the crop's typical calendar. */
  setSeasons: (lotId: string, cropId: string, seasons: CropSeason[]) => void;
  /** Replaces this lot's travel entry for `travel.destination_id` (or adds it). */
  setTravel: (lotId: string, travel: Travel) => void;
  /** Adds a harvest destination and returns its id ("dest-N"). */
  addDestination: (destination: NewDestination) => string;
  updateDestination: (id: string, patch: DestinationPatch) => void;
  /** Removes the destination and every lot's travel entry for it. */
  deleteDestination: (id: string) => void;
  /** Each value is clamped to 0-100. */
  setPriorities: (patch: Partial<Priorities>) => void;
  /** Deletes the whole farm and every lot's saved climate data. */
  clearAll: () => void;
}

export type FarmState = FarmData & FarmActions;

/** Saved shape version. Matches `Farm.version`; bump both with a migration. */
export const FARM_VERSION = 1 as const;
export const FARM_STORAGE_KEY = "farm";

/** types.ts: "Priority sliders, each 0-100. Defaults are all equal (50)." */
export const DEFAULT_PRIORITIES: Priorities = { water: 50, soil: 50, income: 50, labor: 50 };
const UNKNOWN_DETAILS: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown" };

export const emptyFarm = (): FarmData => ({
  lots: [],
  destinations: [],
  priorities: { ...DEFAULT_PRIORITIES },
  next_lot_number: 1,
  next_destination_number: 1,
});

const clamp = (v: number) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 50);

/** Side effects the store needs outside itself. */
export interface FarmDeps {
  /** Removes a storage key (used for `lotdata:<id>`). Errors are logged, never thrown. */
  removeKey: (key: string) => Promise<void>;
}

export function farmStateCreator(deps: FarmDeps): StateCreator<FarmState, [["zustand/persist", unknown]]> {
  const removeQuietly = (key: string) => {
    deps.removeKey(key).catch((e: unknown) => console.warn(`[farm] could not remove ${key}: ${String(e)}`));
  };

  return (set, get) => {
    const mapLot = (id: string, fn: (lot: Lot) => Lot) =>
      set((s) => ({ lots: s.lots.map((l) => (l.id === id ? fn(l) : l)) }));

    return {
      ...emptyFarm(),

      addLot: (input) => {
        const n = get().next_lot_number;
        const id = `lot-${n}`;
        const name = input.name?.trim() || `Lot ${n}`;
        const lot: Lot = {
          id,
          name,
          geometry: input.geometry,
          area_ha: input.area_ha,
          centroid: input.centroid,
          details: input.details ?? { ...UNKNOWN_DETAILS },
          crops: input.crops ?? [],
          data_status: "pending",
          data_ref: lotDataKey(id),
          travel: [],
          ...(input.province_code !== undefined ? { province_code: input.province_code } : {}),
        };
        set((s) => ({ lots: [...s.lots, lot], next_lot_number: n + 1 }));
        return id;
      },

      updateLot: (id, patch) =>
        mapLot(id, (l) => {
          const name = patch.name !== undefined ? patch.name.trim() || l.name : l.name;
          // A moved lot may need new climate data: mark it pending; the lot sync checks it
          // (no download when the rounded POWER point is unchanged).
          const moved =
            patch.centroid !== undefined &&
            (patch.centroid[0] !== l.centroid[0] || patch.centroid[1] !== l.centroid[1]) &&
            l.data_ref.startsWith("lotdata:");
          const data_status = moved && patch.data_status === undefined ? "pending" : (patch.data_status ?? l.data_status);
          return { ...l, ...patch, name, data_status, id: l.id, data_ref: l.data_ref };
        }),

      deleteLot: (id) => {
        const lot = get().lots.find((l) => l.id === id);
        if (!lot) return;
        set((s) => ({ lots: s.lots.filter((l) => l.id !== id) }));
        if (lot.data_ref.startsWith("lotdata:")) removeQuietly(lot.data_ref);
      },

      setCrops: (lotId, crops) => mapLot(lotId, (l) => ({ ...l, crops })),

      setSeasons: (lotId, cropId, seasons) =>
        mapLot(lotId, (l) => ({
          ...l,
          crops: l.crops.map((c) => (c.crop_id === cropId ? { ...c, seasons } : c)),
        })),

      setTravel: (lotId, travel) =>
        mapLot(lotId, (l) => ({
          ...l,
          travel: [...l.travel.filter((t) => t.destination_id !== travel.destination_id), travel],
        })),

      addDestination: (input) => {
        const n = get().next_destination_number;
        const id = `dest-${n}`;
        set((s) => ({
          destinations: [...s.destinations, { ...input, id }],
          next_destination_number: n + 1,
        }));
        return id;
      },

      updateDestination: (id, patch) =>
        set((s) => ({
          destinations: s.destinations.map((d) => (d.id === id ? { ...d, ...patch, id } : d)),
        })),

      deleteDestination: (id) =>
        set((s) => ({
          destinations: s.destinations.filter((d) => d.id !== id),
          lots: s.lots.map((l) => ({ ...l, travel: l.travel.filter((t) => t.destination_id !== id) })),
        })),

      setPriorities: (patch) =>
        set((s) => {
          const next = { ...s.priorities };
          for (const k of ["water", "soil", "income", "labor"] as const) {
            const v = patch[k];
            if (v !== undefined) next[k] = clamp(v);
          }
          return { priorities: next };
        }),

      clearAll: () => {
        const refs = get().lots.map((l) => l.data_ref).filter((r) => r.startsWith("lotdata:"));
        set(emptyFarm());
        refs.forEach(removeQuietly);
      },
    };
  };
}

/** Saves the data only (not the action functions). */
export const partializeFarm = (s: FarmState): FarmData => ({
  lots: s.lots,
  destinations: s.destinations,
  priorities: s.priorities,
  next_lot_number: s.next_lot_number,
  next_destination_number: s.next_destination_number,
});

export const farmPersistOptions: PersistedStoreOptions<FarmState, FarmData> = {
  key: FARM_STORAGE_KEY,
  version: FARM_VERSION,
  partialize: partializeFarm,
};

/** The farm in the shape the engine and the dashboard read (`Farm` in types.ts). */
export const toFarm = (s: FarmData): Farm => ({
  version: FARM_VERSION,
  lots: s.lots,
  destinations: s.destinations,
  priorities: s.priorities,
});
