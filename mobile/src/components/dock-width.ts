// Width of the docked NASA data panel, which the farmer or technician can drag (2026-11-15).
// A tiny store so the page (useLayout) and the panel agree, kept on the device between visits.
import { useSyncExternalStore } from "react";

import { DOCK_WIDTH } from "./layout-core";

export const DOCK_MIN = 340;
/** The page keeps at least this much beside the panel. */
export const PAGE_MIN = 560;
const KEY = "dock-width";

const read = (): number => {
  try {
    const v = Number(globalThis.localStorage?.getItem(KEY));
    return Number.isFinite(v) && v >= DOCK_MIN ? v : DOCK_WIDTH;
  } catch {
    return DOCK_WIDTH;
  }
};

let width = read();
const subs = new Set<() => void>();

/** The panel width for this window: the saved one, kept between DOCK_MIN and what leaves PAGE_MIN. */
export function clampDock(w: number, windowWidth: number): number {
  return Math.round(Math.max(DOCK_MIN, Math.min(w, windowWidth - PAGE_MIN)));
}

export function setDockWidth(w: number): void {
  width = w;
  subs.forEach((f) => f());
}

export function saveDockWidth(): void {
  try {
    globalThis.localStorage?.setItem(KEY, String(width));
  } catch {
    // Not saved: the width still holds for this visit.
  }
}

export function useDockWidth(windowWidth: number): number {
  const w = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => width,
    () => width,
  );
  return clampDock(w, windowWidth);
}
