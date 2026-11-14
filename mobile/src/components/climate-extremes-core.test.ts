import { test } from "node:test";
import assert from "node:assert/strict";
import type { LotData } from "../types";
import { monthsLine, trendSentences } from "./climate-extremes-core";

// Values below are the demo farm's (assets/data/demo/lanao-norte-demo-1.json, pipeline 2001-2025).
const base = {
  period: "2001-2025",
  provenance: [{ field: "trends", source: "NASA POWER daily", native_res: "x", period: "2001-2025", retrieved: "2026-11-14" }],
  trends: {
    annual_precip_mm_per_decade: 417.0,
    dry_season_deficit_mm_per_decade: -25.8,
    tmax_c_per_decade: 0.12,
    method: "Sen's slope / Mann-Kendall",
    p_values: { annual_precip_mm_per_decade: 0.0072, dry_season_deficit_mm_per_decade: 0.3602, tmax_c_per_decade: 0.5912 },
  },
} as unknown as LotData;

test("trend sentences use only the data's numbers and say no clear trend at p >= 0.05", () => {
  assert.deepEqual(trendSentences(base), [
    "Yearly rain has been rising by about 417 mm per decade, 2001-2025 (Mann-Kendall p = 0.007).",
    "The dry-season water shortage (evaporation minus rain in the months that are usually short of rain): no clear trend, 2001-2025 (Mann-Kendall p = 0.360).",
    "The average daytime high temperature: no clear trend, 2001-2025 (Mann-Kendall p = 0.591).",
  ]);
  assert.equal(trendSentences({ ...base, trends: null }), null);
});

test("month lines list only months with days, and null means not loaded", () => {
  assert.equal(monthsLine([0, 0, 0.08, 1.4, 0.4, 0, 0, 0, 0, 0, 0, 0]), "Mar 0.08, Apr 1.4, May 0.4");
  assert.equal(monthsLine(Array(12).fill(0)), "0 in every month");
  assert.equal(monthsLine(null), null);
  assert.equal(monthsLine(undefined), null);
});
