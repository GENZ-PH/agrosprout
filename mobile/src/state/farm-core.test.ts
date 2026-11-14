/// <reference types="node" />
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Lot, Travel } from "../types";
import {
  DEFAULT_PRIORITIES,
  FARM_STORAGE_KEY,
  farmPersistOptions,
  farmStateCreator,
  toFarm,
  type FarmData,
  type FarmState,
  type NewLot,
} from "./farm-core";
import { buildPersistOptions, resetHydrationRegistry, whenAllStoresSettled, type RawStorage } from "./persist-core";

// In-memory AsyncStorage stand-in with a small delay, like the device.
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const later = <T>(fn: () => T) => new Promise<T>((r) => setTimeout(() => r(fn()), 5));
  const raw: RawStorage & { data: Map<string, string> } = {
    data,
    getItem: (k) => later(() => data.get(k) ?? null),
    setItem: (k, v) => later(() => void data.set(k, v)),
    removeItem: (k) => later(() => void data.delete(k)),
  };
  return raw;
}

async function openFarm(raw: ReturnType<typeof memoryStorage>) {
  resetHydrationRegistry();
  const store = createStore<FarmState>()(
    persist(
      farmStateCreator({ removeKey: (k) => raw.removeItem(k) }),
      buildPersistOptions<FarmState, FarmData>("farm", farmPersistOptions, raw),
    ),
  );
  await whenAllStoresSettled();
  return store;
}
const settle = () => new Promise((r) => setTimeout(r, 30));

const square: NewLot = {
  geometry: { type: "Polygon", coordinates: [[[124.2, 8.2], [124.201, 8.2], [124.201, 8.201], [124.2, 8.2]]] },
  area_ha: 1.2,
  centroid: [124.2005, 8.2005],
};

let raw: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  raw = memoryStorage();
});

test("new farm: empty, default priorities all 50", async () => {
  const s = await openFarm(raw);
  assert.deepEqual(s.getState().lots, []);
  assert.deepEqual(s.getState().priorities, DEFAULT_PRIORITIES);
});

test("addLot fills id, name, data_ref, pending status and unknown details", async () => {
  const s = await openFarm(raw);
  const id = s.getState().addLot(square);
  const lot = s.getState().lots[0];
  assert.equal(id, "lot-1");
  assert.equal(lot.name, "Lot 1");
  assert.equal(lot.data_ref, "lotdata:lot-1");
  assert.equal(lot.data_status, "pending");
  assert.deepEqual(lot.details, { land_type: "unknown", water: "unknown", soil: "unknown" });
  assert.deepEqual(lot.travel, []);
});

test("lot ids and default names are never reused after a delete", async () => {
  const s = await openFarm(raw);
  s.getState().addLot(square);
  s.getState().addLot(square);
  s.getState().deleteLot("lot-2");
  const id = s.getState().addLot(square);
  assert.equal(id, "lot-3");
  assert.deepEqual(s.getState().lots.map((l) => l.name), ["Lot 1", "Lot 3"]);
});

test("updateLot changes fields but never id or data_ref; a blank name keeps the old one", async () => {
  const s = await openFarm(raw);
  const id = s.getState().addLot(square);
  s.getState().updateLot(id, { name: "  Riverside  ", data_status: "ready", id: "x", data_ref: "y" } as Partial<Lot>);
  s.getState().updateLot(id, { name: "   " });
  const lot = s.getState().lots[0];
  assert.equal(lot.name, "Riverside");
  assert.equal(lot.data_status, "ready");
  assert.equal(lot.id, "lot-1");
  assert.equal(lot.data_ref, "lotdata:lot-1");
});

test("setCrops and setSeasons", async () => {
  const s = await openFarm(raw);
  const id = s.getState().addLot(square);
  s.getState().setCrops(id, [{ crop_id: "rice", seasons: [] }, { crop_id: "mungbean", seasons: [] }]);
  s.getState().setSeasons(id, "rice", [{ plant_month: 11, harvest_month: 2 }]);
  assert.deepEqual(s.getState().lots[0].crops, [
    { crop_id: "rice", seasons: [{ plant_month: 11, harvest_month: 2 }] },
    { crop_id: "mungbean", seasons: [] },
  ]);
});

test("destinations: add, update, and delete removes every lot's travel to it", async () => {
  const s = await openFarm(raw);
  const lotId = s.getState().addLot(square);
  const destId = s.getState().addDestination({
    name: "Iligan market", type: "market", point: [124.24, 8.23], mode: "jeepney", load_kg_per_trip: null, fare_one_way: null,
  });
  assert.equal(destId, "dest-1");
  s.getState().updateDestination(destId, { mode: "tricycle" });
  const travel: Travel = { destination_id: destId, distance_km: 12, minutes: 35, source: "route", route_profile: "car" };
  s.getState().setTravel(lotId, travel);
  s.getState().setTravel(lotId, { ...travel, minutes: 30, source: "farmer", route_profile: null }); // replaces
  assert.equal(s.getState().destinations[0].mode, "tricycle");
  assert.deepEqual(s.getState().lots[0].travel.map((t) => t.minutes), [30]);
  s.getState().deleteDestination(destId);
  assert.deepEqual(s.getState().destinations, []);
  assert.deepEqual(s.getState().lots[0].travel, []);
});

test("a new transport mode or a moved pin clears the times for that place, other changes keep them", async () => {
  const s = await openFarm(raw);
  const lotId = s.getState().addLot(square);
  const destId = s.getState().addDestination({
    name: "Market", type: "market", point: [124.24, 8.23], mode: "motorcycle", load_kg_per_trip: null, fare_one_way: null,
  });
  const otherId = s.getState().addDestination({
    name: "Dryer", type: "storage", point: [124.3, 8.3], mode: "motorcycle", load_kg_per_trip: null, fare_one_way: null,
  });
  const farmerTime = (id: string): Travel => ({ destination_id: id, distance_km: 5, minutes: 20, source: "farmer", route_profile: null });
  const fill = () => {
    s.getState().setTravel(lotId, farmerTime(destId));
    s.getState().setTravel(lotId, farmerTime(otherId));
  };
  const ids = () => s.getState().lots[0].travel.map((t) => t.destination_id).sort();

  fill();
  s.getState().updateDestination(destId, { name: "Poblacion market", load_kg_per_trip: 80, mode: "motorcycle" });
  assert.deepEqual(ids(), [destId, otherId].sort(), "a rename, a load and the same mode keep the times");

  s.getState().updateDestination(destId, { mode: "walk" });
  assert.deepEqual(ids(), [otherId], "walking instead of motorcycle: the old times go, other places keep theirs");

  fill();
  s.getState().updateDestination(destId, { point: [124.25, 8.24] });
  assert.deepEqual(ids(), [otherId], "a moved pin clears its times");

  fill();
  s.getState().updateDestination(destId, { point: [124.25, 8.24] });
  assert.deepEqual(ids(), [destId, otherId].sort(), "the same pin again keeps them");
});

test("setPriorities clamps to 0-100 and keeps unchanged values", async () => {
  const s = await openFarm(raw);
  s.getState().setPriorities({ water: 140, soil: -5 });
  assert.deepEqual(s.getState().priorities, { water: 100, soil: 0, income: 50, labor: 50, forage: 50 });
});

test("deleteLot and clearAll also remove the lots' saved climate data", async () => {
  raw.data.set("lotdata:lot-1", "{}");
  raw.data.set("lotdata:lot-2", "{}");
  raw.data.set("lotdata:other", "{}");
  const s = await openFarm(raw);
  s.getState().addLot(square);
  s.getState().addLot(square);
  s.getState().deleteLot("lot-1");
  await settle();
  assert.equal(raw.data.has("lotdata:lot-1"), false);
  s.getState().clearAll();
  await settle();
  assert.equal(raw.data.has("lotdata:lot-2"), false);
  assert.equal(raw.data.has("lotdata:other"), true); // not ours: untouched
  assert.deepEqual(s.getState().lots, []);
  assert.equal(s.getState().next_lot_number, 1);
});

test("saved under key `farm` with version 1, data only, and the farm survives a restart", async () => {
  const s = await openFarm(raw);
  const id = s.getState().addLot(square);
  s.getState().setCrops(id, [{ crop_id: "rice", seasons: [] }]);
  s.getState().setPriorities({ water: 80 });
  await settle();
  const saved = JSON.parse(raw.data.get(FARM_STORAGE_KEY)!);
  assert.equal(saved.version, 1);
  assert.deepEqual(Object.keys(saved.state).sort(), [
    "destinations", "lots", "next_destination_number", "next_lot_number", "priorities",
  ]);

  const restarted = await openFarm(raw);
  assert.deepEqual(toFarm(restarted.getState()), toFarm(s.getState()));
  assert.equal(restarted.getState().addLot(square), "lot-2"); // counter survived too
});

test("a change before the saved farm loads does not erase it", async () => {
  const first = await openFarm(raw);
  first.getState().addLot(square);
  await settle();
  resetHydrationRegistry();
  const s = createStore<FarmState>()(
    persist(
      farmStateCreator({ removeKey: (k) => raw.removeItem(k) }),
      buildPersistOptions<FarmState, FarmData>("farm", farmPersistOptions, raw),
    ),
  );
  s.getState().setPriorities({ water: 0 }); // before loading finished
  await whenAllStoresSettled();
  await settle();
  assert.equal(s.getState().lots.length, 1);
  assert.equal(JSON.parse(raw.data.get(FARM_STORAGE_KEY)!).state.lots.length, 1);
});

test("toFarm gives the types.ts Farm shape", async () => {
  const s = await openFarm(raw);
  s.getState().addLot(square);
  const farm = toFarm(s.getState());
  assert.equal(farm.version, 1);
  assert.deepEqual(Object.keys(farm).sort(), ["destinations", "lots", "priorities", "version"]);
});
