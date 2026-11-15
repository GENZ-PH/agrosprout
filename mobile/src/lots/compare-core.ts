import { WINDOW_MARGIN_POINTS } from "../engine/params";
import type { SeasonWindow, WindowDriver, WindowMetrics, WindowUnknown } from "../engine/plantingWindow";
import type { CropSeason } from "../types";
import { monthLong, monthShort, seasonLabel } from "./months-core";

// S5 "Your months vs better months" (#34, #95, docs/11-user-flow.md S5): the words for one
// season's card, from the engine's planting-window scan (`analysis.planting.seasons`,
// plantingWindow.ts). Plain logic, no React Native imports, so it runs in Node tests.
// Every line has a stable `code` (like the explain() lines) for tests and translation (#37).
//
// The engine's statuses: "better" (a month that fits the lot clearly beats yours), "blocked"
// (a clearly better month would run into another season of yours: a trade-off, never a move),
// "already-good" (nothing beats yours by the margin), "unknown" (no Fit). Only "already-good"
// may say the timing is good (#95).

export interface Line {
  code: string;
  text: string;
}

/** One row of the side-by-side table. `other` is `null` when there is no second column. */
export interface CompareRow {
  label: string;
  yours: string;
  other: string | null;
}

export type Tone = "good" | "warn" | "neutral";

export interface SeasonCompare {
  status: SeasonWindow["status"];
  tone: Tone;
  /** The card's first line: what the scan found. */
  headline: Line;
  /** More about the headline (the gain, the trade-off), or `null`. */
  detail: Line | null;
  /** Title of the second column: "Better months", "Clashing month", or `null` for one column. */
  otherTitle: string | null;
  rows: CompareRow[];
  why: Line[];
  unknowns: Line[];
  checks: Line[];
  confidence: "Low" | "Medium";
}

export interface CompareContext {
  /** Short crop name: "Lowland rice". */
  cropName: (cropId: string) => string;
  /** The farmer's seasons for a crop on this lot (to name a clashing season). */
  seasonsOf: (cropId: string) => readonly CropSeason[];
  /** NASA POWER years, e.g. "2001-2025". */
  period: string;
}

const listAnd = (xs: readonly string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
const months = (ms: readonly number[]) => (ms.length === 0 ? "none" : listAnd(ms.map(monthShort)));
const points = (x: number) => `${Math.round(x)} point${Math.round(x) === 1 ? "" : "s"}`;
const range = (m: Pick<WindowMetrics, "plant_month" | "harvest_month">) =>
  seasonLabel({ plant_month: m.plant_month, harvest_month: m.harvest_month });

/** Share of the crop's water need that rain covers in a typical year: 1 − WSI (P50). */
export function rainCovers(m: WindowMetrics): string {
  const wsi = m.wsi.p50;
  if (wsi === null) return "unknown";
  return `${Math.round(Math.max(0, Math.min(1, 1 - wsi)) * 100)}%`;
}

function shiftText(shift: number): string {
  const n = Math.abs(shift);
  return `about ${n} month${n === 1 ? "" : "s"} ${shift > 0 ? "later" : "earlier"}`;
}

/**
 * The table: months, rain, dry, heat (and waterlogging or a wet harvest when either has it), and
 * the Fit score. Fit is the whole lot's water + weather score with this season at these months
 * (rotation-level in the engine), so the label says "lot". `otherFit` `undefined` = no Fit row.
 */
function rows(yours: WindowMetrics, other: WindowMetrics | null, otherFit?: string | null): CompareRow[] {
  const out: CompareRow[] = [
    { label: "Months", yours: range(yours), other: other ? range(other) : null },
    { label: "Rain covers the crop's water need (typical year)", yours: rainCovers(yours), other: other ? rainCovers(other) : null },
    { label: "Dry months (crop short of water)", yours: months(yours.stress_months), other: other ? months(other.stress_months) : null },
    { label: "Heat-risk months", yours: months(yours.heat_months), other: other ? months(other.heat_months) : null },
  ];
  if (yours.waterlog_months.length > 0 || (other?.waterlog_months.length ?? 0) > 0)
    out.push({ label: "Waterlogged months", yours: months(yours.waterlog_months), other: other ? months(other.waterlog_months) : null });
  if (yours.harvest_road_wet || other?.harvest_road_wet)
    out.push({
      label: "Harvest in a heavy-rain month",
      yours: yours.harvest_road_wet ? "yes" : "no",
      other: other ? (other.harvest_road_wet ? "yes" : "no") : null,
    });
  if (otherFit !== undefined)
    out.push({
      label: "How well it suits the lot (water and weather, 0-100)",
      yours: yours.fit === null ? "unknown" : String(Math.round(yours.fit)),
      other: other ? otherFit : null,
    });
  return out;
}

function driverLine(d: WindowDriver, yours: WindowMetrics, other: WindowMetrics): Line {
  switch (d) {
    case "fewer-stress-months":
      return { code: "window.why.stress", text: `Fewer dry months (crop short of water): ${months(yours.stress_months)} now, ${months(other.stress_months)} in the other months.` };
    case "better-water-fit":
      return {
        code: "window.why.water",
        text: `Rain covers more of the crop's water need in a typical year: ${rainCovers(yours)} → ${rainCovers(other)}.`,
      };
    case "less-heat-risk":
      return { code: "window.why.heat", text: `Fewer heat-risk months: ${months(yours.heat_months)} → ${months(other.heat_months)}.` };
    case "less-waterlogging":
      return {
        code: "window.why.waterlog",
        text: `Fewer waterlogged months: ${months(yours.waterlog_months)} → ${months(other.waterlog_months)}.`,
      };
    case "less-erosion":
      return { code: "window.why.erosion", text: "Less risk of soil washing away on your slope." };
  }
}

const UNKNOWN_TEXT: Readonly<Record<WindowUnknown, string>> = {
  "lot-details-unknown": "Some lot details (land type, water source or soil) are \"I don't know\", so this is less certain.",
  "fit-not-computable": "The fit could not be worked out for this season.",
  "dry-year-differs": "In a dry year a different month would be best.",
};

/** What one season's card says. */
export function seasonCompare(w: SeasonWindow, ctx: CompareContext): SeasonCompare {
  const name = ctx.cropName(w.crop_id);
  const unknowns = w.unknowns.map((u) => ({ code: `window.unknown.${u}`, text: UNKNOWN_TEXT[u] }));
  const source: Line = { code: "window.why.source", text: `From NASA POWER monthly rain and temperature, ${ctx.period}.` };
  const technician: Line = {
    code: "window.check.technician",
    text: "Check these months with your agricultural technician and your own experience of the field.",
  };
  const confidence = w.confidence === "medium" ? "Medium" : "Low";

  if (w.status === "better" && w.better && w.delta !== null) {
    const b = w.better;
    return {
      status: w.status,
      tone: "good",
      headline: { code: "window.better", text: `Better months: ${range(b)}` },
      detail: {
        code: "window.better.gain",
        text: `Planting ${w.shift_months !== null ? shiftText(w.shift_months) : "at another time"} adds ${points(w.delta)} to the fit score.`,
      },
      otherTitle: "Better months",
      rows: rows(w.yours, b, `${b.fit === null ? "unknown" : Math.round(b.fit)} (+${Math.round(w.delta)})`),
      why: [...w.drivers.map((d) => driverLine(d, w.yours, b)), source],
      unknowns,
      checks: [
        {
          code: "window.check.ready",
          text: `Is there water for land preparation, seed and labor for planting ${name} in ${monthLong(b.plant_month)}?`,
        },
        technician,
      ],
      confidence,
    };
  }

  if (w.status === "blocked" && w.blocked) {
    const k = w.blocked;
    const clashes = listAnd(
      k.clashes.map((c) => {
        const s = ctx.seasonsOf(c.crop_id)[c.season_index];
        const other = c.crop_id === w.crop_id ? "other " : "";
        return `your ${other}${ctx.cropName(c.crop_id)} season${s ? ` (${seasonLabel(s)})` : ""}`;
      }),
    );
    return {
      status: w.status,
      tone: "warn",
      headline: {
        code: "window.blocked",
        text: `A better month (${monthShort(k.month.plant_month)}) clashes with ${clashes || "another crop of yours"} on this lot.`,
      },
      detail: {
        code: "window.blocked.tradeoff",
        text: `With nothing else on the lot it would add ${points(k.delta)} to the fit score. It is a trade-off to weigh with your technician, not a move to make. Options B–D on the dashboard show other rotations for this lot.`,
      },
      otherTitle: "Clashing month",
      // No Fit row: the gain is measured with each month alone on the lot (in the detail line), not
      // against the lot score in the "yours" column.
      rows: rows(w.yours, k.month),
      why: [...w.drivers.map((d) => driverLine(d, w.yours, k.month)), source],
      unknowns,
      checks: [technician],
      confidence,
    };
  }

  if (w.status === "already-good") {
    // "Already good" only when the farmer's months carry no dry or heat risk. Otherwise nothing
    // beats them, but they are not risk-free, so the card says what to plan for (#150 review).
    const risky = w.yours.stress_months.length > 0 || w.yours.heat_months.length > 0;
    const risks = [
      w.yours.stress_months.length > 0 ? `dry stress in ${months(w.yours.stress_months)}` : null,
      w.yours.heat_months.length > 0 ? `heat risk in ${months(w.yours.heat_months)}` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    const margin = `No other month clearly beats yours: none suits the lot ${WINDOW_MARGIN_POINTS} points better, or has fewer dry months and a higher score, even with nothing else on the lot. (The ${WINDOW_MARGIN_POINTS}-point margin is assumed.)`;
    return {
      status: w.status,
      tone: risky ? "neutral" : "good",
      headline: risky
        ? { code: "window.already-good.risky", text: "No better month found, but plan for the risks" }
        : { code: "window.already-good", text: "Your timing is already good ✓" },
      detail: {
        code: "window.already-good.margin",
        text: risky ? `${margin} Your months still have ${risks}: plan for them with your agricultural technician.` : margin,
      },
      otherTitle: null,
      rows: rows(w.yours, null, null),
      why: [source],
      unknowns,
      checks: [technician],
      confidence,
    };
  }

  return {
    status: "unknown",
    tone: "neutral",
    headline: { code: "window.unknown", text: "We could not compare this season." },
    detail: null,
    otherTitle: null,
    rows: rows(w.yours, null),
    why: [],
    unknowns: unknowns.length > 0 ? unknowns : [{ code: "window.unknown.fit-not-computable", text: UNKNOWN_TEXT["fit-not-computable"] }],
    checks: [technician],
    confidence,
  };
}
