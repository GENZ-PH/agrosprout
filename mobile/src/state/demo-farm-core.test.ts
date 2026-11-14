import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import type { CropLibrary, LotData } from "../types";
import { DEMO_FARM, DEMO_REF, isDemoFarm } from "./demo-farm-core";

// Read from disk: Node's test runner can't import JSON without import attributes (same as
// lot-analysis-core.test.ts), so neither the demo file nor src/data/crops.ts is imported here.
const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...path), "utf8")) as T;
const demo = readJson<LotData>("assets", "data", "demo", "lanao-norte-demo-1.json");
const cropIds = new Set(readJson<CropLibrary>("assets", "data", "crops.json").crops.map((c) => c.id));

test("the sample farm's lots read the bundled demo data and use library crops", () => {
  assert.equal(DEMO_REF, `demo/${demo.id}`);
  assert.ok(DEMO_FARM.lots.length >= 2);
  for (const l of DEMO_FARM.lots) {
    assert.equal(l.data_ref, DEMO_REF);
    assert.equal(l.data_status, "ready");
    assert.ok(l.crops.length > 0);
    for (const c of l.crops) assert.ok(cropIds.has(c.crop_id), `${c.crop_id} is in the crop library`);
  }
});

test("isDemoFarm is true only when every lot is a demo lot", () => {
  assert.equal(isDemoFarm(DEMO_FARM.lots), true);
  assert.equal(isDemoFarm([]), false);
  assert.equal(isDemoFarm([...DEMO_FARM.lots, { data_ref: "lotdata:lot-3" }]), false);
});
