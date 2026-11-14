/// <reference types="node" />
// Market access and layered travel time (#27, docs/07 §3c and §7 checks).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Crop, Destination, Level, LonLat, LotDetails, Travel, TransportMode } from "../types";
import { haversineKm, resolveTravel, type RouteFetcher } from "../data/routing";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { accessScore, marketAccess, pickTravel, travelAssumptionsFor, TRAVEL_SOURCE_INFO } from "./access";
import {
  ACCESS_FLOOR,
  ACCESS_MINUTES,
  ROAD_CIRCUITY,
  TRAVEL_SPEED_KMH,
  TRAVEL_WAIT_MIN,
} from "./params";
import { rotations } from "./rotations";

const lib = CROP_LIBRARY_FIXTURE;
const fixtureCrop = (id: string): Crop => {
  const c = lib.crops.find((x) => x.id === id);
  if (!c) throw new Error(`fixture crop ${id} missing`);
  return c;
};
const rice = fixtureCrop("lowland-rice"); // perishability "low" in the cited draft
/** Synthetic crop for unit tests (not real data): rice with another perishability. */
const withPerishability = (p: Level | null): Crop => ({ ...rice, id: `test-${p ?? "unknown"}`, perishability: p });
const high = withPerishability("high");
const medium = withPerishability("medium");
const low = withPerishability("low");

const MODES: TransportMode[] = ["walk", "carabao", "bicycle", "motorcycle", "tricycle", "jeepney", "truck"];
const LOT: LonLat = [124.24, 8.23];
const place = (id: string, type: Destination["type"], mode: TransportMode = "tricycle"): Destination => ({
  id,
  name: id,
  type,
  point: [124.3, 8.28],
  mode,
  load_kg_per_trip: null,
  fare_one_way: null,
});
const trip = (destination_id: string, minutes: number, source: Travel["source"] = "route"): Travel => ({
  destination_id,
  distance_km: source === "farmer" ? null : 10,
  minutes,
  source,
  route_profile: source === "route" ? "car" : null,
});

// --- Travel-time source (D18) ------------------------------------------------

test("a farmer-entered time always overrides the route and the estimate (07 §7)", () => {
  // The farmer's time is the LONGEST here, so it must win on source, not on speed.
  const entries = [trip("m", 30, "route"), trip("m", 20, "estimate"), trip("m", 200, "farmer")];
  for (const order of [entries, [...entries].reverse()]) {
    assert.equal(pickTravel(order, "m")?.source, "farmer");
    const r = marketAccess({ crops: [low], destinations: [place("m", "market")], travel: order });
    const a = r.by_crop[low.id];
    assert.equal(a.minutes, 200);
    assert.equal(a.source, "farmer");
    assert.equal(a.source_label, "your time");
    assert.equal(a.confidence, "high");
    assert.equal(a.ask_to_confirm, false);
  }
});

test("without a farmer time: road route beats the rough estimate, which asks the farmer to confirm", () => {
  assert.equal(pickTravel([trip("m", 90, "estimate"), trip("m", 40, "route")], "m")?.source, "route");
  const est = marketAccess({ crops: [low], destinations: [place("m", "market")], travel: [trip("m", 90, "estimate")] });
  const a = est.by_crop[low.id];
  assert.deepEqual([a.source_label, a.confidence, a.ask_to_confirm], ["rough estimate", "low", true]);
  assert.deepEqual(TRAVEL_SOURCE_INFO.route, { label: "road route", confidence: "medium", ask_to_confirm: false });
});

test("entries with a missing or negative time are ignored", () => {
  const bad = [trip("m", Number.NaN, "farmer"), trip("m", -5, "farmer"), trip("m", 45, "route")];
  assert.equal(pickTravel(bad, "m")?.minutes, 45);
  assert.equal(pickTravel(bad, "other"), null);
});

test("end to end with routing.ts: offline estimate uses the params assumptions, then the farmer's time wins", async () => {
  const offline: RouteFetcher = async () => {
    throw new TypeError("Network request failed");
  };
  const d = place("m", "market", "walk");
  const est = await resolveTravel({ lotCentroid: LOT, destination: d, assumptions: travelAssumptionsFor("walk"), fetcher: offline });
  const km = haversineKm(LOT, d.point) * ROAD_CIRCUITY.foot;
  assert.equal(est.travel.source, "estimate");
  assert.ok(Math.abs(est.travel.minutes - (km / TRAVEL_SPEED_KMH.walk) * 60) < 1e-9);

  const mine = await resolveTravel({
    lotCentroid: LOT,
    destination: d,
    assumptions: travelAssumptionsFor("walk"),
    farmerMinutes: 25,
    cached: est.travel,
    fetcher: offline,
  });
  const r = marketAccess({ crops: [high], destinations: [d], travel: [est.travel, mine.travel] });
  assert.equal(r.by_crop[high.id].minutes, 25);
  assert.equal(r.by_crop[high.id].source_label, "your time");
});

test("travel assumptions per mode: circuity of the mode's routing profile, waiting time for jeepney", () => {
  assert.equal(travelAssumptionsFor("walk").circuity, ROAD_CIRCUITY.foot);
  assert.equal(travelAssumptionsFor("carabao").circuity, ROAD_CIRCUITY.foot);
  assert.equal(travelAssumptionsFor("bicycle").circuity, ROAD_CIRCUITY.bike);
  assert.equal(travelAssumptionsFor("truck").circuity, ROAD_CIRCUITY.car);
  assert.equal(travelAssumptionsFor("jeepney").waitMin.jeepney, TRAVEL_WAIT_MIN.jeepney);
  // A copy, so a caller cannot change params.ts by mutating it.
  travelAssumptionsFor("walk").speedKmh.walk = 999;
  assert.notEqual(TRAVEL_SPEED_KMH.walk, 999);
});

test("travel assumptions are usable: every mode has a positive speed, circuity >= 1, waits >= 0", () => {
  for (const m of MODES) assert.ok(TRAVEL_SPEED_KMH[m] > 0, m);
  for (const c of Object.values(ROAD_CIRCUITY)) assert.ok(c >= 1);
  for (const w of Object.values(TRAVEL_WAIT_MIN)) assert.ok((w ?? 0) >= 0);
});

// --- Market access score (07 §3c) --------------------------------------------

test("a highly perishable crop gets a lower M than a storable crop at the same travel time (07 §7)", () => {
  const t = (ACCESS_MINUTES.high.ok + ACCESS_MINUTES.high.max) / 2;
  const r = marketAccess({ crops: [high, medium, low], destinations: [place("m", "market")], travel: [trip("m", t)] });
  const [h, m, l] = [high, medium, low].map((c) => r.by_crop[c.id].score!);
  assert.ok(h < m && m <= l, `high ${h}, medium ${m}, low ${l}`);
  assert.ok(h < l);
});

test("M is 100 up to the ok time, falls linearly, and stops at the floor from the max time", () => {
  assert.ok(ACCESS_FLOOR >= 0 && ACCESS_FLOOR < 100);
  for (const p of ["high", "medium", "low"] as const) {
    const { ok, max } = ACCESS_MINUTES[p];
    assert.ok(ok < max, p);
    assert.equal(accessScore(0, p), 100);
    assert.equal(accessScore(ok, p), 100);
    assert.ok(Math.abs(accessScore((ok + max) / 2, p) - (100 + ACCESS_FLOOR) / 2) < 1e-9, p);
    assert.equal(accessScore(max, p), ACCESS_FLOOR);
    assert.equal(accessScore(max * 3, p), ACCESS_FLOOR);
    assert.ok(accessScore(ok + 1, p) < 100 && accessScore(max - 1, p) > ACCESS_FLOOR);
  }
  // More perishable = shorter limits, so M never rises with perishability.
  assert.ok(ACCESS_MINUTES.high.ok <= ACCESS_MINUTES.medium.ok && ACCESS_MINUTES.medium.ok <= ACCESS_MINUTES.low.ok);
  assert.ok(ACCESS_MINUTES.high.max <= ACCESS_MINUTES.medium.max && ACCESS_MINUTES.medium.max <= ACCESS_MINUTES.low.max);
  assert.throws(() => accessScore(Number.NaN, "low"), RangeError);
  assert.throws(() => accessScore(-1, "low"), RangeError);
});

test("best destination: the nearest market, buyer or co-op", () => {
  const r = marketAccess({
    crops: [high],
    destinations: [place("far", "market"), place("buyer", "buyer"), place("coop", "coop")],
    travel: [trip("far", 300), trip("buyer", 50), trip("coop", 70)],
  });
  const a = r.by_crop[high.id];
  assert.equal(a.destination_id, "buyer");
  assert.equal(a.score, 100);
  assert.equal(a.sale_minutes, 50);
});

test("storage bonus: a near storage keeps M high for low/medium perishability crops, not for perishable ones", () => {
  const far = ACCESS_MINUTES.low.max + 60;
  const near = ACCESS_MINUTES.high.ok / 2;
  const r = marketAccess({
    crops: [high, medium, low],
    destinations: [place("market", "market"), place("store", "storage")],
    travel: [trip("market", far), trip("store", near)],
  });
  for (const c of [medium, low]) {
    const a = r.by_crop[c.id];
    assert.equal(a.score, 100, c.id);
    assert.equal(a.via_storage, true);
    assert.equal(a.destination_type, "storage");
    assert.equal(a.sale_minutes, far, "the far market time stays available for the explanation");
  }
  const h = r.by_crop[high.id];
  assert.equal(h.destination_id, "market");
  assert.equal(h.via_storage, false);
  assert.equal(h.score, ACCESS_FLOOR);
});

test("only a storage place: storable crops are scored, a perishable crop is not (no sale point, never guessed)", () => {
  const r = marketAccess({ crops: [high, low], destinations: [place("store", "storage")], travel: [trip("store", 30)] });
  assert.equal(r.by_crop[low.id].score, 100);
  assert.equal(r.by_crop[high.id].score, null);
  assert.equal(r.by_crop[high.id].gap, "no-sale-point");
  assert.equal(r.scores?.[high.id], null);
});

test("unknown perishability is not guessed", () => {
  const unknown = withPerishability(null);
  const r = marketAccess({ crops: [unknown], destinations: [place("m", "market")], travel: [trip("m", 10)] });
  assert.equal(r.by_crop[unknown.id].score, null);
  assert.equal(r.by_crop[unknown.id].gap, "perishability-unknown");
});

test("destinations without a travel time yet are reported as pending", () => {
  const r = marketAccess({
    crops: [low],
    destinations: [place("m", "market"), place("b", "buyer")],
    travel: [trip("b", 40)],
  });
  assert.deepEqual(r.pending_destination_ids, ["m"]);
  assert.equal(r.by_crop[low.id].destination_id, "b");
  const none = marketAccess({ crops: [low], destinations: [place("m", "market")], travel: [] });
  assert.equal(none.by_crop[low.id].gap, "travel-pending");
  assert.equal(none.by_crop[low.id].score, null);
});

// --- M in the rotation scores (#26 hook) -------------------------------------

test("no destination yet: M is off and left out of every option (D20)", () => {
  const r = marketAccess({ crops: lib.crops, destinations: [], travel: [] });
  assert.equal(r.on, false);
  assert.equal(r.scores, null);
});

test("marketAccess output feeds rotations: M on the real Iligan fixture is the mean over each option's crops", () => {
  const details: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
  const access = marketAccess({ crops: lib.crops, destinations: [place("m", "market")], travel: [trip("m", 240)] });
  const r = rotations({
    lot: { crops: [{ crop_id: "lowland-rice", seasons: [] }], details },
    data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
    library: lib,
    priorities: { water: 50, soil: 50, income: 50, labor: 50 },
    marketAccess: access.scores,
  });
  assert.ok(!r.components_left_out.includes("M"));
  for (const o of r.options) {
    const mean = o.slots.reduce((a, s) => a + access.scores![s.crop_id]!, 0) / o.slots.length;
    assert.ok(Math.abs(o.scores.M! - mean) < 1e-9, o.key);
  }
});
