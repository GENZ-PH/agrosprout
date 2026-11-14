/// <reference types="node" />
// Harvest trips and wet-season roads (#44, docs/07 §3c).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LotData } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { HEAVY_RAIN_MONTH_MM, LOAD_KG_PER_TRIP, WET_ROAD_FACTOR } from "./params";
import { harvestMonthMinutes, tripHours, tripsPerHarvest, wetRoad } from "./harvestTrips";
import { plantingWindow } from "./plantingWindow";

const flat = (v: number) => Array.from({ length: 12 }, () => v);
const rain = (v: number[]): Pick<LotData["monthly"], "precip_mm"> => ({ precip_mm: { p20: v, p50: v, p80: v } });
const crop = (y: number | null) => ({ yield_t_per_ha: y });
const dest = (mode: "truck" | "motorcycle" | "walk", load: number | null = null) => ({ mode, load_kg_per_trip: load });

test("trips = ceil(yield x area x 1000 / load), checked by hand", () => {
  // 4.5 t/ha x 2 ha = 9,000 kg. Truck 3,000 kg -> exactly 3 trips. Motorcycle 100 kg -> 90 trips.
  const t = tripsPerHarvest({ crop: crop(4.5), lot: { area_ha: 2 }, destination: dest("truck") });
  assert.equal(t.harvest_kg, 9000);
  assert.equal(t.load_kg, LOAD_KG_PER_TRIP.truck);
  assert.equal(t.load_source, "assumed");
  assert.equal(t.trips, Math.ceil(9000 / LOAD_KG_PER_TRIP.truck));
  // 9,066 kg on a 100 kg load is 90.66 trips, which rounds UP to 91 (a partial load is still a trip).
  const m = tripsPerHarvest({ crop: crop(4.533), lot: { area_ha: 2 }, destination: dest("motorcycle") });
  assert.equal(Math.round(m.harvest_kg as number), 9066);
  assert.equal(m.trips, 91);
  // 9,030 kg on a 100 kg load is 90.3 trips: ordinary rounding would give 90, but 91 trips are needed.
  assert.equal(tripsPerHarvest({ crop: crop(4.515), lot: { area_ha: 2 }, destination: dest("motorcycle") }).trips, 91);
});

test("the farmer's own load per trip overrides the default", () => {
  const t = tripsPerHarvest({ crop: crop(4.5), lot: { area_ha: 2 }, destination: dest("truck", 500) });
  assert.equal(t.load_kg, 500);
  assert.equal(t.load_source, "farmer");
  assert.equal(t.trips, 18); // 9,000 / 500
});

test("missing yield, area or a non-positive farmer load gives null trips with the reason, never a guess", () => {
  assert.deepEqual(tripsPerHarvest({ crop: crop(null), lot: { area_ha: 2 }, destination: dest("truck") }).gap, "no-yield");
  assert.equal(tripsPerHarvest({ crop: crop(null), lot: { area_ha: 2 }, destination: dest("truck") }).trips, null);
  assert.equal(tripsPerHarvest({ crop: crop(4), lot: { area_ha: 0 }, destination: dest("truck") }).gap, "no-area");
  // a 0 or negative load from the farmer is ignored and the assumed default is used
  const t = tripsPerHarvest({ crop: crop(4), lot: { area_ha: 1 }, destination: dest("truck", 0) });
  assert.equal(t.load_source, "assumed");
});

test("hours on the road = trips x 2 x one-way minutes / 60", () => {
  assert.equal(tripHours(4, 45), 6); // 4 x 2 x 45 = 360 min
  assert.ok(Math.abs(tripHours(3, 40) - 4) < 1e-12);
});

test("a month is wet only when typical-year rain is strictly above the threshold", () => {
  const r = rain(flat(100));
  const at = [...flat(100)];
  at[5] = HEAVY_RAIN_MONTH_MM;
  at[6] = HEAVY_RAIN_MONTH_MM + 1;
  const w = rain(at);
  assert.equal(wetRoad(6, w).wet, false); // exactly at the threshold
  assert.equal(wetRoad(7, w).wet, true);
  assert.equal(wetRoad(7, w).factor, WET_ROAD_FACTOR);
  assert.equal(wetRoad(1, r).factor, 1);
  const missing = rain(flat(0));
  (missing.precip_mm.p50 as (number | null)[])[2] = null;
  assert.deepEqual(wetRoad(3, missing), { wet: false, factor: 1, rain_mm: null });
});

test("harvest-month travel time is multiplied by the wet-road factor only in a wet month", () => {
  const at = flat(100);
  at[8] = HEAVY_RAIN_MONTH_MM + 50;
  const w = rain(at);
  assert.equal(harvestMonthMinutes(40, 9, w), 40 * WET_ROAD_FACTOR);
  assert.equal(harvestMonthMinutes(40, 2, w), 40);
});

test("the planting-window scan flags a wet harvest month (information only)", () => {
  const lib = CROP_LIBRARY_FIXTURE;
  const wet = Array.from({ length: 12 }, (_, i) => (i === 9 ? HEAVY_RAIN_MONTH_MM + 100 : 150));
  const monthly: LotData["monthly"] = {
    precip_mm: { p20: wet, p50: wet, p80: wet },
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
  };
  const r = plantingWindow({
    lot: { crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] }], details: { land_type: "lowland", water: "rain", soil: "loamy" } },
    data: { monthly },
    library: lib,
  });
  const s = r.seasons[0];
  assert.equal(s.yours.harvest_road_wet, s.yours.harvest_month === 10);
  assert.equal(s.yours.harvest_month, 10);
  assert.equal(s.yours.harvest_road_wet, true);
});
