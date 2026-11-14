// The optional "Lot details" questions (#41, D16) as plain data, so the form and the
// tests share one list. No React Native imports.
//
// What each answer does in the engine (checked by src/engine/lotDetails.test.ts):
//   land type   -> erosion score (a slope loses more soil in heavy rain)
//   water       -> how much of a dry spell irrigation covers in the water balance
//   soil feel   -> water loss in rice paddies only
//   equipment   -> "check with your technician" lines per crop only; no score (no source found
//                  for which crops need which equipment, so nothing is scored)
// "I don't know" is always allowed, is the default, and lowers the confidence badge when
// two or more of land type, water and soil are unknown (CONFIDENCE_LOW_UNKNOWN_INPUTS in
// engine/params.ts). Equipment never changes confidence.
import type { Equipment, LandType, LotDetails, SoilFeel, WaterSource } from "../types";

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
  options: DetailOption<NonNullable<LotDetails[K]>>[];
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

// Categories: the power sources in Philippine rice and corn surveys (manual, man-animal,
// man-machine; machines mostly hand tractors, few four-wheel tractors). Amongo & Larona 2015,
// CSAM Policy Brief No. 5, Tables 1-2 (data: Amongo et al. 2013),
// https://www.un-csam.org/sites/default/files/2020-10/PB201501.pdf
const EQUIPMENT: DetailQuestion<"equipment"> = {
  key: "equipment",
  title: "What can you use to prepare the land and harvest?",
  hint: "We add a question for your technician for each crop. It does not change the scores.",
  options: [
    { value: "hand" satisfies Equipment, label: "Hand tools only" },
    { value: "carabao" satisfies Equipment, label: "Carabao" },
    { value: "hand-tractor" satisfies Equipment, label: "Hand tractor" },
    { value: "tractor" satisfies Equipment, label: "Four-wheel tractor" },
    { value: "unknown" satisfies Equipment, label: DONT_KNOW },
  ],
};

export const LOT_DETAIL_QUESTIONS = [LAND, WATER, SOIL, EQUIPMENT] as const;

/** Said once above the questions. */
export const LOT_DETAILS_INTRO =
  "These answers are optional. Skip any you are not sure about: some results then show lower confidence, and you can change them later.";

/** Every answer "I don't know": what a new lot starts with. */
export const NO_DETAILS: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown", equipment: "unknown" };

/** The answer to one question; a lot saved before a question existed counts as "I don't know". */
export const detailValue = (details: LotDetails, key: keyof LotDetails): string => details[key] ?? "unknown";

/** A copy of `details` with one answer changed. */
export function setDetail<K extends keyof LotDetails>(details: LotDetails, key: K, value: LotDetails[K]): LotDetails {
  return { ...details, [key]: value };
}

/** How many of the questions have a real answer (not "I don't know"). */
export function answeredCount(details: LotDetails): number {
  return LOT_DETAIL_QUESTIONS.filter((q) => detailValue(details, q.key) !== "unknown").length;
}

/** "2 of 3 answered", for a summary line next to the form. */
export function answeredSummary(details: LotDetails): string {
  return `${answeredCount(details)} of ${LOT_DETAIL_QUESTIONS.length} answered`;
}
