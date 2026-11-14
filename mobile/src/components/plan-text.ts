import type { ConfidenceReason } from "../engine/explain";
import type { FitLevel, FitReason } from "../engine/cropFit";
import { PRIORITY_COMPONENTS } from "../engine/params";
import type { ComponentKey, PriorityKey } from "../engine/scores";
import type { Priorities } from "../types";
import { monthsText } from "./field-year-core";

// Farmer-facing wording for engine codes shown on the dashboard. No React Native imports.

export const FIT_LABEL: Readonly<Record<FitLevel, string>> = {
  good: "Good fit",
  watch: "Watch out",
  poor: "Poor fit",
  unknown: "Not enough data",
};

/** One plain sentence for a crop-fit reason, with the months it applies to. */
export function fitReasonText(r: Pick<FitReason, "code" | "months">): string {
  const when = r.months.length > 0 ? ` in ${monthsText(r.months)}` : "";
  switch (r.code) {
    case "water":
      return `Rain covers too little of its water need${when} in a typical year.`;
    case "dry-year":
      return `Fine in a typical year, but short of water${when} in a dry year.`;
    case "too-hot":
      return `Hotter than this crop can take${when}.`;
    case "too-cold":
      return `Colder than this crop can take${when}.`;
    case "warm":
      return `Warmer than this crop likes${when}.`;
    case "cool":
      return `Cooler than this crop likes${when}.`;
    case "waterlogging":
      return `Very wet soil${when}, and this crop does not like wet feet.`;
    case "no-crop-data":
      return "We do not have water-use data for this crop yet.";
    case "no-months":
      return "We do not know its planting months yet.";
    case "missing-climate":
      return `NASA data is missing${when}.`;
  }
}

export const CONFIDENCE_REASON: Readonly<Record<ConfidenceReason, string>> = {
  "ranking-flips-dry-wet": "The best plan changes between a dry year and a wet year.",
  "dry-wet-not-checked": "The dry-year and wet-year check could not run.",
  "unknown-inputs": "Several lot details are not known yet.",
  "one-unknown-input": "One lot detail is not known yet.",
  "scores-missing": "Some scores have no data on this lot.",
  "crop-data-missing": "Some crop data is missing.",
  "water-not-scored": "Water fit could not be scored.",
};

export const PRIORITY_LABEL: Readonly<Record<PriorityKey, string>> = {
  water: "Save water",
  soil: "Build soil",
  income: "Extra income",
  labor: "Less work",
};
export const PRIORITY_KEYS: readonly PriorityKey[] = ["water", "soil", "income", "labor"];

const ON = 100;
const OFF = 20;
const EQUAL = 50;

/** A priority counts as chosen when it is above the neutral value. */
export const chosenPriorities = (p: Priorities): PriorityKey[] => PRIORITY_KEYS.filter((k) => p[k] > EQUAL);

/**
 * Priorities after tapping one chip. Chosen ones weigh 100 and the rest 20, so the rest still
 * count a little. With nothing chosen every priority is equal (50), the types.ts default.
 */
export function togglePriority(p: Priorities, key: PriorityKey): Priorities {
  const chosen = new Set(chosenPriorities(p));
  if (chosen.has(key)) chosen.delete(key);
  else chosen.add(key);
  const value = (k: PriorityKey) => (chosen.size === 0 ? EQUAL : chosen.has(k) ? ON : OFF);
  return { water: value("water"), soil: value("soil"), income: value("income"), labor: value("labor") };
}

/**
 * Joins lines that say the same thing about different crops ("Rice: no value for X" and
 * "Corn: no value for X" become "Rice and Corn: no value for X"), so a list of gaps reads
 * once instead of once per crop. Lines without a "Name: " prefix pass through unchanged.
 */
export function mergeCropLines<T extends { code: string; text: string }>(lines: readonly T[]): { code: string; text: string }[] {
  const out: { code: string; names: string[]; rest: string | null; text: string }[] = [];
  for (const l of lines) {
    const m = /^([^:.]{1,40}): (.+)$/.exec(l.text);
    const same = m ? out.find((o) => o.rest === m[2]) : undefined;
    if (m && same) same.names.push(m[1]);
    else out.push({ code: l.code, names: m ? [m[1]] : [], rest: m ? m[2] : null, text: l.text });
  }
  return out.map((o) => {
    if (o.rest === null || o.names.length < 2) return { code: o.code, text: o.text };
    const names = `${o.names.slice(0, -1).join(", ")} and ${o.names[o.names.length - 1]}`;
    return { code: o.code, text: `${names}: ${o.rest}` };
  });
}

/** Priorities with no component the lot can score yet (for example income before prices are known). */
export const unavailablePriorities = (leftOut: readonly ComponentKey[]): PriorityKey[] =>
  PRIORITY_KEYS.filter((k) => (PRIORITY_COMPONENTS[k] as readonly ComponentKey[]).every((c) => leftOut.includes(c)));

/** "Save water", "Save water and Build soil", "Save water, Build soil and Less work". */
export const listText = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * The one-sentence answer that changes with every choice: which plan fits best for the
 * chosen goals, its score, and how far it is from the farmer's own crops (plan A).
 */
export function verdictText(input: {
  chosen: readonly PriorityKey[];
  bestKey: string;
  bestName: string;
  bestTotal: number | null;
  baselineTotal: number | null;
  bestIsBaseline: boolean;
}): string {
  const goals = input.chosen.length === 0 ? "With every goal counted the same" : `With ${listText(input.chosen.map((k) => PRIORITY_LABEL[k]))} first`;
  if (input.bestTotal === null) return `${goals}, the plans cannot be scored on this lot yet.`;
  const score = Math.round(input.bestTotal);
  if (input.bestIsBaseline) return `${goals}, your crops now already fit best: ${score} out of 100.`;
  const gap = input.baselineTotal === null ? null : score - Math.round(input.baselineTotal);
  const versus = gap === null ? "" : gap > 0 ? `, ${gap} above your crops now` : gap < 0 ? `, ${-gap} below your crops now` : ", level with your crops now";
  return `${goals}, plan ${input.bestKey} (${input.bestName}) fits best: ${score} out of 100${versus}.`;
}
