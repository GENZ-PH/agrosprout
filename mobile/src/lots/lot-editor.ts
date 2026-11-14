import { createStore, type StoreApi } from "zustand/vanilla";

import type { LotPatch, NewLot } from "../state/farm-core";
import type { LonLat, Lot, Travel } from "../types";

// S1 lot editing on top of the farm store (#18, #21). Plotted lots are saved in the
// farm store at once. A lot the farmer added but has not drawn yet ("Lot 2, not drawn
// yet") is a placeholder on this screen only, because the farm store needs an outline.
// Undo covers every change made here. No React Native imports, so it runs in Node tests.

/** The part of the farm store S1 uses. */
export interface FarmLotsApi {
  getLots: () => Lot[];
  nextLotNumber: () => number;
  addLot: (lot: NewLot) => string;
  updateLot: (id: string, patch: LotPatch) => void;
  deleteLot: (id: string) => void;
  setTravel: (lotId: string, travel: Travel) => void;
}

/** A lot added but not drawn yet. Lives on this screen only; never saved. */
export interface PlaceholderLot {
  id: string;
  name: string;
  /** The N in "Lot N", so new placeholders never reuse a number. */
  n: number;
}

export type LotShape = Pick<Lot, "geometry" | "area_ha" | "centroid">;

/** One row of the S1 lot list: a saved lot or a placeholder. */
export interface LotRowData {
  id: string;
  name: string;
  /** Hectares, or `null` when the lot is not drawn yet. */
  area_ha: number | null;
  /** A pin lot: the area is the farmer's typed number. */
  pin: boolean;
}

export interface LotEditorState {
  placeholders: PlaceholderLot[];
  /** Starts the list with a "Lot 1" placeholder when the farm has no lots yet. */
  ensureStarted: () => void;
  addPlaceholder: () => PlaceholderLot;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /**
   * Saves an outline (or a pin) for a lot. A placeholder becomes a saved lot:
   * returns its farm store id, which replaces the placeholder id.
   */
  setShape: (id: string, shape: LotShape) => string;
  /** Reverts the last change. Returns false when there is nothing to undo. */
  undo: () => boolean;
}

const HISTORY_LIMIT = 30;

/**
 * A pin lot ("drop a pin + type the area", the S1 fallback) is saved as a Polygon
 * whose ring is the pin repeated: the `Lot` contract has no point shape, and a
 * zero-area ring can't be mistaken for a drawn outline. `area_ha` is the typed number.
 */
export function pinShape(point: LonLat, area_ha: number): LotShape {
  const p = (): LonLat => [point[0], point[1]];
  return { geometry: { type: "Polygon", coordinates: [[p(), p(), p(), p()]] }, area_ha, centroid: p() };
}

export function isPinLot(lot: Pick<Lot, "geometry">): boolean {
  const ring = lot.geometry.coordinates[0] ?? [];
  const [lon, lat] = ring[0] ?? [];
  return ring.length > 0 && ring.every((p) => p[0] === lon && p[1] === lat);
}

/** Parses a typed area like "1.5" or "1,5". Returns `null` unless it is a positive number. */
export function parseHectares(input: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** "0.42 ha", "1.5 ha (your number)" for a pin lot, or "Not drawn yet". */
export function areaLabel(row: LotRowData): string {
  if (row.area_ha === null) return "Not drawn yet";
  if (row.pin) return `${row.area_ha} ha (your number)`;
  return `${row.area_ha.toFixed(2)} ha`;
}

/** Saved lots in farm order, then placeholders. */
export function lotRows(lots: Lot[], placeholders: PlaceholderLot[]): LotRowData[] {
  return [
    ...lots.map((l) => ({ id: l.id, name: l.name, area_ha: l.area_ha, pin: isPinLot(l) })),
    ...placeholders.map((p) => ({ id: p.id, name: p.name, area_ha: null, pin: false })),
  ];
}

export function createLotEditor(api: FarmLotsApi): StoreApi<LotEditorState> {
  return createStore<LotEditorState>()((set, get) => {
    const past: (() => void)[] = [];
    // Undo of a delete re-adds the lot under a new farm id; older undo steps follow it here.
    const movedTo = new Map<string, string>();
    const resolve = (id: string) => {
      let at = id;
      while (movedTo.has(at)) at = movedTo.get(at) as string;
      return at;
    };
    const remember = (undoStep: () => void) => {
      past.push(undoStep);
      if (past.length > HISTORY_LIMIT) past.shift();
    };
    const findLot = (id: string) => api.getLots().find((l) => l.id === id);
    const findPlaceholder = (id: string) => get().placeholders.find((p) => p.id === id);
    const insertPlaceholder = (p: PlaceholderLot, index: number) =>
      set((s) => {
        const next = s.placeholders.filter((x) => x.id !== p.id);
        next.splice(Math.min(index, next.length), 0, p);
        return { placeholders: next };
      });
    const dropPlaceholder = (id: string) => set((s) => ({ placeholders: s.placeholders.filter((p) => p.id !== id) }));
    const newPlaceholder = (): PlaceholderLot => {
      const n = Math.max(api.nextLotNumber(), ...get().placeholders.map((p) => p.n + 1));
      return { id: `new-${n}`, name: `Lot ${n}`, n };
    };

    return {
      placeholders: [],

      ensureStarted: () => {
        if (api.getLots().length === 0 && get().placeholders.length === 0) {
          set({ placeholders: [newPlaceholder()] });
        }
      },

      addPlaceholder: () => {
        const p = newPlaceholder();
        set((s) => ({ placeholders: [...s.placeholders, p] }));
        remember(() => dropPlaceholder(p.id));
        return p;
      },

      rename: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const p = findPlaceholder(id);
        if (p) {
          set((s) => ({ placeholders: s.placeholders.map((x) => (x.id === id ? { ...x, name: trimmed } : x)) }));
          remember(() =>
            set((s) => ({ placeholders: s.placeholders.map((x) => (x.id === id ? { ...x, name: p.name } : x)) })),
          );
          return;
        }
        const lot = findLot(id);
        if (!lot) return;
        api.updateLot(id, { name: trimmed });
        remember(() => api.updateLot(resolve(id), { name: lot.name }));
      },

      remove: (id) => {
        const index = get().placeholders.findIndex((p) => p.id === id);
        if (index >= 0) {
          const p = get().placeholders[index];
          dropPlaceholder(id);
          remember(() => insertPlaceholder(p, index));
          return;
        }
        const lot = findLot(id);
        if (!lot) return;
        api.deleteLot(id);
        remember(() => {
          // Comes back at the end of the list, with its crops, details and travel.
          // Its climate data was removed with it, so the lot sync fetches it again.
          const back = api.addLot({
            name: lot.name,
            geometry: lot.geometry,
            area_ha: lot.area_ha,
            centroid: lot.centroid,
            details: lot.details,
            crops: lot.crops,
            ...(lot.province_code !== undefined ? { province_code: lot.province_code } : {}),
          });
          for (const t of lot.travel) api.setTravel(back, t);
          movedTo.set(id, back);
        });
      },

      setShape: (id, shape) => {
        const index = get().placeholders.findIndex((p) => p.id === id);
        if (index >= 0) {
          const p = get().placeholders[index];
          const saved = api.addLot({ name: p.name, ...shape });
          dropPlaceholder(id);
          remember(() => {
            api.deleteLot(resolve(saved));
            insertPlaceholder(p, index);
          });
          return saved;
        }
        const lot = findLot(id);
        if (!lot) return id;
        // The map also reports a lot that was only tapped; an unchanged outline is not an Undo step.
        if (JSON.stringify(lot.geometry) === JSON.stringify(shape.geometry) && lot.area_ha === shape.area_ha) return id;
        const before: LotShape = { geometry: lot.geometry, area_ha: lot.area_ha, centroid: lot.centroid };
        api.updateLot(id, shape);
        remember(() => api.updateLot(resolve(id), before));
        return id;
      },

      undo: () => {
        const step = past.pop();
        if (!step) return false;
        step();
        return true;
      },
    };
  });
}
