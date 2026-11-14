/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Crop, LotMonthly } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { kcOnDay, monthSpan, seasonLengthDays, seasonMonths } from "./season";
import { effectiveRain, waterBalance, waterBalanceRange, type WaterBalanceInput } from "./waterBalance";

const lib = CROP_LIBRARY_FIXTURE;
const crop = (id: string): Crop => {
  const c = lib.crops.find((x) => x.id === id);
  if (!c) throw new Error(`fixture crop ${id} missing`);
  return c;
};
const flat = (v: number) => Array.from({ length: 12 }, () => v);
/** Synthetic climate: same rain in every scenario, ET0 100 mm every month. */
const synthetic = (rainMm: number): Pick<LotMonthly, "precip_mm" | "et0_mm"> => ({
  precip_mm: { p20: flat(rainMm), p50: flat(rainMm), p80: flat(rainMm) },
  et0_mm: flat(100),
});
const base = (over: Partial<WaterBalanceInput> = {}): WaterBalanceInput => ({
  crop: crop("corn"),
  plantMonth: 6,
  seasonDays: 95,
  monthly: synthetic(100),
  details: { soil: "loamy", water: "rain" },
  riceDetail: lib.rice_extra_detail,
  scenario: "p50",
  ...over,
});
const ok = (o: ReturnType<typeof waterBalance>) => {
  if (!o.ok) throw new Error(`expected a result, got ${o.reason}`);
  return o.result;
};

test("effectiveRain matches the worked example in Brouwer & Heibloem 1986, §4.2", () => {
  // P (mm/month) -> Pe as printed in the manual (rounded to whole mm).
  const cases: [number, number][] = [[35, 11], [90, 47], [116, 68], [5, 0], [260, 183], [75, 35]];
  for (const [p, pe] of cases) assert.equal(Math.round(effectiveRain(p)), pe, `P = ${p}`);
});

test("effectiveRain at the 75 mm boundary is continuous and never negative", () => {
  assert.equal(effectiveRain(75), 35);
  assert.ok(Math.abs(effectiveRain(75.01) - 35.008) < 1e-9);
  assert.equal(effectiveRain(0), 0);
  assert.equal(effectiveRain(16), 0); // 0.6 x 16 - 10 < 0
});

test("kcOnDay follows FAO-56 Eq. 66 at the stage boundaries", () => {
  const stages = [10, 20, 30, 20] as const;
  const kc = [0.4, 1.2, 0.6] as const;
  assert.equal(kcOnDay(0, stages, kc), 0.4);
  assert.equal(kcOnDay(10, stages, kc), 0.4);
  assert.ok(Math.abs(kcOnDay(20, stages, kc) - 0.8) < 1e-12); // halfway through development
  assert.equal(kcOnDay(30, stages, kc), 1.2);
  assert.equal(kcOnDay(59.9, stages, kc), 1.2);
  assert.ok(Math.abs(kcOnDay(70, stages, kc) - 0.9) < 1e-12); // halfway through late season
  assert.equal(kcOnDay(80, stages, kc), 0.6);
});

test("seasonMonths splits a season across calendar months, wrapping the year", () => {
  const rice = crop("lowland-rice");
  const months = seasonMonths(11, 112, rice.stages_days!, rice.kc!);
  assert.deepEqual(months.map((m) => m.month), [11, 12, 1, 2, 3]);
  assert.equal(months.reduce((a, m) => a + m.days, 0), 112);
  assert.equal(months[0].days, 16); // planted 15 Nov: 15-30 Nov
  for (const m of months) assert.ok(m.kcMean >= 0.6 - 1e-9 && m.kcMean <= 1.2 + 1e-9, `${m.month}: ${m.kcMean}`);
});

test("seasonLengthDays uses the farmer's months only within +/-30% of the crop's season", () => {
  const rice = crop("lowland-rice"); // 112 days
  assert.equal(monthSpan(11, 3), 4);
  assert.deepEqual(seasonLengthDays(rice, { plant_month: 6, harvest_month: 10 }), { days: 122, source: "farmer" });
  assert.deepEqual(seasonLengthDays(rice, { plant_month: 6, harvest_month: 12 }), { days: 112, source: "crop" });
});

test("no rain shortfall gives WSI = 0", () => {
  const r = ok(waterBalance(base({ monthly: synthetic(1000) })));
  assert.equal(r.wsi, 0);
  assert.deepEqual(r.stress_months, []);
});

test("no rain at all gives WSI = 1 (rain only)", () => {
  for (const id of ["corn", "mungbean", "lowland-rice"]) {
    const r = ok(waterBalance(base({ crop: crop(id), seasonDays: 100, monthly: synthetic(0) })));
    assert.equal(r.wsi, 1, id);
    assert.ok(r.stress_months.length > 0, id);
  }
});

test("full irrigation removes the deficit; 'some' covers the assumed share", () => {
  const dry = synthetic(0);
  assert.equal(ok(waterBalance(base({ monthly: dry, details: { soil: "loamy", water: "full" } }))).wsi, 0);
  const some = ok(waterBalance(base({ monthly: dry, details: { soil: "loamy", water: "some" } })));
  assert.ok(Math.abs(some.wsi - 0.5) < 1e-12);
  assert.ok(some.assumptions.includes("irrigation-share-assumed"));
});

test("ponded rice adds land prep, water layer and percolation (FAO Training Manual 3, §4.4)", () => {
  const rice = crop("lowland-rice");
  const d = lib.rice_extra_detail!;
  const r = ok(waterBalance(base({ crop: rice, seasonDays: 112, details: { soil: "clayey", water: "rain" } })));
  const [prep, first, second] = r.months;
  assert.equal(prep.month, 5); // month before a June planting
  assert.equal(prep.crop_days, 0);
  assert.equal(prep.rice_extra_mm, d.land_prep_saturation_mm_once);
  assert.equal(first.month, 6);
  assert.equal(first.rice_extra_mm, d.water_layer_establishment_mm_once + 16 * d.percolation_seepage_mm_per_day.heavy_clay);
  assert.equal(second.rice_extra_mm, 31 * d.percolation_seepage_mm_per_day.heavy_clay); // all of July
  // Sandy soil percolates more than clay, so it needs more water.
  const sandy = ok(waterBalance(base({ crop: rice, seasonDays: 112, details: { soil: "sandy", water: "rain" } })));
  assert.ok(sandy.need_mm > r.need_mm);
});

test("every month's numbers add up (traceable from inputs)", () => {
  const r = ok(waterBalance(base({ crop: crop("lowland-rice"), seasonDays: 112, monthly: ILIGAN_LOT_FIXTURE.monthly })));
  for (const m of r.months) {
    assert.ok(Math.abs(m.need_mm - (m.etc_mm + m.rice_extra_mm)) < 1e-9);
    assert.ok(Math.abs(m.deficit_mm - Math.max(0, m.need_mm - m.peff_mm - m.irrigation_mm)) < 1e-9);
  }
  assert.ok(Math.abs(r.wsi - r.deficit_mm / r.need_mm) < 1e-12);
});

test("dry year (P20) WSI >= typical year (P50) >= wet year (P80) on the Iligan fixture", () => {
  for (const c of lib.crops) {
    for (let plant = 1; plant <= 12; plant++) {
      const range = waterBalanceRange({
        crop: c,
        plantMonth: plant,
        seasonDays: c.season_days!,
        monthly: ILIGAN_LOT_FIXTURE.monthly,
        details: { soil: "loamy", water: "rain" },
        riceDetail: lib.rice_extra_detail,
      });
      const [p20, p50, p80] = [ok(range.p20).wsi, ok(range.p50).wsi, ok(range.p80).wsi];
      assert.ok(p20 >= p50 && p50 >= p80, `${c.id} planted ${plant}: ${p20} / ${p50} / ${p80}`);
      for (const w of [p20, p50, p80]) assert.ok(w >= 0 && w <= 1);
    }
  }
});

test("missing climate months and missing crop data are reported, not guessed", () => {
  const monthly = synthetic(100);
  monthly.et0_mm[6] = null; // July
  const missing = waterBalance(base({ monthly }));
  assert.deepEqual(missing, { ok: false, reason: "missing-climate", missing_months: [7] });
  const noKc = waterBalance(base({ crop: { ...crop("corn"), kc: null } }));
  assert.deepEqual(noKc, { ok: false, reason: "no-crop-water-data" });
});
