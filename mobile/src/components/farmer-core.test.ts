/// <reference types="node" />
// Farmer-first suggestion card: plain reasons, the 12-month strip and the one check, all from engine output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeLot } from "../engine/analyze";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { CropLibrary, Lot } from "../types";
import { checkFirst, cropSequence, longerSeasons, PLAIN_GAIN, plainReasons, yearStrip } from "./farmer-core";
import { scoreRows, topPick } from "./recommendations-core";

const library = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "crops.json"), "utf8")) as CropLibrary;
const farm = { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } };
const lot: Lot = {
  id: "lot-1",
  name: "Lot 1",
  geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
  area_ha: 2,
  centroid: [124.2405, 8.2303],
  details: { land_type: "lowland", water: "rain", soil: "loamy" },
  crops: [{ crop_id: "lowland-rice", seasons: [] }],
  data_status: "ready",
  data_ref: "lotdata:lot-1",
  travel: [],
};
const analysis = analyzeLot({ farm, lot, data: ILIGAN_LOT_FIXTURE, library });
const options = analysis.rotations.options;
const a = options.find((o) => o.key === "A");
const pick = topPick(options);
const leftOut = analysis.rotations.components_left_out;

test("plainReasons: only real gains over your crops, biggest first, at most 3, both scores kept", () => {
  assert.ok(pick && a);
  const rs = plainReasons(pick, a, leftOut);
  assert.ok(rs.length <= 3);
  const rows = scoreRows(pick, a, leftOut);
  for (const r of rs) {
    const row = rows.find((x) => x.key === r.key);
    assert.ok(row && row.delta !== null && row.delta > 0, `${r.key} is a gain`);
    assert.equal(r.plan, row.value);
    assert.equal(r.yours, (row.value ?? 0) - row.delta);
    assert.equal(r.text, PLAIN_GAIN[r.key]);
    assert.ok(r.plan >= 0 && r.plan <= 100 && r.yours >= 0 && r.yours <= 100);
  }
  for (let i = 1; i < rs.length; i++) assert.ok(rs[i - 1].plan - rs[i - 1].yours >= rs[i].plan - rs[i].yours);
});

test("plainReasons: none for your own crops", () => {
  assert.ok(a);
  assert.deepEqual(plainReasons(a, a, leftOut), []);
  assert.deepEqual(plainReasons(a, undefined, leftOut), []);
});

test("yearStrip: 12 months, each empty or a crop of the plan", () => {
  for (const o of options) {
    const strip = yearStrip(o);
    assert.equal(strip.length, 12);
    const crops = new Set(o.slots.map((s) => s.crop_id));
    for (const c of strip) assert.ok(c === null || crops.has(c), `${o.key}: ${c}`);
  }
});

test("cropSequence and checkFirst: plain names from the plan, the engine's first check", () => {
  assert.ok(pick);
  const seq = cropSequence(pick, (id) => id.toUpperCase());
  for (const s of pick.slots) assert.ok(seq.includes(s.crop_id.toUpperCase()));
  const ex = analysis.explanations.find((e) => e.option_key === pick.key);
  assert.equal(checkFirst(ex), ex?.check_locally[0]?.text ?? null);
  assert.equal(checkFirst(undefined), null);
});

test("longerSeasons: says when the farmer's months are too short for the crop's season", () => {
  const byId = (id: string) => library.crops.find((c) => c.id === id);
  const rice = byId("lowland-rice");
  assert.ok(rice?.season_days);
  const short = longerSeasons({ crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 1, harvest_month: 3 }] }] }, byId);
  assert.equal(short.length, 1);
  assert.equal(short[0].days, rice.season_days);
  assert.match(short[0].given, /^Jan.*Mar$/);
  // Months that fit the crop's season (within 30%) are used as given, so no note.
  const months = Math.round((rice.season_days ?? 0) / 30.44);
  const fits = longerSeasons({ crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 6 + months }] }] }, byId);
  assert.equal(fits.length, 0);
});
