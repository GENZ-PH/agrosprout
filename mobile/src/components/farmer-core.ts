// Farmer-first suggestion card (dashboard audit 2026-11-15): the engine's best plan said in plain
// words a farmer can follow without reading the technician details. Only engine output is used:
// the plan's slots, its component scores next to the farmer's own crops, and its first
// "check locally" line. Nothing is worked out here that the engine did not already give.
// Pure TypeScript, no React Native imports, so it is unit-tested in Node.
import type { ComponentKey, Explanation, RotationOption } from "../engine";
import { scoreRows } from "./recommendations-core";
import { monthStates } from "./season-guide-core";

/** Plain words for each part of the score: what the farmer gets, not what the engine measures. */
export const PLAIN_GAIN: Readonly<Record<ComponentKey, string>> = {
  W: "Rain fits the crops better",
  H: "Safer from heat and floods",
  S: "Builds up the soil",
  E: "Keeps soil from washing away",
  B: "Fewer pests and diseases",
  I: "More income",
  M: "Easier trip to market",
  L: "Less work",
};

export interface PlainReason {
  key: ComponentKey;
  /** "Fewer pests and diseases" */
  text: string;
  /** Score of the plan, 0 to 100. */
  plan: number;
  /** Score of the farmer's own crops, 0 to 100. */
  yours: number;
}

/**
 * Up to `max` parts where the plan beats the farmer's own crops, biggest gain first. Each keeps both
 * scores (the plan's and yours, out of 100) so there is one kind of number on the card.
 */
export function plainReasons(
  pick: Pick<RotationOption, "key" | "scores">,
  a: Pick<RotationOption, "key" | "scores"> | undefined,
  leftOut: readonly ComponentKey[],
  max = 3,
): PlainReason[] {
  if (!a || pick.key === a.key) return [];
  return scoreRows(pick, a, leftOut)
    .filter((r) => !r.left_out && r.value !== null && r.delta !== null && r.delta > 0)
    .sort((x, y) => (y.delta ?? 0) - (x.delta ?? 0))
    .slice(0, max)
    .map((r) => ({ key: r.key, text: PLAIN_GAIN[r.key], plan: r.value as number, yours: (r.value as number) - (r.delta as number) }));
}

/** One cell per month, Jan to Dec: the crop in the field (`null` = nothing planted). */
export function yearStrip(option: RotationOption): (string | null)[] {
  return monthStates(option).map((s) => {
    if (s.field.length === 0) return null;
    // A month where one crop is harvested and the next is planted shows the new crop.
    const staying = s.field.filter((id) => !s.harvest.includes(id));
    return staying.length > 0 ? staying[staying.length - 1] : s.field[0];
  });
}

/** "Mungbean, then Lowland rice, then Eggplant": the crops in the plan's own order, each once. */
export function cropSequence(option: Pick<RotationOption, "slots">, name: (id: string) => string): string {
  return [...new Set(option.slots.map((s) => s.crop_id))].map(name).join(", then ");
}

/** The first thing the engine says to check locally, or null when it has none. */
export function checkFirst(explanation: Pick<Explanation, "check_locally"> | undefined): string | null {
  return explanation?.check_locally[0]?.text ?? null;
}
