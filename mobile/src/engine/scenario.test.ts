/// <reference types="node" />
// What-if climate scenario (#47).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LotCrop, LotDetails } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { rotations } from "./rotations";
import { applyScenario } from "./scenario";

const lib = CROP_LIBRARY_FIXTURE;
const lot = ILIGAN_LOT_FIXTURE;
const details: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, v) => a + (v ?? 0), 0);
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

function waterFitOfA(monthly: typeof lot.monthly, cropId: string, plant: number): number {
  const crops: LotCrop[] = [{ crop_id: cropId, seasons: [{ plant_month: plant, harvest_month: plant + 4 > 12 ? plant - 8 : plant + 4 }] }];
  const r = rotations({ lot: { crops, details }, data: { monthly }, library: lib, priorities: { water: 50, soil: 50, income: 50, labor: 50 } });
  return r.options[0].scores.W as number;
}

test("rainfall is scaled for P20, P50 and P80; temperature rises for tmax and tmin", () => {
  const r = applyScenario(lot, { rain_pct: -30, temp_c: 2 });
  for (const sc of ["p20", "p50", "p80"] as const) {
    lot.monthly.precip_mm[sc].forEach((v, i) => assert.ok(near(r.monthly.precip_mm[sc][i] as number, (v as number) * 0.7)));
  }
  lot.monthly.tmax_c.forEach((v, i) => assert.ok(near(r.monthly.tmax_c[i] as number, (v as number) + 2)));
  lot.monthly.tmin_c.forEach((v, i) => assert.ok(near(r.monthly.tmin_c[i] as number, (v as number) + 2)));
});

test("a scenario of 0 / 0 leaves the climate and ET0 exactly as they were", () => {
  const r = applyScenario(lot, { rain_pct: 0, temp_c: 0 });
  assert.deepEqual(r.monthly, lot.monthly);
  assert.deepEqual(r.notes, []);
});

test("a warmer climate raises ET0 each month by a modest, consistent amount; rain alone leaves ET0 unchanged", () => {
  const warm = applyScenario(lot, { rain_pct: 0, temp_c: 2 });
  assert.equal(warm.et0_recomputed, true);
  lot.monthly.et0_mm.forEach((v, i) => assert.ok((warm.monthly.et0_mm[i] as number) > (v as number)));
  const rise = sum(warm.monthly.et0_mm) / sum(lot.monthly.et0_mm) - 1;
  assert.ok(rise > 0.01 && rise < 0.15, `annual ET0 rise ${rise}`);
  const warmer = applyScenario(lot, { rain_pct: 0, temp_c: 1 });
  assert.ok(sum(warmer.monthly.et0_mm) < sum(warm.monthly.et0_mm), "+1 C is less than +2 C");
  const dry = applyScenario(lot, { rain_pct: -30, temp_c: 0 });
  assert.deepEqual(dry.monthly.et0_mm, lot.monthly.et0_mm);
});

test("acceptance: a drier scenario lowers water fit more for rice than for mungbean", () => {
  const dry = applyScenario(lot, { rain_pct: -30, temp_c: 0 }).monthly;
  const drop = (crop: string, plant: number) => waterFitOfA(lot.monthly, crop, plant) - waterFitOfA(dry, crop, plant);
  const rice = drop("lowland-rice", 6);
  const mung = drop("mungbean", 6);
  assert.ok(rice > 0, `rice drop ${rice}`);
  assert.ok(rice > mung, `rice drop ${rice} should exceed mungbean drop ${mung}`);
});

test("a wetter scenario never lowers water fit", () => {
  const wet = applyScenario(lot, { rain_pct: 20, temp_c: 0 }).monthly;
  for (const [crop, plant] of [["lowland-rice", 6], ["mungbean", 6], ["corn", 5]] as const) {
    assert.ok(waterFitOfA(wet, crop, plant) >= waterFitOfA(lot.monthly, crop, plant) - 1e-9);
  }
});

test("missing humidity leaves ET0 at the baseline and says so", () => {
  const noRh = { ...lot, monthly: { ...lot.monthly, rh2m_pct: null } };
  const r = applyScenario(noRh, { rain_pct: 0, temp_c: 2 });
  assert.equal(r.et0_recomputed, false);
  assert.deepEqual(r.monthly.et0_mm, lot.monthly.et0_mm);
  assert.ok(r.notes.some((n) => n.includes("not changed")));
});

test("values outside the slider ranges are rejected", () => {
  assert.throws(() => applyScenario(lot, { rain_pct: -31, temp_c: 0 }), RangeError);
  assert.throws(() => applyScenario(lot, { rain_pct: 21, temp_c: 0 }), RangeError);
  assert.throws(() => applyScenario(lot, { rain_pct: 0, temp_c: 2.5 }), RangeError);
  assert.throws(() => applyScenario(lot, { rain_pct: 0, temp_c: -1 }), RangeError);
  assert.throws(() => applyScenario(lot, { rain_pct: NaN, temp_c: 0 }), RangeError);
});

test("the label says it is a what-if, not a forecast, and what is held fixed; the input is not changed", () => {
  const before = JSON.stringify(lot.monthly);
  const r = applyScenario(lot, { rain_pct: -10, temp_c: 1 });
  assert.ok(r.notes.some((n) => /not a forecast/.test(n)));
  assert.ok(r.notes.some((n) => /kept at today's values/.test(n)));
  assert.equal(JSON.stringify(lot.monthly), before);
});

test("missing months stay missing", () => {
  const holes = { ...lot, monthly: { ...lot.monthly, precip_mm: { ...lot.monthly.precip_mm, p50: lot.monthly.precip_mm.p50.map((v, i) => (i === 3 ? null : v)) } } };
  const r = applyScenario(holes, { rain_pct: -10, temp_c: 0 });
  assert.equal(r.monthly.precip_mm.p50[3], null);
});
