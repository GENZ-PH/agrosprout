// Which source the inspector panel shows, if any. A tiny store so any chip anywhere can open it
// and the one panel at the app root can show it. No React Native imports.
import { SOURCES, type SourceKey } from "../content/sources";

export type InspectorState = { key: SourceKey; period: string } | null;

let state: InspectorState = null;
const listeners = new Set<() => void>();

export function openInspector(key: SourceKey, period = ""): void {
  if (!SOURCES[key].nasa) return; // the panel is for NASA data only
  if (state && state.key === key && state.period === period) return;
  state = { key, period };
  listeners.forEach((l) => l());
}

export function closeInspector(): void {
  if (!state) return;
  state = null;
  listeners.forEach((l) => l());
}

export const getInspector = (): InspectorState => state;

export function subscribeInspector(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
