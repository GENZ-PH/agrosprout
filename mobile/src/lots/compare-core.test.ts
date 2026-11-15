/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { CROP_LIBRARY_FIXTURE } from "../engine/__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import { plantingWindow, type SeasonWindow, type WindowMetrics } from "../engine/plantingWindow";
import type { CropSeason, LotCrop, LotData, LotDetails } from "../types";
import { rainCovers, seasonCompare, type CompareContext } from "./compare-core";

// The engine's own scan on the same lots as plantingWindow.test.ts, so these tests check the
// words the farmer reads for each real status, not hand-made engine output.

const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const season = (p: number, h: number): CropSeason => ({ plant_month: p, harvest_month: h });
const lc = (crop_id: string, ...seasons: CropSeason[]): LotCrop => ({ crop_id, seasons });
const flat = (v: number) => Array.from({ length: 12 }, () => v);

function climate(rain: number[]): Pick<LotData, "monthly"> {
  return {
    monthly: {
      precip_mm: { p20: rain, p50: rain, p80: rain },
      et0_mm: flat(100),
      tmax_c: flat(31),
      tmin_c: flat(23),
      rootzone_wetness: flat(0.5),
      rh2m_pct: null,
      ws2m_ms: null,
      solar_mj_m2_day: null,
      heat_days_gt35: null,
      heavy_rain_days_gt50mm: null,
      smap_rootzone_m3m3: null,
    },
  };
}

const scan = (crops: LotCrop[], data: Pick<LotData, "monthly">, details: LotDetails = lowland) =>
  plantingWindow({ lot: { crops, details }, data, library: CROP_LIBRARY_FIXTURE });

const ctx = (crops: LotCrop[]): CompareContext => ({
  cropName: (id) => (id === "lowland-rice" ? "Lowland rice" : id === "corn" ? "Corn" : id),
  seasonsOf: (id) => crops.find((c) => c.crop_id === id)?.seasons ?? [],
  period: "2001-2025",
});

/** Wet Jun-Oct, dry the rest (synthetic, as in plantingWindow.test.ts). */
const wetSummer = climate([30, 20, 20, 30, 120, 450, 450, 450, 450, 450, 80, 40]);
const twoRice = [lc("lowland-rice", season(6, 10), season(11, 3))];

test('a blocked season names the clashing season, shows the gain as a trade-off, and never says "already good" (#95)', () => {
  const r = scan(twoRice, wetSummer);
  const nov = r.seasons.find((s) => s.season_index === 1) as SeasonWindow;
  const c = seasonCompare(nov, ctx(twoRice));
  assert.equal(c.status, "blocked");
  assert.equal(c.tone, "warn");
  assert.match(c.headline.text, /^A better month \(\w{3}\) clashes with your other Lowland rice season \(Jun → Oct\) on this lot\.$/);
  assert.match(c.detail?.text ?? "", /not a move to make/);
  assert.equal(c.otherTitle, "Clashing month");
  const all = [c.headline, c.detail, ...c.why, ...c.checks].map((l) => l?.text ?? "").join(" ");
  assert.doesNotMatch(all, /already good/i);
  assert.ok(c.why.length >= 2, "says what would improve, and the data source");
  // The gain is "alone on the lot", so it is not put next to the lot score in the table.
  assert.ok(!c.rows.some((r) => r.label.startsWith("How well it suits the lot")));
});

test("the season already in the wet months says the timing is good, with one column", () => {
  const r = scan(twoRice, wetSummer);
  const jun = r.seasons.find((s) => s.season_index === 0) as SeasonWindow;
  const c = seasonCompare(jun, ctx(twoRice));
  assert.equal(c.status, "already-good");
  const risky = jun.yours.stress_months.length > 0 || jun.yours.heat_months.length > 0;
  assert.equal(c.headline.text, risky ? "No better month found, but plan for the risks" : "Your timing is already good ✓");
  assert.equal(c.otherTitle, null);
  assert.ok(c.rows.every((r) => r.other === null));
  assert.match(c.detail?.text ?? "", /10-point margin is assumed/);
  assert.ok(c.rows.some((r) => r.label.startsWith("How well it suits the lot")));
});

test("real Iligan lot: a better month comes with its gain, the side-by-side numbers and a planting check", () => {
  const crops = [lc("corn", season(2, 5)), lc("mungbean", season(3, 5))];
  const r = scan(crops, { monthly: ILIGAN_LOT_FIXTURE.monthly });
  const corn = r.seasons.find((s) => s.crop_id === "corn") as SeasonWindow;
  assert.equal(corn.status, "better");
  const c = seasonCompare(corn, ctx(crops));
  assert.match(c.headline.text, /^Better months: \w{3} → \w{3}$/);
  assert.match(c.detail?.text ?? "", /^Planting about \d months? (later|earlier) adds \d+ points? to the fit score\.$/);
  assert.equal(c.otherTitle, "Better months");
  const fit = c.rows.find((r) => r.label.startsWith("How well it suits the lot"));
  assert.match(fit?.other ?? "", /^\d+ \(\+\d+\)$/);
  assert.ok(c.checks.some((l) => l.code === "window.check.ready" && /Corn in \w+\?$/.test(l.text)));
});

test("rain covers = 1 − the typical-year water stress index, never below 0% or above 100%", () => {
  const m = (p50: number | null) => ({ wsi: { p20: null, p50, p80: null } }) as unknown as WindowMetrics;
  assert.equal(rainCovers(m(0.38)), "62%");
  assert.equal(rainCovers(m(0)), "100%");
  assert.equal(rainCovers(m(1.4)), "0%");
  assert.equal(rainCovers(m(null)), "unknown");
});

test("already good only when the farmer's months have no dry or heat risk; otherwise it names the risky months", () => {
  const r = scan(twoRice, wetSummer);
  const jun = r.seasons.find((s) => s.season_index === 0) as SeasonWindow;
  const calm: SeasonWindow = { ...jun, status: "already-good", yours: { ...jun.yours, stress_months: [], heat_months: [] } };
  const good = seasonCompare(calm, ctx(twoRice));
  assert.equal(good.headline.text, "Your timing is already good ✓");
  assert.equal(good.tone, "good");
  const dry: SeasonWindow = { ...calm, yours: { ...calm.yours, stress_months: [7, 8, 9] } };
  const c = seasonCompare(dry, ctx(twoRice));
  assert.equal(c.headline.text, "No better month found, but plan for the risks");
  assert.notEqual(c.tone, "good");
  assert.match(c.detail?.text ?? "", /Your months still have dry stress in Jul, Aug and Sep: plan for them with your agricultural technician\.$/);
});
