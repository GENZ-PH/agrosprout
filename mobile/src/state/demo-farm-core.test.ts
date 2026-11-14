import assert from "node:assert/strict";
import { test } from "node:test";

import demo from "../../assets/data/demo/lanao-norte-demo-1.json";
import { cropById } from "../data/crops";
import { DEMO_FARM, DEMO_REF, isDemoFarm } from "./demo-farm-core";

test("the sample farm's lots read the bundled demo data and use library crops", () => {
  assert.equal(DEMO_REF, `demo/${demo.id}`);
  assert.ok(DEMO_FARM.lots.length >= 2);
  for (const l of DEMO_FARM.lots) {
    assert.equal(l.data_ref, DEMO_REF);
    assert.equal(l.data_status, "ready");
    assert.ok(l.crops.length > 0);
    for (const c of l.crops) assert.ok(cropById(c.crop_id), `${c.crop_id} is in the crop library`);
  }
});

test("isDemoFarm is true only when every lot is a demo lot", () => {
  assert.equal(isDemoFarm(DEMO_FARM.lots), true);
  assert.equal(isDemoFarm([]), false);
  assert.equal(isDemoFarm([...DEMO_FARM.lots, { data_ref: "lotdata:lot-3" }]), false);
});
