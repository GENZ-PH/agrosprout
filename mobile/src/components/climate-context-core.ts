import type { ClimateContext } from "../types";

// "Climate right now" card (#10): the NOAA ONI value and the PAGASA advisory from
// assets/data/context.json, shown as context. Neither is an engine input, and neither is NASA data.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** NOAA's three-month ONI season code ("ASO") as months ("Aug–Oct 2026"). Null if it is not a 3-letter season. */
export function seasonLabel(season: string, year: number): string | null {
  const letters = "JFMAMJJASOND";
  if (!/^[JFMAMJJASOND]{3}$/.test(season)) return null;
  for (let start = 0; start < 12; start++) {
    const slice = Array.from({ length: 3 }, (_, i) => letters[(start + i) % 12]).join("");
    if (slice === season) {
      const end = (start + 2) % 12;
      // NOAA names a season by its middle month's year; DJF 2026 is Dec 2025 to Feb 2026.
      const y = year;
      const first = start > end ? `${MONTHS[start]} ${y - 1}` : MONTHS[start];
      return `${first}–${MONTHS[end]} ${y}`;
    }
  }
  return null;
}

export interface ContextLine {
  heading: string;
  body: string;
  source: string;
  url: string;
}

/** The lines to show, in order. Empty when the file has neither value (the card then hides). */
export function contextLines(ctx: ClimateContext | null): ContextLine[] {
  const lines: ContextLine[] = [];
  if (ctx?.oni && ctx.oni.anomaly_c !== null) {
    const when = seasonLabel(ctx.oni.season, ctx.oni.year) ?? `${ctx.oni.season} ${ctx.oni.year}`;
    const sign = ctx.oni.anomaly_c > 0 ? "+" : "";
    lines.push({
      heading: "Pacific Ocean temperature",
      body: `${when}: ${sign}${ctx.oni.anomaly_c.toFixed(2)} °C compared with the long-term average (the Oceanic Niño Index). A positive value means a warmer Pacific.`,
      source: `${ctx.oni.source}, read ${ctx.oni.retrieved}`,
      url: ctx.oni.url,
    });
  }
  if (ctx?.advisory) {
    lines.push({
      heading: `${ctx.advisory.issuer} advisory, ${ctx.advisory.issued}`,
      body: ctx.advisory.summary_by_hand,
      source: `${ctx.advisory.issuer}: "${ctx.advisory.title}"`,
      url: ctx.advisory.url,
    });
  }
  return lines;
}
