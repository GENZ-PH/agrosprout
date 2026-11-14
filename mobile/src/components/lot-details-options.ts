// The three optional "Lot details" questions (#41, D16) as plain data, so the form and the
// tests share one list. No React Native imports.
//
// What each answer does in the engine (checked by src/engine/lotDetails.test.ts):
//   land type   -> erosion score (a slope loses more soil in heavy rain)
//   water       -> how much of a dry spell irrigation covers in the water balance
//   soil feel   -> water loss in rice paddies only
// "I don't know" is always allowed, is the default, and lowers the confidence badge when
// two or more are unknown (CONFIDENCE_LOW_UNKNOWN_INPUTS in engine/params.ts).
import type { LandType, LotDetails, SoilFeel, WaterSource } from "../types";

export interface DetailOption<V extends string> {
  value: V;
  label: string;
}

export interface DetailQuestion<K extends keyof LotDetails = keyof LotDetails> {
  key: K;
  /** The question, as the farmer reads it. */
  title: string;
  /** One line on why it matters, true to what the engine does with the answer. */
  hint: string;
  /** The choices, with "I don't know" last. */
  options: DetailOption<LotDetails[K]>[];
}

const DONT_KNOW = "I don't know";

const LAND: DetailQuestion<"land_type"> = {
  key: "land_type",
  title: "What kind of land is this lot?",
  hint: "Sloping land loses more soil when it rains hard.",
  options: [
    { value: "lowland" satisfies LandType, label: "Lowland or paddy" },
    { value: "upland" satisfies LandType, label: "Upland" },
    { value: "sloping" satisfies LandType, label: "Sloping" },
    { value: "unknown" satisfies LandType, label: DONT_KNOW },
  ],
};

const WATER: DetailQuestion<"water"> = {
  key: "water",
  title: "Where does the water come from?",
  hint: "If you irrigate, we count it against dry spells.",
  options: [
    { value: "rain" satisfies WaterSource, label: "Rain only" },
    { value: "some" satisfies WaterSource, label: "Some irrigation" },
    { value: "full" satisfies WaterSource, label: "Full irrigation" },
    { value: "unknown" satisfies WaterSource, label: DONT_KNOW },
  ],
};

const SOIL: DetailQuestion<"soil"> = {
  key: "soil",
  title: "How does the soil feel?",
  hint: "This matters for rice paddies: sandy soil loses water faster than clay.",
  options: [
    { value: "sandy" satisfies SoilFeel, label: "Sandy" },
    { value: "loamy" satisfies SoilFeel, label: "Loamy" },
    { value: "clayey" satisfies SoilFeel, label: "Clayey" },
    { value: "unknown" satisfies SoilFeel, label: DONT_KNOW },
  ],
};

export const LOT_DETAIL_QUESTIONS = [LAND, WATER, SOIL] as const;

/** Said once above the questions. */
export const LOT_DETAILS_INTRO =
  "These three answers are optional. Skip any you are not sure about: results then show lower confidence, and you can change them later.";

/** All three "I don't know": what a new lot starts with. */
export const NO_DETAILS: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown" };

/** A copy of `details` with one answer changed. */
export function setDetail<K extends keyof LotDetails>(details: LotDetails, key: K, value: LotDetails[K]): LotDetails {
  return { ...details, [key]: value };
}

/** How many of the three questions have a real answer (not "I don't know"). */
export function answeredCount(details: LotDetails): number {
  return LOT_DETAIL_QUESTIONS.filter((q) => details[q.key] !== "unknown").length;
}

/** "2 of 3 answered", for a summary line next to the form. */
export function answeredSummary(details: LotDetails): string {
  return `${answeredCount(details)} of ${LOT_DETAIL_QUESTIONS.length} answered`;
}
