/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { PowerHttpError, type LotDataStore, type PowerFetcher } from "../data/power";
import { farmPersistOptions, farmStateCreator, type FarmData, type FarmState, type NewLot } from "./farm-core";
import { syncPendingLots } from "./lot-sync-core";
import { buildPersistOptions, resetHydrationRegistry, whenAllStoresSettled, type RawStorage } from "./persist-core";

// Real NASA POWER monthly response (8.2 N, 124.2 E), from the #63 test fixture.
const powerJson: unknown = JSON.parse(
  readFileSync(new URL("../data/__fixtures__/power-monthly-8.2N-124.2E-2001-2025.json", import.meta.url), "utf8"),
);

function memory() {
  const data = new Map<string, string>();
  const raw: RawStorage & LotDataStore & { data: Map<string, string> } = {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
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
  const deps = (fetcher: PowerFetcher) => ({
    getLots: () => farm.getState().lots,
    setStatus: (id: string, data_status: "ready" | "pending" | "error") => farm.getState().updateLot(id, { data_status }),
    store: raw,
    fetcher,
  });
  return { raw, farm, deps };
}
const lot = (lon: number, lat: number): NewLot => ({
  geometry: { type: "Polygon", coordinates: [[[lon, lat], [lon + 0.001, lat], [lon, lat + 0.001], [lon, lat]]] },
  area_ha: 1,
  centroid: [lon, lat],
});
const offline: PowerFetcher = async () => {
  throw new TypeError("Network request failed");
};

test("pending lots are fetched, saved under lotdata:<id>, and marked ready", async () => {
  const { raw, farm, deps } = await setup();
  const id = farm.getState().addLot(lot(124.2, 8.2));
  const calls: [number, number][] = [];
  const r = await syncPendingLots(deps(async (la, lo) => (calls.push([la, lo]), powerJson)));
  assert.deepEqual(r.ready, [id]);
  assert.deepEqual(calls, [[8.2, 124.2]]); // rounded centroid, lat first
  assert.equal(farm.getState().lots[0].data_status, "ready");
  const saved = JSON.parse(raw.data.get(`lotdata:${id}`)!);
  assert.equal(saved.kind, "live");
});

test("offline: the lot stays pending, and the pass stops after the first failure", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addLot(lot(124.3, 8.3));
  let calls = 0;
  const r = await syncPendingLots(deps(async (...a) => (calls++, offline(...a))));
  assert.equal(calls, 1);
  assert.deepEqual(r.pending, ["lot-1"]);
  assert.deepEqual(farm.getState().lots.map((l) => l.data_status), ["pending", "pending"]);
});

test("back online: the next pass fetches every pending lot", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  farm.getState().addLot(lot(124.3, 8.3));
  await syncPendingLots(deps(offline));
  const r = await syncPendingLots(deps(async () => powerJson));
  assert.deepEqual(r.ready, ["lot-1", "lot-2"]);
  assert.deepEqual(farm.getState().lots.map((l) => l.data_status), ["ready", "ready"]);
});

test("a client error (e.g. 422) marks the lot error and is not retried by the next pass", async () => {
  const { farm, deps } = await setup();
  farm.getState().addLot(lot(124.2, 8.2));
  await syncPendingLots(deps(async () => { throw new PowerHttpError(422); }));
  assert.equal(farm.getState().lots[0].data_status, "error");
  let calls = 0;
  await syncPendingLots(deps(async () => (calls++, powerJson)));
  assert.equal(calls, 0);
});

test("moving a lot marks it pending; an unchanged rounded point needs no download", async () => {
  const { farm, deps } = await setup();
  const id = farm.getState().addLot(lot(124.2, 8.2));
  await syncPendingLots(deps(async () => powerJson));
  farm.getState().updateLot(id, { centroid: [124.2004, 8.2003] }); // same 0.1° cell
  assert.equal(farm.getState().lots[0].data_status, "pending");
  let calls = 0;
  await syncPendingLots(deps(async () => (calls++, powerJson)));
  assert.equal(calls, 0);
  assert.equal(farm.getState().lots[0].data_status, "ready");
});

test("a lot deleted during the fetch is not brought back", async () => {
  const { farm, deps } = await setup();
  const id = farm.getState().addLot(lot(124.2, 8.2));
  await syncPendingLots(deps(async () => {
    farm.getState().deleteLot(id);
    return powerJson;
  }));
  assert.deepEqual(farm.getState().lots, []);
});

test("demo lots are never fetched", async () => {
  const { farm, deps } = await setup();
  const id = farm.getState().addLot(lot(124.2, 8.2));
  farm.setState((st) => ({ lots: st.lots.map((l) => (l.id === id ? { ...l, data_ref: "demo/lanao-norte-demo-1" } : l)) }));
  let calls = 0;
  await syncPendingLots(deps(async () => (calls++, powerJson)));
  assert.equal(calls, 0);
});

test("daily POWER: a lot that becomes ready gets the daily data after its status is set, once", async () => {
  const { raw, farm, deps } = await setup();
  const dailyJson: unknown = JSON.parse(
    readFileSync(new URL("../data/__fixtures__/power-daily-8.2N-124.2E-2016-2025.json", import.meta.url), "utf8"),
  );
  const id = farm.getState().addLot(lot(124.2, 8.2));
  const seen: string[] = [];
  let dailyCalls = 0;
  const changed: string[] = [];
  const dailyFetcher = async () => {
    dailyCalls++;
    seen.push(farm.getState().lots[0].data_status);
    return dailyJson;
  };
  await syncPendingLots({ ...deps(async () => powerJson), dailyFetcher, onDataChanged: (x: string) => changed.push(x) });
  assert.deepEqual(seen, ["ready"]); // monthly data was not held back by the daily download
  assert.deepEqual(changed, [id]);
  assert.ok(JSON.parse(raw.data.get(`lotdata:${id}`)!).trends);
  await syncPendingLots({ ...deps(async () => powerJson), dailyFetcher });
  assert.equal(dailyCalls, 1);
});
