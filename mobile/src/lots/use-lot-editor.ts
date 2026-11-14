import { useMemo } from "react";
import { useStore } from "zustand";

import { useFarmStore } from "../state/farm-store";
import { createLotEditor, lotRows, type FarmLotsApi } from "./lot-editor";

const farmLots: FarmLotsApi = {
  getLots: () => useFarmStore.getState().lots,
  nextLotNumber: () => useFarmStore.getState().next_lot_number,
  addLot: (lot) => useFarmStore.getState().addLot(lot),
  updateLot: (id, patch) => useFarmStore.getState().updateLot(id, patch),
  deleteLot: (id) => useFarmStore.getState().deleteLot(id),
  setTravel: (lotId, travel) => useFarmStore.getState().setTravel(lotId, travel),
};

/** One editor for the app, so a lot not drawn yet survives leaving S1. S1 clears Undo when it opens. */
export const lotEditor = createLotEditor(farmLots);

/** S1: saved lots, placeholders, the rows for the list, and the editing actions. */
export function useLotEditor() {
  const lots = useFarmStore((s) => s.lots);
  const placeholders = useStore(lotEditor, (s) => s.placeholders);
  const rows = useMemo(() => lotRows(lots, placeholders), [lots, placeholders]);
  return { ...lotEditor.getState(), lots, placeholders, rows };
}
