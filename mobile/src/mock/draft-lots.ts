import { create } from "zustand";

import type { Lot } from "../types";

// TEMPORARY (#21 shell). In-memory lots so S1 and S2 can be clicked through
// before the farm store (#18) and the map (#19) land. Not persisted. When #18
// merges, S1 reads and writes `Lot`s through the farm store and this file goes.

export type PlotMethod = "sketch" | "corners" | "pin";

/** A lot before the map gives it a polygon. Field names and types come from `Lot`. */
export type DraftLot = Pick<Lot, "id" | "name"> & {
  /** How the lot was plotted. `null` = not plotted yet. */
  method: PlotMethod | null;
  /** Hectares the farmer typed (pin fallback). Drawn lots get `Lot.area_ha` from the polygon (#19). */
  typed_area_ha: number | null;
};

type DraftLotsState = {
  lots: DraftLot[];
  /** Number for the next default name, so "Lot 3" is never reused after a delete. */
  nextNumber: number;
  past: DraftLot[][];
  /** Adds "Lot N" and returns its name. */
  addLot: () => string;
  renameLot: (id: string, name: string) => void;
  removeLot: (id: string) => void;
  plotLot: (id: string, method: PlotMethod, typedAreaHa?: number) => void;
  /** Reverts the last change. Returns false when there is nothing to undo. */
  undo: () => boolean;
};

const HISTORY_LIMIT = 20;

const newLot = (n: number): DraftLot => ({
  id: `lot-${n}`,
  name: `Lot ${n}`,
  method: null,
  typed_area_ha: null,
});

export const useDraftLots = create<DraftLotsState>((set, get) => {
  /** Applies a change to the lot list and remembers the previous list for Undo. */
  const commit = (lots: DraftLot[], extra: Partial<DraftLotsState> = {}) =>
    set((s) => ({ ...extra, lots, past: [...s.past, s.lots].slice(-HISTORY_LIMIT) }));

  return {
    lots: [newLot(1)],
    nextNumber: 2,
    past: [],
    addLot: () => {
      const { lots, nextNumber } = get();
      const lot = newLot(nextNumber);
      commit([...lots, lot], { nextNumber: nextNumber + 1 });
      return lot.name;
    },
    renameLot: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit(get().lots.map((l) => (l.id === id ? { ...l, name: trimmed } : l)));
    },
    removeLot: (id) => commit(get().lots.filter((l) => l.id !== id)),
    plotLot: (id, method, typedAreaHa) =>
      commit(
        get().lots.map((l) =>
          l.id === id ? { ...l, method, typed_area_ha: method === "pin" ? typedAreaHa ?? null : null } : l,
        ),
      ),
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
