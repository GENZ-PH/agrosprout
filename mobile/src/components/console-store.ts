// What the NASA data console shows: the lot and plan on screen, the month the farmer is looking
// at, and whether the console is open. Screens write it; the console at the app root reads it.
// No React Native imports.
import type { RotationOption } from "../engine/rotations";
import type { LotData } from "../types";

export interface ConsoleState {
  open: boolean;
  lotName: string | null;
  data: LotData | null;
  plan: Pick<RotationOption, "slots" | "metrics"> | null;
  planLabel: string | null;
  /** 1-12. */
  month: number;
  /** Crop id to the name shown in the app. */
  cropName: ((id: string) => string) | null;
}

let state: ConsoleState = { open: true, lotName: null, data: null, plan: null, planLabel: null, month: new Date().getMonth() + 1, cropName: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setConsole(patch: Partial<ConsoleState>): void {
  const next = { ...state, ...patch };
  if ((Object.keys(patch) as (keyof ConsoleState)[]).every((k) => next[k] === state[k])) return;
  state = next;
  emit();
}

export const getConsole = (): ConsoleState => state;

export function subscribeConsole(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
