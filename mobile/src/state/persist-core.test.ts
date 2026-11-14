/// <reference types="node" />
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
  buildPersistOptions,
  getHydrationSnapshot,
  resetHydrationRegistry,
  whenAllStoresSettled,
  type RawStorage,
} from "./persist-core";

// Slow in-memory storage, like AsyncStorage on a low-end phone: every call resolves after `delayMs`.
function slowStorage(initial: Record<string, string> = {}, delayMs = 20) {
  const data = new Map(Object.entries(initial));
  const later = <T>(fn: () => T) => new Promise<T>((r) => setTimeout(() => r(fn()), delayMs));
  const raw: RawStorage & { data: Map<string, string>; failReads: boolean } = {
    data,
    failReads: false,
    getItem: (k) =>
      raw.failReads ? Promise.reject(new Error("disk I/O error")) : later(() => data.get(k) ?? null),
    setItem: (k, v) => later(() => void data.set(k, v)),
    removeItem: (k) => later(() => void data.delete(k)),
  };
  return raw;
}

// Read takes 30 ms, write 1 ms: a write issued after the read can still land first.
function fastWriteStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => new Promise<string | null>((r) => setTimeout(() => r(data.get(k) ?? null), 30)),
    setItem: (k: string, v: string) => new Promise<void>((r) => setTimeout(() => r(void data.set(k, v)), 1)),
    removeItem: async (k: string) => void data.delete(k),
  };
}

type Farm = { lots: string[]; addLot: (id: string) => void };
const farmInit = (set: (fn: (s: Farm) => Partial<Farm>) => void): Farm => ({
  lots: [],
  addLot: (id) => set((s) => ({ lots: [...s.lots, id] })),
});
const saved = (state: object, version = 1) => JSON.stringify({ state, version });
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => resetHydrationRegistry());

test("plain zustand persist: a change before loading finishes replaces saved data on disk (the bug)", async () => {
  const raw = fastWriteStorage({ "agrosprout-farm": saved({ lots: ["Lot 1", "Lot 2"] }) });
  const data = raw.data;
  const store = createStore<Farm>()(
    persist(farmInit, { name: "agrosprout-farm", version: 1, storage: createJSONStorage(() => raw) }),
  );
  store.getState().addLot("Lot 3"); // farmer taps before saved data is in
  await tick(60);
  assert.deepEqual(JSON.parse(data.get("agrosprout-farm")!).state.lots, ["Lot 3"]); // Lot 1 and 2 are gone on disk
});

test("guarded store: a change before loading finishes never reaches disk, saved data survives", async () => {
  const raw = fastWriteStorage({ "agrosprout-farm": saved({ lots: ["Lot 1", "Lot 2"] }) }); // same timing as the bug
  const store = createStore<Farm>()(persist(farmInit, buildPersistOptions<Farm>("farm", {}, raw)));
  store.getState().addLot("Lot 3");
  await whenAllStoresSettled();
  await tick(40);
  assert.deepEqual(store.getState().lots, ["Lot 1", "Lot 2"]);
  assert.deepEqual(JSON.parse(raw.data.get("agrosprout-farm")!).state.lots, ["Lot 1", "Lot 2"]);
  assert.deepEqual(getHydrationSnapshot().farm, { state: "ready" });
});

test("guarded store: changes after loading are saved and survive a restart", async () => {
  const raw = slowStorage();
  const first = createStore<Farm>()(persist(farmInit, buildPersistOptions<Farm>("farm", {}, raw)));
  await whenAllStoresSettled();
  first.getState().addLot("Lot 1");
  await tick(40);
  resetHydrationRegistry();
  const restarted = createStore<Farm>()(persist(farmInit, buildPersistOptions<Farm>("farm", {}, raw)));
  await whenAllStoresSettled();
  assert.deepEqual(restarted.getState().lots, ["Lot 1"]);
});

test("unreadable saved data is backed up, the store starts empty and keeps working", async () => {
  const raw = slowStorage({ "agrosprout-farm": "{not json" });
  const store = createStore<Farm>()(persist(farmInit, buildPersistOptions<Farm>("farm", {}, raw)));
  await whenAllStoresSettled();
  const status = getHydrationSnapshot().farm;
  assert.equal(status.state, "recovered");
  assert.ok(status.state === "recovered" && raw.data.get(status.backupKey) === "{not json");
  store.getState().addLot("Lot 1");
  await tick(40);
  assert.deepEqual(JSON.parse(raw.data.get("agrosprout-farm")!).state.lots, ["Lot 1"]);
});

test("version change without migrate: old data is backed up, not silently lost", async () => {
  const old = saved({ lots: ["Old lot"] }, 1);
  const raw = slowStorage({ "agrosprout-farm": old });
  const store = createStore<Farm>()(persist(farmInit, buildPersistOptions<Farm>("farm", { version: 2 }, raw)));
  await whenAllStoresSettled();
  assert.deepEqual(store.getState().lots, []);
  const status = getHydrationSnapshot().farm;
  assert.ok(status.state === "recovered" && raw.data.get(status.backupKey) === old);
});

test("version change with migrate: data is converted, and the original is backed up", async () => {
  const old = saved({ lotNames: "A,B" }, 1);
  const raw = slowStorage({ "agrosprout-farm": old });
  const store = createStore<Farm>()(
    persist(
      farmInit,
      buildPersistOptions<Farm>(
        "farm",
        { version: 2, migrate: (p) => ({ lots: (p as { lotNames: string }).lotNames.split(",") }) as Farm },
        raw,
      ),
    ),
  );
  await whenAllStoresSettled();
  await tick(40);
  assert.deepEqual(store.getState().lots, ["A", "B"]);
  assert.deepEqual(JSON.parse(raw.data.get("agrosprout-farm")!), { state: { lots: ["A", "B"] }, version: 2 });
  const status = getHydrationSnapshot().farm;
  assert.ok(status.state === "recovered" && raw.data.get(status.backupKey) === old);
});

test("migrate that throws: loading still finishes, original is backed up", async () => {
  const old = saved({ lots: ["A"] }, 1);
  const raw = slowStorage({ "agrosprout-farm": old });
  createStore<Farm>()(
    persist(
      farmInit,
      buildPersistOptions<Farm>("farm", { version: 2, migrate: () => { throw new Error("bad shape"); } }, raw),
    ),
  );
  await whenAllStoresSettled();
  const status = getHydrationSnapshot().farm;
  assert.equal(status.state, "recovered");
  assert.ok(status.state === "recovered" && raw.data.get(status.backupKey) === old);
});

test("storage that cannot be read: loading finishes as failed and nothing is written", async () => {
  const before = saved({ lots: ["Lot 1"] });
  const raw = slowStorage({ "agrosprout-farm": before });
  raw.failReads = true;
  const store = createStore<Farm>()(persist(farmInit, buildPersistOptions<Farm>("farm", {}, raw)));
  await whenAllStoresSettled();
  assert.equal(getHydrationSnapshot().farm.state, "failed");
  store.getState().addLot("Lot 2");
  await tick(40);
  assert.equal(raw.data.get("agrosprout-farm"), before);
});
