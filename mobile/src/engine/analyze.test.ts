/// <reference types="node" />
// analyzeLot (#29, #34): one call from a stored farm to everything a lot's screens show.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CropLibrary, Destination, Lot, LotCrop, LotData, LotDetails } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { analyzeLot, type AnalyzeLotInput } from "./analyze";

const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const data: LotData = ILIGAN_LOT_FIXTURE;
const equalPriorities = { water: 50, soil: 50, income: 50, labor: 50 };
const market: Destination = {
  id: "d1",
  name: "Town market",
  type: "market",
  point: [124.25, 8.25],
  mode: "tricycle",
  load_kg_per_trip: null,
  fare_one_way: null,
};

function lot(crops: LotCrop[], extra: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    name: "Lot 1",
    geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
    area_ha: 2,
    centroid: [124.2405, 8.2303],
    details: lowland,
    crops,
    data_status: "ready",
    data_ref: "lotdata:lot-1",
    travel: [],
    ...extra,
  };
}

const rice = (...seasons: LotCrop["seasons"]): LotCrop => ({ crop_id: "lowland-rice", seasons });
const run = (l: Lot, over: Partial<AnalyzeLotInput> = {}) =>
  analyzeLot({ farm: { destinations: [], priorities: equalPriorities }, lot: l, data, library: CROP_LIBRARY_FIXTURE, ...over });

test("stage 1: no months given. Options use the typical calendar, and planting windows say which crops lack months", () => {
  const a = run(lot([rice(), { crop_id: "mungbean", seasons: [] }]));
  assert.equal(a.stage, 1);
  assert.equal(a.lot_id, "lot-1");
  assert.equal(a.scenario, null);
  assert.equal(a.crop_fits.length, 2);
  assert.ok(a.crop_fits.every((f) => f.assumed_calendar));
  assert.equal(a.rotations.options[0].key, "A");
  assert.equal(a.explanations.length, a.rotations.options.length);
  assert.deepEqual(a.explanations.map((e) => e.option_key), a.rotations.options.map((o) => o.key));
  assert.equal(a.soil_health.options.length, a.rotations.options.length);
  assert.equal(a.planting.seasons.length, 0);
  assert.deepEqual(a.planting.gaps.map((g) => g.code).sort(), ["no-months", "no-months"]);
  assert.equal(a.access.on, false);
  assert.deepEqual(a.harvest, []);
  assert.deepEqual(a.gaps, []);
  assert.equal(a.monthly, data.monthly);
});

test("stage 2: months given. Planting windows are scanned for each season", () => {
  const a = run(lot([rice({ plant_month: 6, harvest_month: 10 }, { plant_month: 11, harvest_month: 3 })]));
  assert.equal(a.stage, 2);
  assert.equal(a.planting.seasons.length, 2);
  assert.ok(a.crop_fits.every((f) => !f.assumed_calendar));
  // The blocked case (#89) comes through the facade.
  assert.deepEqual(a.planting.seasons.map((s) => s.status), ["already-good", "blocked"]);
});

test("a place with a travel time turns market access on and gives trips per harvest", () => {
  const library: CropLibrary = {
    ...CROP_LIBRARY_FIXTURE,
    crops: CROP_LIBRARY_FIXTURE.crops.map((c) => (c.id === "lowland-rice" ? { ...c, yield_t_per_ha: 4.5, perishability: "low" as const } : c)),
  };
  const l = lot([rice({ plant_month: 6, harvest_month: 10 })], {
    travel: [
      { destination_id: "d1", distance_km: 6, minutes: 30, source: "estimate", route_profile: null },
      { destination_id: "d1", distance_km: null, minutes: 20, source: "farmer", route_profile: null },
    ],
  });
  const a = run(l, { library, farm: { destinations: [market], priorities: equalPriorities } });
  assert.equal(a.access.on, true);
  assert.ok(typeof a.rotations.options[0].scores.M === "number", "M is scored once a place has a travel time");
  assert.equal(a.harvest.length, 1);
  const leg = a.harvest[0];
  assert.equal(leg.crop_id, "lowland-rice");
  assert.equal(leg.travel_source, "farmer"); // the farmer's own time wins
  assert.ok(leg.trips.trips !== null && leg.trips.trips > 0);
  assert.equal(leg.trips.load_source, "assumed");
  assert.ok(leg.one_way_minutes !== null && leg.one_way_minutes >= 20);
  assert.ok(leg.hours !== null && leg.hours > 0);
});

test("a place with no travel time yet gives the trips but no minutes and no hours, never a guess", () => {
  const a = run(lot([rice({ plant_month: 6, harvest_month: 10 })]), { farm: { destinations: [market], priorities: equalPriorities } });
  assert.equal(a.harvest[0].one_way_minutes, null);
  assert.equal(a.harvest[0].hours, null);
  assert.equal(a.harvest[0].travel_source, null);
  assert.deepEqual(a.access.pending_destination_ids, ["d1"]);
});

test("a drier what-if scenario lowers water fit, is labeled, and does not change the input", () => {
  const l = lot([rice({ plant_month: 6, harvest_month: 10 })]);
  const before = JSON.stringify(data);
  const base = run(l);
  const dry = run(l, { scenario: { rain_pct: -30, temp_c: 2 } });
  assert.ok(dry.scenario && dry.scenario.notes.length > 0);
  assert.notEqual(dry.monthly, data.monthly);
  assert.equal(dry.monthly, dry.scenario.monthly);
  const w = (x: typeof base) => x.rotations.options[0].scores.W as number;
  assert.ok(w(dry) < w(base), `W ${w(dry)} vs ${w(base)}`);
  assert.equal(JSON.stringify(data), before);
});

test("an out-of-range scenario is rejected, like applyScenario", () => {
  assert.throws(() => run(lot([rice()]), { scenario: { rain_pct: -80, temp_c: 0 } }), RangeError);
});

test("an unknown crop id is a gap, not a crash, and no crops is a gap too", () => {
  const a = run(lot([rice(), { crop_id: "dragonfruit", seasons: [] }]));
  assert.deepEqual(a.gaps, [{ code: "unknown-crop", crop_id: "dragonfruit" }]);
  assert.equal(a.crop_fits.length, 1);
  const none = run(lot([]));
  assert.deepEqual(none.gaps, [{ code: "no-crops" }]);
  assert.equal(none.stage, 1);
});

test("changing a priority slider changes the ranking inputs, and the result is deterministic", () => {
  const l = lot([rice()]);
  const a1 = run(l);
  const a2 = run(l);
  assert.deepEqual(a1, a2);
  const waterOnly = run(l, { farm: { destinations: [], priorities: { water: 100, soil: 0, income: 0, labor: 0 } } });
  assert.notDeepEqual(waterOnly.rotations.weights, a1.rotations.weights);
});
