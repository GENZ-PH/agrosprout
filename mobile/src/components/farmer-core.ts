// Farmer-first suggestion card (dashboard audit 2026-11-15): the engine's best plan said in plain
// words a farmer can follow without reading the technician details. Only engine output is used:
// the plan's slots, its component scores next to the farmer's own crops, and its first
// "check locally" line. Nothing is worked out here that the engine did not already give.
// Pure TypeScript, no React Native imports, so it is unit-tested in Node.
import type { ComponentKey, Explanation, RotationOption } from "../engine";
import { scoreRows } from "./recommendations-core";
import { monthStates } from "./season-guide-core";
import { seasonLengthDays } from "../engine/season";
import { seasonsText } from "../lots/months-core";
import type { Crop, Lot } from "../types";

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

export interface LongerSeason {
  crop_id: string;
  /** The months the farmer gave, e.g. "Jan–Mar". */
  given: string;
  /** The crop's season length the results use instead, in days. */
  days: number;
}

/**
 * Seasons the engine does not take as given: when the farmer's months are more than 30% off the
 * crop's own season length (engine/season.ts, FARMER_SEASON_TOLERANCE), the results use the
 * crop's length from its planting month. Said on screen so "You now" does not look like a mistake.
 */
export function longerSeasons(lot: Pick<Lot, "crops">, cropById: (id: string) => Crop | undefined): LongerSeason[] {
  const out: LongerSeason[] = [];
  for (const c of lot.crops) {
    const crop = cropById(c.crop_id);
    if (!crop) continue;
    for (const season of c.seasons) {
      const used = seasonLengthDays(crop, season);
      if (used.source !== "farmer" && used.days !== null) out.push({ crop_id: c.crop_id, given: seasonsText([season]), days: used.days });
    }
  }
  return out;
}
