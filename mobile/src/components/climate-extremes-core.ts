import type { LotData, MonthlySeries } from "../types";

// Text for ClimateExtremesCard: only numbers from the lot's data, no React Native imports.

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Mann-Kendall p-values below this are called a clear trend (the usual 5 % significance level). */
export const CLEAR_TREND_P = 0.05;

/** Up to two decimals (0.04 = one day in 25 years), without trailing zeros. */
export function fmtDays(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function fmtP(p: number): string {
  return p < 0.001 ? "< 0.001" : `= ${p.toFixed(3)}`;
}

/** "Apr 0.2, Oct 0.4", "0 in every month", or `null` when the series is not loaded. */
export function monthsLine(s: MonthlySeries | null | undefined): string | null {
  if (!s || s.length !== 12 || s.every((v) => v === null)) return null;
  const parts = s.flatMap((v, i) => (v !== null && Math.round(v * 100) > 0 ? [`${MONTHS_SHORT[i]} ${fmtDays(v)}`] : []));
  if (parts.length === 0) return s.some((v) => v === null) ? "0 in every month with data" : "0 in every month";
  return parts.join(", ");
}

/** True when any month rounds to at least 0.01 days. */
export function hasDays(s: MonthlySeries | null | undefined): boolean {
  return !!s && s.some((v) => v !== null && Math.round(v * 100) > 0);
}

/** Years the trends cover: the trends provenance entry, else the lot's period. */
export function trendPeriod(data: LotData): string {
  return data.provenance.find((p) => p.field === "trends")?.period ?? data.period;
}

type TrendSpec = { key: "annual_precip_mm_per_decade" | "dry_season_deficit_mm_per_decade" | "tmax_c_per_decade"; what: string; up: string; down: string; unit: string; digits: number };

const SPECS: TrendSpec[] = [
  { key: "annual_precip_mm_per_decade", what: "Yearly rain", up: "rising", down: "falling", unit: "mm", digits: 0 },
  {
    key: "dry_season_deficit_mm_per_decade",
    what: "The dry-season water shortage (evaporation minus rain in the months that are usually short of rain)",
    up: "growing",
    down: "shrinking",
    unit: "mm",
    digits: 0,
  },
  { key: "tmax_c_per_decade", what: "The average daytime high temperature", up: "rising", down: "falling", unit: "°C", digits: 2 },
];

/** One plain sentence per trend, or `null` when the trends are not loaded. */
export function trendSentences(data: LotData): string[] | null {
  const t = data.trends;
  if (!t) return null;
  const period = trendPeriod(data);
  return SPECS.map((s) => {
    const slope = t[s.key];
    const p = t.p_values[s.key];
    if (slope === null) return `${s.what}: not loaded yet.`;
    if (p === undefined) return `${s.what}: too few years to test for a trend (${period}).`;
    if (p >= CLEAR_TREND_P || slope === 0) return `${s.what}: no clear trend, ${period} (Mann-Kendall p ${fmtP(p)}).`;
    const size = Math.abs(slope).toFixed(s.digits);
    return `${s.what} has been ${slope > 0 ? s.up : s.down} by about ${size} ${s.unit} per decade, ${period} (Mann-Kendall p ${fmtP(p)}).`;
  });
}
