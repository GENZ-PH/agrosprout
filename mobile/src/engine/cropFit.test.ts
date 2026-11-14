/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Crop, LotData, LotDetails } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { cropFit, type CropFitInput } from "./cropFit";

const lib = CROP_LIBRARY_FIXTURE;
const crop = (id: string): Crop => {
  const c = lib.crops.find((x) => x.id === id);
  if (!c) throw new Error(`fixture crop ${id} missing`);
  return c;
};
const flat = (v: number) => Array.from({ length: 12 }, () => v);
const details: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };

/** Synthetic lot climate for unit tests (not real data). */
function climate(o: { rain?: number; tmax?: number; tmin?: number; wet?: number } = {}): Pick<LotData, "monthly"> {
  const rain = o.rain ?? 1000;
  return {
    monthly: {
      precip_mm: { p20: flat(rain), p50: flat(rain), p80: flat(rain) },
      et0_mm: flat(100),
      tmax_c: flat(o.tmax ?? 31),
      tmin_c: flat(o.tmin ?? 23), // mean 27 °C: inside every fixture crop's optimal range
      rootzone_wetness: flat(o.wet ?? 0.5),
      rh2m_pct: null,
      ws2m_ms: null,
      solar_mj_m2_day: null,
      heat_days_gt35: null,
      heavy_rain_days_gt50mm: null,
      smap_rootzone_m3m3: null,
    },
  };
}
const input = (id: string, data: Pick<LotData, "monthly">, months?: [number, number]): CropFitInput => ({
  crop: crop(id),
  lotCrop: { crop_id: id, seasons: months ? [{ plant_month: months[0], harvest_month: months[1] }] : [] },
  details,
  data,
  library: lib,
});

test("plenty of rain and an optimal temperature gives Good fit", () => {
  const fit = cropFit(input("corn", climate(), [6, 9]));
  assert.equal(fit.level, "good");
  assert.deepEqual(fit.reasons, []);
  assert.equal(fit.assumed_calendar, false);
});

test("no rain gives Poor fit with water as the main reason", () => {
  const fit = cropFit(input("corn", climate({ rain: 0 }), [6, 9]));
  assert.equal(fit.level, "poor");
  assert.equal(fit.reasons[0].code, "water");
  assert.equal(fit.reasons[0].value, 1);
});

test("monthly mean temperature above the Ecocrop maximum gives Poor fit", () => {
  const fit = cropFit(input("lowland-rice", climate({ tmax: 44, tmin: 34 }), [6, 10])); // mean 39 > 38
  assert.equal(fit.level, "poor");
  assert.equal(fit.reasons[0].code, "too-hot");
  assert.equal(fit.reasons[0].limit, crop("lowland-rice").temp_c!.max);
});

test("below the optimal range is Watch out, not Poor", () => {
  const fit = cropFit(input("lowland-rice", climate({ tmax: 27, tmin: 19 }), [6, 10])); // mean 23 < 25
  assert.equal(fit.level, "watch");
  assert.equal(fit.reasons[0].code, "cool");
});

test("a crop with low waterlogging tolerance gets Watch out in very wet months", () => {
  assert.equal(crop("mungbean").waterlogging_tolerance, "low");
  const fit = cropFit(input("mungbean", climate({ wet: 0.95 }), [7, 9]));
  assert.equal(fit.level, "watch");
  assert.equal(fit.reasons[0].code, "waterlogging");
  // Lowland rice tolerates it.
  assert.equal(cropFit(input("lowland-rice", climate({ wet: 0.95 }), [6, 10])).level, "good");
});

test("no farmer months: uses the typical calendar and marks it assumed", () => {
  const fit = cropFit(input("lowland-rice", climate()));
  assert.equal(fit.assumed_calendar, true);
  assert.equal(fit.seasons.length, crop("lowland-rice").typical_calendar.length);
});

test("no months and no typical calendar, or no Kc data, gives unknown (never a guess)", () => {
  const noCal = cropFit({ ...input("corn", climate()), crop: { ...crop("corn"), typical_calendar: [] } });
  assert.equal(noCal.level, "unknown");
  assert.equal(noCal.reasons[0].code, "no-months");
  const noKc = cropFit({ ...input("corn", climate(), [6, 9]), crop: { ...crop("corn"), kc: null } });
  assert.equal(noKc.level, "unknown");
  assert.equal(noKc.reasons[0].code, "no-crop-data");
});

test("at most two reasons, worst first", () => {
  const fit = cropFit(input("mungbean", climate({ rain: 0, wet: 0.95, tmax: 27, tmin: 15 }), [7, 9]));
  assert.ok(fit.reasons.length <= 2);
  assert.equal(fit.reasons[0].level, "poor");
});

test("runs on the real Iligan fixture for every fixture crop", () => {
  for (const c of lib.crops) {
    const fit = cropFit(input(c.id, { monthly: ILIGAN_LOT_FIXTURE.monthly }));
    assert.ok(["good", "watch", "poor", "unknown"].includes(fit.level), c.id);
    for (const s of fit.seasons) {
      const p50 = s.water?.p50;
      assert.ok(p50?.ok, `${c.id}: water balance computed`);
      if (p50?.ok) assert.ok(Number.isFinite(p50.result.wsi));
    }
  }
});
