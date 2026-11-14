/// <reference types="node" />
// The dashboard's per-lot state (#29, #43): read the lot's climate data, then run analyzeLot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { CropLibrary, Lot, LotCrop, LotData } from "../types";
import { lotView, monthsCompare, readLotData, type DemoFarms } from "./lot-analysis-core";

// Read from disk: Node's test runner can't import JSON without import attributes.
const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...path), "utf8")) as T;
const library = readJson<CropLibrary>("assets", "data", "crops.json");
const demo = readJson<LotData>("assets", "data", "demo", "lanao-norte-demo-1.json");
const demos: DemoFarms = { "lanao-norte-demo-1": demo };

const farm = { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } };

/** A key-value store that records which keys were read. */
function memoryStore(entries: Record<string, string> = {}) {
  const reads: string[] = [];
  return {
    reads,
    get: async (key: string) => {
      reads.push(key);
      return entries[key] ?? null;
    },
  };
}

function lot(crops: LotCrop[], extra: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    name: "Lot 1",
    geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
    area_ha: 2,
    centroid: [124.2405, 8.2303],
    details: { land_type: "lowland", water: "rain", soil: "loamy" },
    crops,
    data_status: "ready",
    data_ref: "lotdata:lot-1",
    travel: [],
    ...extra,
  };
}

const rice: LotCrop = { crop_id: "lowland-rice", seasons: [] };

test("readLotData: live data saved by the lot sync is read from lotdata:<id>", async () => {
  const store = memoryStore({ "lotdata:lot-1": JSON.stringify(ILIGAN_LOT_FIXTURE) });
  assert.deepEqual(await readLotData("lotdata:lot-1", store, demos), ILIGAN_LOT_FIXTURE);
  assert.deepEqual(store.reads, ["lotdata:lot-1"]);
});

test("readLotData: nothing saved yet, unreadable JSON, or not live data all give null", async () => {
  const store = memoryStore({ "lotdata:bad": "{not json", "lotdata:demo": JSON.stringify(demo) });
  assert.equal(await readLotData("lotdata:lot-9", store, demos), null);
  assert.equal(await readLotData("lotdata:bad", store, demos), null);
  assert.equal(await readLotData("lotdata:demo", store, demos), null);
});

test("readLotData: demo/<id> is the bundled demo farm, without touching storage", async () => {
  const store = memoryStore();
  assert.equal(await readLotData("demo/lanao-norte-demo-1", store, demos), demo);
  assert.equal(await readLotData("demo/no-such-farm", store, demos), null);
  assert.equal(await readLotData("somewhere-else", store, demos), null);
  assert.deepEqual(store.reads, []);
});

test("lotView: a lot with no crops asks for crops first, even when its data is there", () => {
  assert.deepEqual(lotView({ farm, lot: lot([]), data: ILIGAN_LOT_FIXTURE, library }), { kind: "no-crops" });
});

test("lotView: crops but no climate data yet keeps the lot's download status", () => {
  for (const status of ["pending", "error", "ready"] as const) {
    assert.deepEqual(lotView({ farm, lot: lot([rice], { data_status: status }), data: null, library }), {
      kind: "no-data",
      status,
    });
  }
});

test("lotView: on the Iligan test lot with crops.json, the Soil Health card gets one line per option", () => {
  const v = lotView({ farm, lot: lot([rice]), data: ILIGAN_LOT_FIXTURE, library });
  assert.equal(v.kind, "ready");
  if (v.kind !== "ready") return;
  assert.equal(v.period, ILIGAN_LOT_FIXTURE.period, "the ⓘ texts name the years of the lot's own data");
  const { rotations, soil_health, stage } = v.analysis;
  assert.equal(stage, 1, "no months given yet, so option A uses the typical calendar");
  assert.ok(rotations.options.length >= 3, `at least 3 options (DoD #6), got ${rotations.options.length}`);
  assert.deepEqual(
    soil_health.options.map((o) => o.option_key),
    rotations.options.map((o) => o.key),
  );
  assert.ok(soil_health.options.every((o) => o.trajectory !== null && o.trajectory.points.length === soil_health.years + 1));
});

test("lotView: a what-if scenario reaches the analysis and changes the climate it used (#47)", () => {
  const before = JSON.stringify(ILIGAN_LOT_FIXTURE);
  const today = lotView({ farm, lot: lot([rice]), data: ILIGAN_LOT_FIXTURE, library });
  const drier = lotView({ farm, lot: lot([rice]), data: ILIGAN_LOT_FIXTURE, library, scenario: { rain_pct: -30, temp_c: 2 } });
  assert.equal(today.kind, "ready");
  assert.equal(drier.kind, "ready");
  if (today.kind !== "ready" || drier.kind !== "ready") return;
  assert.equal(today.analysis.scenario, null);
  assert.ok(drier.analysis.scenario?.notes.some((n) => /not a forecast/i.test(n)));
  const p50 = (a: typeof today) => a.analysis.monthly.precip_mm.p50.reduce<number>((t, v) => t + (v ?? 0), 0);
  assert.ok(Math.abs(p50(drier) / p50(today) - 0.7) < 1e-9, "rain is 30% lower in every month");
  assert.equal(JSON.stringify(ILIGAN_LOT_FIXTURE), before, "the saved climate data is not changed");
});

test("lotView: the bundled demo farm works the same way as live data", () => {
  const v = lotView({ farm, lot: lot([rice], { data_ref: "demo/lanao-norte-demo-1" }), data: demo, library });
  assert.equal(v.kind, "ready");
});

test("lotView: an engine error becomes a message, not a crash", () => {
  const broken = { ...ILIGAN_LOT_FIXTURE, monthly: undefined } as unknown as LotData;
  const v = lotView({ farm, lot: lot([rice]), data: broken, library });
  assert.equal(v.kind, "failed");
  if (v.kind === "failed") assert.ok(v.message.length > 0);
});

test("months compare (S5 on the dashboard): a crop with no months uses its usual months, listed as assumed", () => {
  const read = (...p: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...p), "utf8"));
  const library = read("assets", "data", "crops.json");
  const demo = read("assets", "data", "demo", "lanao-norte-demo-1.json");
  const details = { land_type: "lowland", water: "rain", soil: "loamy" } as const;
  const none = monthsCompare({ details, crops: [{ crop_id: "lowland-rice", seasons: [] }, { crop_id: "other:taro", seasons: [] }] }, demo, library);
  assert.deepEqual(none.assumed, ["lowland-rice"]);
  assert.ok(none.planting.seasons.length > 0, "the usual rice calendar is compared");
  assert.ok(none.crops.every((c) => c.crop_id !== "other:taro"), "crops outside the library are left out");
  const given = monthsCompare({ details, crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 11, harvest_month: 3 }] }] }, demo, library);
  assert.deepEqual(given.assumed, []);
  assert.deepEqual(given.planting.seasons.map((s) => s.yours.plant_month), [11]);
});
