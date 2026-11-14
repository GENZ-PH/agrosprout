// What the NASA data panel shows, if anything. A tiny store so any chip or button anywhere can
// open it and the one panel at the app root can show it. No React Native imports.
//
// Two views (#165): "overview" = all NASA data behind the lot on screen (opened by the header's
// NASA data button), and "source" = one dataset in detail (opened by a NASA chip on a card, or
// from the overview). The dashboard registers the lot it shows as the panel's context.
import type { ReactNode } from "react";

import { SOURCES, type SourceKey } from "../content/sources";

export type InspectorState =
  | { view: "source"; key: SourceKey; period: string }
  | { view: "overview" }
  | null;

/** The lot the dashboard shows, for the overview. `extra` = cards that live in the panel (satellite checks, requests). */
export type PanelContext = {
  lotName: string;
  period: string;
  /** True on the sample farm (bundled data, no requests). */
  demo: boolean;
  /** NASA datasets this lot's results rest on, in the order to list them. */
  sources: SourceKey[];
  extra?: ReactNode;
};

let state: InspectorState = null;
let context: PanelContext | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openInspector(key: SourceKey, period = ""): void {
  if (!SOURCES[key].nasa) return; // the panel is for NASA data only
  if (state?.view === "source" && state.key === key && state.period === period) return;
  state = { view: "source", key, period };
  emit();
}

export function openOverview(): void {
  if (state?.view === "overview") return;
  state = { view: "overview" };
  emit();
}

/** The header button: opens the overview, or closes the panel when it is open. */
export function toggleOverview(): void {
  if (state) closeInspector();
  else openOverview();
}

export function closeInspector(): void {
  if (!state) return;
  state = null;
  emit();
}

export function setPanelContext(c: PanelContext | null): void {
  context = c;
  emit();
}

export const getInspector = (): InspectorState => state;
export const getPanelContext = (): PanelContext | null => context;

export function subscribeInspector(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
