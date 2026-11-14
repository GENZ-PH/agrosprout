import type { PriorityKey } from "../engine/scores";
import { DEFAULT_PRIORITIES } from "../state/farm-core";
import type { Priorities } from "../types";

// "What matters to you?" chips on the dashboard (#40, D14). Plain logic, no React Native
// imports, so it runs in Node tests. The farm keeps the four values in `farm.priorities`
// (0-100, equal by default); the engine turns them into score weights (priorityWeights).

export const PRIORITY_CHIPS: readonly { key: PriorityKey; label: string }[] = [
  { key: "water", label: "Save water" },
  { key: "soil", label: "Build soil" },
  { key: "income", label: "Extra income" },
  { key: "labor", label: "Less work" },
];

/**
 * A tapped chip counts twice as much as the others; the others keep the default. This is a
 * UI choice, not a sourced number: every priority still counts, the picked ones count more.
 */
export const PICKED_VALUE = 100;

/** A chip shows as picked when its value is above the default (equal) value. */
export const isPicked = (p: Priorities, key: PriorityKey) => p[key] > DEFAULT_PRIORITIES[key];

/** The change to save when a chip is tapped: picked → back to the default, else → picked. */
export const togglePriority = (p: Priorities, key: PriorityKey): Partial<Priorities> => ({
  [key]: isPicked(p, key) ? DEFAULT_PRIORITIES[key] : PICKED_VALUE,
});

/** The picked chips that can't change the ranking yet, because the data behind them is missing. */
export const pickedButNotScored = (p: Priorities, notScored: readonly PriorityKey[]) =>
  PRIORITY_CHIPS.filter((c) => isPicked(p, c.key) && notScored.includes(c.key));

/** "Extra income", "Extra income and Less work". */
export const chipList = (chips: readonly { label: string }[]) =>
  chips.length <= 1
    ? (chips[0]?.label ?? "")
    : `${chips
        .slice(0, -1)
        .map((c) => c.label)
        .join(", ")} and ${chips[chips.length - 1].label}`;

/**
 * The always-visible note under the chips when some priorities have no data behind them yet
 * (#150 review: a judge tapped Extra income and nothing changed). Income (I) and work (L) have no
 * data until the crop list has local prices and labor needs; both priorities also weigh the trip
 * to market (M), which counts only once the farmer adds a place. `null` when every chip counts.
 */
export function notScoredNote(notScored: readonly PriorityKey[]): string | null {
  const chips = PRIORITY_CHIPS.filter((c) => notScored.includes(c.key));
  if (chips.length === 0) return null;
  const many = chips.length > 1;
  return (
    `${chipList(chips)} ${many ? "are" : "is"} not shown yet: the crop list has no local prices or labor needs, so ` +
    `${many ? "they" : "it"} would change nothing. Add a place where you sell or store your harvest and ` +
    `${many ? "they come" : "it comes"} back, counting how easy the trip to market is.`
  );
}
