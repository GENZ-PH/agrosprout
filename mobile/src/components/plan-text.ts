import type { FitReason } from "../engine/cropFit";
import { PRIORITY_COMPONENTS } from "../engine/params";
import type { ComponentKey, PriorityKey } from "../engine/scores";
import type { Priorities } from "../types";
import { type T, tEn } from "../i18n/strings";
import { MONTH_NAMES, monthsText } from "./field-year-core";

// Farmer-facing wording for engine codes shown on the dashboard. No React Native imports.

/** One plain sentence for a crop-fit reason, with the months it applies to. */
export function fitReasonText(r: Pick<FitReason, "code" | "months">, t: T = tEn, names: readonly string[] = MONTH_NAMES): string {
  const when = r.months.length > 0 ? t("fit.in", { months: monthsText(r.months, t, names) }) : "";
  return t(`fit.${r.code}`, { when });
}

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
export const listText = (items: readonly string[], t: T = tEn) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${t("list.and")} ${items[items.length - 1]}`;

/**
 * The one-sentence answer that changes with every choice: which plan fits best for the
 * chosen goals, its score, and how far it is from the farmer's own crops (plan A).
 */
export function verdictText(
  input: {
    chosen: readonly PriorityKey[];
    bestKey: string;
    bestName: string;
    bestTotal: number | null;
    baselineTotal: number | null;
    bestIsBaseline: boolean;
  },
  t: T = tEn,
): string {
  const goals =
    input.chosen.length === 0 ? t("verdict.equal") : t("verdict.first", { goals: listText(input.chosen.map((k) => t(`prio.${k}`)), t) });
  if (input.bestTotal === null) return t("verdict.none", { goals });
  const score = Math.round(input.bestTotal);
  if (input.bestIsBaseline) return t("verdict.yours", { goals, score });
  const gap = input.baselineTotal === null ? null : score - Math.round(input.baselineTotal);
  const versus = gap === null ? "" : gap > 0 ? t("verdict.above", { n: gap }) : gap < 0 ? t("verdict.below", { n: -gap }) : t("verdict.level");
  return t("verdict.best", { goals, key: input.bestKey, name: input.bestName, score, versus });
}
