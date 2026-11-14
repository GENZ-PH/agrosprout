import type { PriorityKey } from "../engine/scores";
import { DEFAULT_PRIORITY_VALUE } from "../engine/params";
import { DEFAULT_PRIORITIES } from "../state/farm-core";
import type { Priorities } from "../types";

// "What matters to you?" chips on the dashboard (#40, D14). Plain logic, no React Native
// imports, so it runs in Node tests. The farm keeps the five values in `farm.priorities`
// (0-100, equal by default); the engine turns them into score weights (priorityWeights).

export const PRIORITY_CHIPS: readonly { key: PriorityKey; label: string }[] = [
  { key: "water", label: "Save water" },
  { key: "soil", label: "Build soil" },
  { key: "income", label: "Extra income" },
  { key: "labor", label: "Less work" },
  { key: "forage", label: "Feed animals" },
];

/**
 * A tapped chip counts twice as much as the others; the others keep the default. This is a
 * UI choice, not a sourced number: every priority still counts, the picked ones count more.
 */
export const PICKED_VALUE = 100;

/** A chip shows as picked when its value is above the default (equal) value. */
export const isPicked = (p: Priorities, key: PriorityKey) => (p[key] ?? DEFAULT_PRIORITY_VALUE) > (DEFAULT_PRIORITIES[key] ?? DEFAULT_PRIORITY_VALUE);

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
