/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import type { CropAccess } from "../engine/access";
import type { HarvestLeg } from "../engine/analyze";
import type { Destination, Travel } from "../types";
import { cropTrip, placeRows, tripsLine } from "./harvest-card-core";

const market: Destination = {
  id: "d1",
  name: "Poblacion market",
  type: "market",
  point: [124.2, 8.2],
  mode: "motorcycle",
  load_kg_per_trip: null,
  fare_one_way: null,
};
const store: Destination = { ...market, id: "d2", name: "Bodega", type: "storage" };

const access = (over: Partial<CropAccess>): CropAccess => ({
  crop_id: "tomato",
  score: 100,
  gap: null,
  perishability: "high",
  destination_id: "d1",
  destination_type: "market",
  minutes: 30,
  source: "route",
  source_label: "road route",
  confidence: "medium",
  ask_to_confirm: false,
  via_storage: false,
  sale_minutes: 30,
  ok_minutes: 60,
  max_minutes: 180,
  ...over,
});

const name = (id: string) => (id === "d1" ? "Poblacion market" : "Bodega");

test("each place shows its kind, the time from this lot and how the time was found; the farmer's time wins", () => {
  const travel: Travel[] = [
    { destination_id: "d1", distance_km: 12, minutes: 25, source: "route", route_profile: "car" },
    { destination_id: "d1", distance_km: null, minutes: 40, source: "farmer", route_profile: null },
    { destination_id: "d2", distance_km: 3, minutes: 70, source: "estimate", route_profile: null },
  ];
  const rows = placeRows([market, store, { ...market, id: "d3", name: "Buyer" }], travel);
  assert.deepEqual(
    rows.map((r) => [r.name, r.time, r.source, r.check]),
    [
      ["Poblacion market", "about 40 min one way", "your time", false],
      ["Bodega", "about 1 h 10 min one way", "rough estimate", true],
      ["Buyer", null, null, false],
    ],
  );
  assert.match(rows[0].kind, /^Market · Motorcycle/);
  // A place named after its type ("Market", "Market 2") doesn't repeat the type.
  assert.match(placeRows([{ ...market, name: "Market 2" }], [])[0].kind, /^Motorcycle/);
});

test("a crop suits the trip within its time, the trip is long after that, and too far past the limit", () => {
  assert.equal(cropTrip(access({ minutes: 60 }), name).level, "good");
  assert.equal(cropTrip(access({ minutes: 60 }), name).line, "Spoils fast: 1 h to Poblacion market is fine.");
  const long = cropTrip(access({ minutes: 70 }), name);
  assert.equal(long.level, "watch");
  assert.match(long.line, /is long\. Best within 1 h \(assumed\)\.$/);
  const far = cropTrip(access({ minutes: 180 }), name);
  assert.equal(far.level, "far");
  assert.match(far.line, /limit 3 h, assumed/);
});

test("a crop with no score says why instead of guessing", () => {
  assert.equal(cropTrip(access({ gap: "perishability-unknown", perishability: null, score: null }), name).level, "unknown");
  assert.match(cropTrip(access({ gap: "no-sale-point", score: null, minutes: null }), name).line, /Add a market, buyer or co-op/);
  assert.equal(
    cropTrip(access({ gap: "travel-pending", score: null, minutes: null, destination_id: null }), name).line,
    "Waiting for the travel time.",
  );
});

test("trips per harvest are shown only when the engine could count them, and say when the load is assumed", () => {
  const leg: HarvestLeg = {
    crop_id: "rice",
    destination_id: "d1",
    trips: { harvest_kg: 4530, load_kg: 150, load_source: "assumed", trips: 31, gap: null },
    one_way_minutes: 25,
    travel_source: "route",
    hours: 25.83,
  };
  assert.equal(
    tripsLine(leg, 25),
    "About 31 trips per harvest at a typical yield (150 kg each, assumed load), about 25 h 50 min on the road.",
  );
  assert.match(tripsLine({ ...leg, one_way_minutes: 30 }, 25) ?? "", /Heavy rain in the harvest month may slow the roads/);
  assert.match(tripsLine({ ...leg, trips: { ...leg.trips, load_source: "farmer", trips: 1 } }, 25) ?? "", /^About 1 trip per harvest .*your load/);
  assert.equal(tripsLine({ ...leg, trips: { ...leg.trips, trips: null, gap: "no-yield" } }, 25), null);
  assert.equal(tripsLine(undefined, 25), null);
});
