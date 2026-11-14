/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { LotData } from "../types";
import { buildBackup, describeBackup, parseBackup, restoreBackup, serializeBackup } from "./backup-core";
import { farmPersistOptions, farmStateCreator, toFarm, type FarmData, type FarmState, type NewLot } from "./farm-core";
import { buildPersistOptions, resetHydrationRegistry, whenAllStoresSettled, type RawStorage } from "./persist-core";

function memoryStorage() {
  const data = new Map<string, string>();
  const later = <T>(fn: () => T) => new Promise<T>((r) => setTimeout(() => r(fn()), 3));
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
const lotInput: NewLot = {
  geometry: { type: "Polygon", coordinates: [[[124.2, 8.2], [124.201, 8.2], [124.201, 8.201], [124.2, 8.2]]] },
  area_ha: 1.2,
  centroid: [124.2005, 8.2005],
};
const climate = (id: string) => ({ id, kind: "live", lat: 8.2, lon: 124.2, monthly: {} }) as unknown as LotData;

async function farmWithData(raw: ReturnType<typeof memoryStorage>) {
  const s = await openFarm(raw);
  const a = s.getState().addLot({ ...lotInput, name: "Riverside" });
  const b = s.getState().addLot(lotInput);
  s.getState().setCrops(a, [{ crop_id: "rice", seasons: [{ plant_month: 11, harvest_month: 2 }] }]);
  s.getState().setCrops(b, [{ crop_id: "mungbean", seasons: [] }]);
  const d = s.getState().addDestination({
    name: "Market", type: "market", point: [124.24, 8.23], mode: "jeepney", load_kg_per_trip: 40, fare_one_way: null,
  });
  s.getState().setTravel(a, { destination_id: d, distance_km: 12, minutes: 35, source: "route", route_profile: "car" });
  s.getState().setPriorities({ water: 90 });
  await raw.setItem("lotdata:lot-1", JSON.stringify(climate("lot-1"))); // lot-2 has no climate data yet
  await settle();
  return s;
}

test("acceptance: export, clear app data, restore brings back lots, crops, months, places and priorities", async () => {
  const raw = memoryStorage();
  const s = await farmWithData(raw);
  const original = toFarm(s.getState());
  const file = serializeBackup(
    await buildBackup({ farm: original, readKey: (k) => raw.getItem(k), appVersion: "1.0.0" }),
  );

  raw.data.clear(); // "clear app data"
  const fresh = await openFarm(raw);
  assert.equal(fresh.getState().lots.length, 0);

  const parsed = parseBackup(file);
  assert.ok(parsed.ok);
  assert.equal(describeBackup(parsed.backup), "2 lots, 2 crops, 1 place");
  await restoreBackup({
    backup: parsed.backup,
    currentLots: fresh.getState().lots,
    replaceFarm: fresh.getState().replaceFarm,
    removeKey: (k) => raw.removeItem(k),
    writeKey: (k, v) => raw.setItem(k, v),
  });
  await settle();

  const restored = toFarm(fresh.getState());
  assert.deepEqual(restored.destinations, original.destinations);
  assert.deepEqual(restored.priorities, original.priorities);
  assert.deepEqual(restored.lots.map((l) => [l.id, l.name, l.crops, l.travel]), original.lots.map((l) => [l.id, l.name, l.crops, l.travel]));
  assert.equal(restored.lots[0].data_status, "ready"); // climate data came back from the file
  assert.equal(restored.lots[1].data_status, "pending"); // not in the file: fetched again when online
  assert.deepEqual(JSON.parse(raw.data.get("lotdata:lot-1")!), climate("lot-1"));
  assert.equal(fresh.getState().addLot(lotInput), "lot-3"); // ids continue after the restored ones

  const reopened = await openFarm(raw); // and it is saved, not just in memory
  assert.equal(reopened.getState().lots.length, 3);
});

test("restore over an existing farm removes the old climate data but keeps the restored one", async () => {
  const raw = memoryStorage();
  const s = await farmWithData(raw);
  const backup = await buildBackup({ farm: toFarm(s.getState()), readKey: (k) => raw.getItem(k), appVersion: "1" });
  await raw.setItem("lotdata:lot-2", JSON.stringify(climate("lot-2"))); // exists now, not in the backup
  await restoreBackup({
    backup,
    currentLots: s.getState().lots,
    replaceFarm: s.getState().replaceFarm,
    removeKey: (k) => raw.removeItem(k),
    writeKey: (k, v) => raw.setItem(k, v),
  });
  await settle();
  assert.ok(raw.data.has("lotdata:lot-1"));
  assert.equal(raw.data.has("lotdata:lot-2"), false);
});

test("parseBackup rejects files that are not a valid farm backup, with a reason", () => {
  const good = JSON.parse(
    JSON.stringify({ kind: "agrosprout-farm-backup", format: 1, created_at: "", app_version: "", lotdata: {},
      farm: { version: 1, lots: [], destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } } }),
  );
  assert.ok(parseBackup(JSON.stringify(good)).ok);
  const bad = (mut: (b: typeof good) => void) => {
    const b = structuredClone(good);
    mut(b);
    const r = parseBackup(JSON.stringify(b));
    assert.equal(r.ok, false);
    return r.ok ? "" : r.reason;
  };
  assert.match((parseBackup("{oops") as { reason: string }).reason, /not valid JSON/);
  assert.match(bad((b) => (b.kind = "something")), /not an AgriResilience/);
  assert.match(bad((b) => (b.format = 2)), /format 2/);
  assert.match(bad((b) => (b.farm.version = 2)), /version 2/);
  assert.match(bad((b) => (b.farm.priorities.water = 150)), /priorities/);
  assert.match(bad((b) => b.farm.lots.push({ id: "lot-1", name: "A" })), /lot 1 has no valid outline/);
  assert.match(
    bad((b) => b.farm.destinations.push({ id: "d", name: "M", type: "mall", mode: "jeepney", point: [1, 2], load_kg_per_trip: null, fare_one_way: null })),
    /place 1 has an invalid type/,
  );
});

test("parseBackup ignores climate data for lots that are not in the file", async () => {
  const raw = memoryStorage();
  const s = await farmWithData(raw);
  const backup = await buildBackup({ farm: toFarm(s.getState()), readKey: (k) => raw.getItem(k), appVersion: "1" });
  const tampered = { ...backup, lotdata: { ...backup.lotdata, "lot-99": climate("lot-99"), "lot-2": { junk: true } } };
  const r = parseBackup(JSON.stringify(tampered));
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.backup.lotdata), ["lot-1"]);
});
