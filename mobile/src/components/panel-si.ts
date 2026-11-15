// SI for each section of the technical data panel (2026-11-15). Each section sends the engine
// results it shows, as short plain lines (no location, no names: CLAUDE.md rule 8), and one call
// returns a one-line insight for every section. Pure TypeScript, no React Native imports.
import { COMPONENT_LABELS, type CropFit, type RotationOption, type SoilHealthResult } from "../engine";
import type { SeasonWindow } from "../engine/plantingWindow";
import { rainCovers } from "../lots/compare-core";
import { seasonLabel } from "../lots/months-core";
import { cropSequence } from "./farmer-core";
import { OPTION_LABELS } from "./soil-health-chart-core";

/** Matches `explainSectionsBody` in api/src/routes/explain.ts. */
export type PanelSection = { id: string; title: string; facts: string[] };

const r = (v: number | null | undefined) => (v == null ? "not known" : String(Math.round(v)));
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const months = (ms: readonly number[]) => (ms.length ? ms.map((m) => MONTH[m - 1]).join(", ") : "none");

export function recommendationFacts(options: readonly RotationOption[], name: (id: string) => string): string[] {
  return options.map((o) => {
    const parts = (Object.keys(o.scores) as (keyof typeof o.scores)[])
      .filter((k) => o.scores[k] !== null)
      .map((k) => `${COMPONENT_LABELS[k]} ${r(o.scores[k])}`);
    return `${OPTION_LABELS[o.key]}: ${cropSequence(o, name)}. Total ${r(o.total)} out of 100. ${parts.join(", ")}.`;
  });
}

export function monthsFacts(seasons: readonly SeasonWindow[], name: (id: string) => string): string[] {
  return seasons.map((w) => {
    const yours = `${name(w.crop_id)} planted ${seasonLabel(w.yours)}: rain covers ${rainCovers(w.yours)} of its water need in a typical year, dry months ${months(w.yours.stress_months)}, waterlogged months ${months(w.yours.waterlog_months)}.`;
    const better = w.better ? ` Better months found: ${seasonLabel(w.better)}, rain covers ${rainCovers(w.better)}, dry months ${months(w.better.stress_months)}.` : " No clearly better months found.";
    return yours + better;
  });
}

export function fitFacts(fits: readonly CropFit[], name: (id: string) => string): string[] {
  return fits.map((f) => {
    const why = f.reasons.map((x) => `${x.code.replace(/-/g, " ")} in ${months(x.months)}`).join("; ");
    return `${name(f.crop_id)}: ${f.level.replace(/-/g, " ")} fit${why ? ` (${why})` : ""}.`;
  });
}

export function soilFacts(result: SoilHealthResult): string[] {
  return result.options.map((o) => {
    const last = o.trajectory?.points[o.trajectory.points.length - 1];
    return `${OPTION_LABELS[o.option_key]}: soil indicator ${r(result.start)} now, ${last ? r(last.value) : "not known"} after ${result.years} years${o.vs_yours != null ? ` (${o.vs_yours >= 0 ? "+" : ""}${Math.round(o.vs_yours)} against your crops)` : ""}.`;
  });
}

/** Keeps the request inside the API's limits. */
export const section = (id: string, title: string, facts: string[]): PanelSection => ({
  id,
  title,
  facts: facts.slice(0, 12).map((f) => f.slice(0, 300)),
});
