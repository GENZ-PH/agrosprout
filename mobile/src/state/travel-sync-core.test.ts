/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { RoutingError, type RouteFetcher } from "../data/routing";
import { TRAVEL_SPEED_KMH, TRAVEL_WAIT_MIN } from "../engine/params";
import type { Travel } from "../types";
import { farmPersistOptions, farmStateCreator, type FarmData, type FarmState, type NewDestination, type NewLot } from "./farm-core";
import { buildPersistOptions, resetHydrationRegistry, whenAllStoresSettled, type RawStorage } from "./persist-core";
import { ROUTING_MIN_INTERVAL_MS, syncTravel, type RouteKeys } from "./travel-sync-core";

function memory() {
  const data = new Map<string, string>();
  const raw: RawStorage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
  return raw;
}
async function setup() {
  const raw = memory();
  resetHydrationRegistry();
  const farm = createStore<FarmState>()(
    persist(farmStateCreator({ removeKey: raw.removeItem }), buildPersistOptions<FarmState, FarmData>("farm", farmPersistOptions, raw)),
  );
  await whenAllStoresSettled();
  const keys: RouteKeys = new Map();
  const waits: number[] = [];
  let clock = 0;
  const deps = (fetcher: RouteFetcher) => ({
    getLots: () => farm.getState().lots,
    getDestinations: () => farm.getState().destinations,
    setTravel: (lotId: string, t: Travel) => farm.getState().setTravel(lotId, t),
    keys,
    fetcher,
    wait: async (ms: number) => void (waits.push(ms), (clock += ms)),
    now: () => clock,
  });
  return { farm, keys, waits, deps };
}
const lot = (lon: number, lat: number): NewLot => ({
  geometry: { type: "Polygon", coordinates: [[[lon, lat], [lon + 0.001, lat], [lon, lat + 0.001], [lon, lat]]] },
  area_ha: 1,
  centroid: [lon, lat],
});
const place = (lon: number, lat: number, mode: NewDestination["mode"] = "motorcycle"): NewDestination => ({
  name: "Market",
  type: "market",
  point: [lon, lat],
  mode,
  load_kg_per_trip: null,
  fare_one_way: null,
});
const roadKm = (km: number): RouteFetcher => async () => km;
const offline: RouteFetcher = async () => {
  throw new TypeError("Network request failed");
};
const travelOf = (farm: { getState: () => FarmState }, i = 0) => farm.getState().lots[i].travel;

test("a new place gets a road route: minutes = km / mode speed, source route", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  const dest = farm.getState().addDestination(place(124.25, 8.25, "motorcycle"));
  const r = await syncTravel(deps(roadKm(15)));
  assert.equal(r.route.length, 1);
  const t = travelOf(farm)[0];
  assert.equal(t.destination_id, dest);
  assert.equal(t.source, "route");
  assert.equal(t.route_profile, "car");
  assert.equal(t.distance_km, 15);
  assert.equal(t.minutes, (15 / TRAVEL_SPEED_KMH.motorcycle) * 60);
});

test("shared transport adds the waiting time (jeepney)", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addDestination(place(124.25, 8.25, "jeepney"));
  await syncTravel(deps(roadKm(10)));
  assert.equal(travelOf(farm)[0].minutes, (10 / TRAVEL_SPEED_KMH.jeepney) * 60 + (TRAVEL_WAIT_MIN.jeepney ?? 0));
});

test("a second pass asks nothing when nothing moved", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addDestination(place(124.25, 8.25));
  let calls = 0;
  const f: RouteFetcher = async () => (calls++, 12);
  await syncTravel(deps(f));
  await syncTravel(deps(f));
  assert.equal(calls, 1);
});

test("the farmer's own time is never replaced or fetched", async () => {
  const { farm, deps } = await setup();
  const lotId = farm.getState().addLot(lot(124.2, 8.2));
  const dest = farm.getState().addDestination(place(124.25, 8.25));
  farm.getState().setTravel(lotId, { destination_id: dest, distance_km: null, minutes: 45, source: "farmer", route_profile: null });
  let calls = 0;
  const r = await syncTravel(deps(async () => (calls++, 12)));
  assert.equal(calls, 0);
  assert.deepEqual(r.route.concat(r.estimate), []);
  assert.equal(travelOf(farm)[0].minutes, 45);
});

test("offline: the labelled estimate now, a road route on the next pass", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addDestination(place(124.25, 8.25));
  const first = await syncTravel(deps(offline));
  assert.equal(first.offline, true);
  assert.equal(first.estimate.length, 1);
  assert.equal(travelOf(farm)[0].source, "estimate");
  const second = await syncTravel(deps(roadKm(20)));
  assert.equal(second.route.length, 1);
  assert.equal(travelOf(farm)[0].source, "route");
  assert.equal(travelOf(farm)[0].distance_km, 20);
});

test("after one network failure the other places get the estimate without another request", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addDestination(place(124.25, 8.25));
  farm.getState().addDestination(place(124.3, 8.3));
  let calls = 0;
  const r = await syncTravel(deps(async () => (calls++, Promise.reject(new TypeError("down")))));
  assert.equal(calls, 1);
  assert.equal(r.estimate.length, 2);
  assert.ok(travelOf(farm).every((t) => t.source === "estimate"));
});

test("'No route found' for one place does not stop the next one", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  const island = farm.getState().addDestination(place(125.5, 9.5));
  const town = farm.getState().addDestination(place(124.25, 8.25));
  const f: RouteFetcher = async (_p, _from, to) => {
    if (to[0] === 125.5) throw new RoutingError("No route found (NoRoute)");
    return 9;
  };
  const r = await syncTravel(deps(f));
  assert.equal(r.offline, false);
  const byDest = (id: string) => travelOf(farm).find((t) => t.destination_id === id);
  assert.equal(byDest(island)?.source, "estimate");
  assert.equal(byDest(town)?.source, "route");
});

test("requests are spaced for the routing server (one per second at most)", async () => {
  const { farm, waits, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addDestination(place(124.25, 8.25));
  farm.getState().addDestination(place(124.3, 8.3));
  await syncTravel(deps(roadKm(5)));
  assert.deepEqual(waits, [ROUTING_MIN_INTERVAL_MS]); // none before the first request
});

test("a moved lot is routed again, and so is a place whose mode changed", async () => {
  const { farm, deps } = await setup();
  const lotId = farm.getState().addLot(lot(124.2, 8.2));
  const dest = farm.getState().addDestination(place(124.25, 8.25, "motorcycle"));
  let calls = 0;
  const f: RouteFetcher = async () => (calls++, 10);
  await syncTravel(deps(f));
  farm.getState().updateLot(lotId, { centroid: [124.21, 8.21] });
  await syncTravel(deps(f));
  assert.equal(calls, 2);
  farm.getState().updateDestination(dest, { mode: "tricycle" }); // same profile (car), different speed
  await syncTravel(deps(f));
  assert.equal(calls, 3);
  assert.equal(travelOf(farm)[0].minutes, (10 / TRAVEL_SPEED_KMH.tricycle) * 60);
});

test("a move of less than 100 m (same rounded point) is not fetched again", async () => {
  const { farm, deps } = await setup();
  const lotId = farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addDestination(place(124.25, 8.25));
  let calls = 0;
  const f: RouteFetcher = async () => (calls++, 10);
  await syncTravel(deps(f));
  farm.getState().updateLot(lotId, { centroid: [124.2001, 8.2001] });
  await syncTravel(deps(f));
  assert.equal(calls, 1);
});

test("a place removed while a request is running is not saved", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  const dest = farm.getState().addDestination(place(124.25, 8.25));
  const f: RouteFetcher = async () => {
    farm.getState().deleteDestination(dest);
    return 7;
  };
  const r = await syncTravel(deps(f));
  assert.equal(travelOf(farm).length, 0);
  assert.deepEqual(r.route, []);
});

test("a time the farmer types while a request is running wins", async () => {
  const { farm, deps } = await setup();
  const lotId = farm.getState().addLot(lot(124.2, 8.2));
  const dest = farm.getState().addDestination(place(124.25, 8.25));
  const f: RouteFetcher = async () => {
    farm.getState().setTravel(lotId, { destination_id: dest, distance_km: null, minutes: 33, source: "farmer", route_profile: null });
    return 7;
  };
  await syncTravel(deps(f));
  assert.equal(travelOf(farm)[0].source, "farmer");
  assert.equal(travelOf(farm)[0].minutes, 33);
});

test("every lot gets its own entry for every place", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addLot(lot(124.3, 8.1));
  farm.getState().addDestination(place(124.25, 8.25));
  farm.getState().addDestination(place(124.4, 8.4, "walk"));
  const r = await syncTravel(deps(roadKm(6)));
  assert.equal(r.route.length, 4);
  assert.deepEqual(farm.getState().lots.map((l) => l.travel.length), [2, 2]);
});
