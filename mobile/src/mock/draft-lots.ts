import { create } from "zustand";

import type { LonLat, Lot } from "../types";

// TEMPORARY (#21 shell). In-memory lots so S1 and S2 can be used before the farm
// store (#18) lands. Not persisted. When #18 merges, S1 reads and writes `Lot`s
// through the farm store and this file goes.

export type PlotMethod = "sketch" | "corners" | "pin";

/** A lot while it is being plotted. Field names and types come from `Lot`. */
export type DraftLot = Pick<Lot, "id" | "name"> & {
  /** How the lot was plotted. `null` = not plotted yet. */
  method: PlotMethod | null;
  /** Outline from the map. `null` until drawn, and for pin lots. */
  geometry: Lot["geometry"] | null;
  /** Hectares: from the outline (turf.area), or typed by the farmer for a pin lot. */
  area_ha: number | null;
  /** Centre of the outline, or the pin. */
  centroid: LonLat | null;
};

type DraftLotsState = {
  lots: DraftLot[];
  /** Number for the next default name, so "Lot 3" is never reused after a delete. */
  nextNumber: number;
  past: DraftLot[][];
  /** Adds "Lot N" and returns it. */
  addLot: () => DraftLot;
  renameLot: (id: string, name: string) => void;
  removeLot: (id: string) => void;
  setShape: (
    id: string,
    method: "sketch" | "corners",
    shape: { geometry: Lot["geometry"]; area_ha: number; centroid: LonLat },
  ) => void;
  placePin: (id: string, point: LonLat, typedAreaHa: number) => void;
  /** Reverts the last change. Returns false when there is nothing to undo. */
  undo: () => boolean;
};

const HISTORY_LIMIT = 30;

const newLot = (n: number): DraftLot => ({
  id: `lot-${n}`,
  name: `Lot ${n}`,
  method: null,
  geometry: null,
  area_ha: null,
  centroid: null,
});

export const useDraftLots = create<DraftLotsState>((set, get) => {
  /** Applies a change to the lot list and remembers the previous list for Undo. */
  const commit = (lots: DraftLot[], extra: Partial<DraftLotsState> = {}) =>
    set((s) => ({ ...extra, lots, past: [...s.past, s.lots].slice(-HISTORY_LIMIT) }));
  const update = (id: string, change: Partial<DraftLot>) =>
    commit(get().lots.map((l) => (l.id === id ? { ...l, ...change } : l)));

  return {
    lots: [newLot(1)],
    nextNumber: 2,
    past: [],
    addLot: () => {
      const { lots, nextNumber } = get();
      const lot = newLot(nextNumber);
      commit([...lots, lot], { nextNumber: nextNumber + 1 });
      return lot;
    },
    renameLot: (id, name) => {
      const trimmed = name.trim();
      if (trimmed) update(id, { name: trimmed });
    },
    removeLot: (id) => commit(get().lots.filter((l) => l.id !== id)),
    setShape: (id, method, shape) => update(id, { method, ...shape }),
    placePin: (id, point, typedAreaHa) =>
      update(id, { method: "pin", geometry: null, area_ha: typedAreaHa, centroid: point }),
    undo: () => {
      const { past } = get();
      const previous = past[past.length - 1];
      if (!previous) return false;
      set({ lots: previous, past: past.slice(0, -1) });
      return true;
    },
  };
});

/** Parses a typed area like "1.5" or "1,5". Returns `null` unless it is a positive number. */
export function parseHectares(input: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** "0.42 ha", or "1.5 ha (your number)" for a typed area. */
export function areaLabel(lot: DraftLot): string {
  if (lot.area_ha === null) return "Not drawn yet";
  if (lot.method === "pin") return `${lot.area_ha} ha (your number)`;
  return `${lot.area_ha.toFixed(2)} ha`;
}
