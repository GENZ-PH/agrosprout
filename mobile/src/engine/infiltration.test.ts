/// <reference types="node" />
// Storm infiltration indicator (TR-55 curve numbers), docs/07 §4.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LotDetails, Priorities } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { soakShare, stormInfiltration } from "./infiltration";
import { CURVE_NUMBER, MM_PER_INCH } from "./params";
import { rotations } from "./rotations";

test("runoff matches TR-55 Table 2-1 (P = 2.0 in: CN 80 -> 0.56 in, CN 90 -> 1.09 in, CN 60 -> 0.06 in)", () => {
  const p = 2.0 * MM_PER_INCH;
  for (const [cn, q] of [[80, 0.56], [90, 1.09], [60, 0.06], [95, 1.48]] as const) {
    const runoff = (1 - soakShare(cn, p)) * 2.0;
    assert.ok(Math.abs(runoff - q) < 0.006, `CN ${cn}: ${runoff.toFixed(3)} in vs ${q}`);
  }
  // A small storm below the initial abstraction (Ia = 0.2 S) gives no runoff.
  assert.equal(soakShare(60, 5), 1);
});

test("bare months soak in less than cropped months; clay soaks in less than sand", () => {
  for (const g of ["A", "B", "C", "D"] as const) assert.ok(soakShare(CURVE_NUMBER.bare[g]) < soakShare(CURVE_NUMBER.crop[g]), g);
  const allBare = Array.from({ length: 12 }, () => 1);
  const allCrop = Array.from({ length: 12 }, () => 0);
  const w = Array.from({ length: 12 }, () => 1);
  const sandBare = stormInfiltration("sandy", allBare, w, []).share!;
  const clayBare = stormInfiltration("clayey", allBare, w, []).share!;
  assert.ok(clayBare < sandBare);
  assert.ok(stormInfiltration("loamy", allCrop, w, []).share! > stormInfiltration("loamy", allBare, w, []).share!);
  // Hand check, loamy (group B) and bare (CN 86), 50 mm = 1.9685 in: S = 1.628, Ia = 0.326,
  // Q = 1.643^2 / (1.643 + 1.628) = 0.825 in, so about 58% soaks in.
  assert.ok(Math.abs(stormInfiltration("loamy", allBare, w, []).share! - 0.581) < 0.002);
});

test("soil feel maps to a TR-55 group; unknown is an assumed group B; paddy months are left out", () => {
  const w = Array.from({ length: 12 }, () => 1);
  const half = Array.from({ length: 12 }, () => 0.5);
  assert.equal(stormInfiltration("sandy", half, w, []).hsg, "A");
  assert.equal(stormInfiltration("clayey", half, w, []).hsg, "D");
  const u = stormInfiltration("unknown", half, w, [6, 7]);
  assert.equal(u.hsg, "B");
  assert.equal(u.hsg_source, "assumed");
  assert.equal(u.by_month[5], null);
  assert.deepEqual(u.paddy_months, [6, 7]);
  assert.equal(stormInfiltration("loamy", half, w, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).share, null);
  assert.equal(stormInfiltration("loamy", half, [...w.slice(0, 11), null], []).share, null, "missing rain data: not computed");
});

test("rotation metrics carry the indicator; it is not a weighted score and explanations write it up", () => {
  const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50, forage: 50 };
  const details: LotDetails = { land_type: "upland", water: "rain", soil: "loamy" };
  const r = rotations({
    lot: { crops: [{ crop_id: "corn", seasons: [{ plant_month: 6, harvest_month: 9 }] }], details },
    data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
    library: CROP_LIBRARY_FIXTURE,
    priorities: EQUAL,
  });
  for (const o of r.options) {
    const s = o.metrics.infiltration.share;
    assert.ok(s !== null && s > 0 && s < 1, `${o.key}: ${s}`);
    assert.ok(!("infiltration" in o.scores));
  }
});
