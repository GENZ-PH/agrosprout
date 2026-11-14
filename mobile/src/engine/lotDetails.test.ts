/// <reference types="node" />
// Optional lot details (#41): land type, water source and soil feel. Every answer defaults to
// "unknown". These tests go through analyzeLot(), the way the screens will, and check the two
// acceptance items: changing a detail changes the relevant scores and explanations, and
// skipping all of them still works (with a lower confidence badge).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lot, LotDetails } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { analyzeLot, type LotAnalysis } from "./analyze";
import { CONFIDENCE_LOW_UNKNOWN_INPUTS } from "./params";

const UNKNOWN: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown" };
const KNOWN: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };

function lot(details: LotDetails, crops: Lot["crops"]): Lot {
  return {
    id: "lot-1",
    name: "Lot 1",
    geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
    area_ha: 2,
    centroid: [124.2405, 8.2303],
    details,
    crops,
    data_status: "ready",
    data_ref: "lotdata:lot-1",
    travel: [],
  };
}

const RICE_AND_CORN: Lot["crops"] = [
  { crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] },
  { crop_id: "corn", seasons: [{ plant_month: 2, harvest_month: 5 }] },
];
const CORN_ONLY: Lot["crops"] = [{ crop_id: "corn", seasons: [{ plant_month: 2, harvest_month: 5 }] }];

const run = (details: LotDetails, crops: Lot["crops"] = RICE_AND_CORN): LotAnalysis =>
  analyzeLot({
    farm: { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } },
    lot: lot(details, crops),
    data: ILIGAN_LOT_FIXTURE,
    library: CROP_LIBRARY_FIXTURE,
  });

const yoursScore = (a: LotAnalysis, k: "W" | "E" | "H") => a.rotations.options[0].scores[k] as number;
const unknownCodes = (a: LotAnalysis) => a.explanations.flatMap((e) => e.unknowns.map((u) => u.code));
const levels = (a: LotAnalysis) => a.explanations.map((e) => e.confidence.level);

test("skipping every detail still works: results, finite scores, and a Low confidence badge", () => {
  const a = run(UNKNOWN);
  assert.ok(a.rotations.options.length >= 2);
  for (const o of a.rotations.options) {
    for (const v of Object.values(o.scores)) assert.ok(v === null || Number.isFinite(v));
  }
  assert.ok(a.crop_fits.every((f) => f.level !== undefined));
  assert.deepEqual(new Set(levels(a)), new Set(["low"]));
  // The three questions are listed as unknown, so the screen can say what the farmer could answer.
  for (const code of ["unknown.land-type", "unknown.water", "unknown.soil"]) assert.ok(unknownCodes(a).includes(code), code);
});

test("answering the details raises confidence, and one unknown answer is not yet Low", () => {
  assert.ok(!levels(run(KNOWN)).includes("low"));
  const oneUnknown = run({ ...KNOWN, water: "unknown" });
  assert.ok(!levels(oneUnknown).includes("low"), "one unknown input gives Medium, not Low");
  const two = run({ land_type: "unknown", water: "unknown", soil: "loamy" });
  assert.equal(CONFIDENCE_LOW_UNKNOWN_INPUTS, 2);
  assert.ok(levels(two).every((l) => l === "low"), "two unknown inputs give Low");
});

test("answering a detail removes its 'not given' line from the explanations", () => {
  const a = run(KNOWN);
  for (const code of ["unknown.land-type", "unknown.water", "unknown.soil"]) assert.ok(!unknownCodes(a).includes(code), code);
});

test("soil feel changes water fit only when paddy rice is in the rotation (clayey holds water, sandy loses it)", () => {
  const sandy = yoursScore(run({ ...KNOWN, soil: "sandy" }), "W");
  const loamy = yoursScore(run({ ...KNOWN, soil: "loamy" }), "W");
  const clayey = yoursScore(run({ ...KNOWN, soil: "clayey" }), "W");
  assert.ok(sandy < loamy && loamy < clayey, `sandy ${sandy}, loamy ${loamy}, clayey ${clayey}`);
  // The farmer's own crops are corn only: no paddy, so soil feel does not enter option A's water balance.
  assert.equal(yoursScore(run({ ...KNOWN, soil: "sandy" }, CORN_ONLY), "W"), yoursScore(run({ ...KNOWN, soil: "clayey" }, CORN_ONLY), "W"));
});

test("water source changes water fit and the crop fit: rain only < some irrigation < full irrigation", () => {
  const rain = run({ ...KNOWN, water: "rain" });
  const some = run({ ...KNOWN, water: "some" });
  const full = run({ ...KNOWN, water: "full" });
  assert.ok(yoursScore(rain, "W") < yoursScore(some, "W") && yoursScore(some, "W") < yoursScore(full, "W"));
  const worst = (a: LotAnalysis) => a.crop_fits.map((f) => ["good", "unknown", "watch", "poor"].indexOf(f.level));
  assert.ok(Math.max(...worst(full)) <= Math.max(...worst(rain)), "full irrigation never makes a crop fit worse");
  assert.ok(full.crop_fits.some((f, i) => f.level !== rain.crop_fits[i].level), "full irrigation changes at least one crop's fit");
  // "unknown" is treated as rain only, and says so.
  assert.equal(yoursScore(run({ ...KNOWN, water: "unknown" }), "W"), yoursScore(rain, "W"));
});

test("land type changes the erosion score: a slope loses more soil than flat land, 'unknown' sits in the middle", () => {
  const lowland = yoursScore(run({ ...KNOWN, land_type: "lowland" }), "E");
  const upland = yoursScore(run({ ...KNOWN, land_type: "upland" }), "E");
  const sloping = yoursScore(run({ ...KNOWN, land_type: "sloping" }), "E");
  const unknown = yoursScore(run({ ...KNOWN, land_type: "unknown" }), "E");
  assert.ok(sloping < upland && upland < lowland, `sloping ${sloping}, upland ${upland}, lowland ${lowland}`);
  assert.ok(sloping < unknown && unknown < lowland, "unknown uses a middle value, between sloping and lowland");
});

test("changing a detail does not move scores it has nothing to do with", () => {
  const a = run({ ...KNOWN, land_type: "lowland" });
  const b = run({ ...KNOWN, land_type: "sloping" });
  assert.equal(yoursScore(a, "W"), yoursScore(b, "W"));
  assert.equal(yoursScore(a, "H"), yoursScore(b, "H"));
});
