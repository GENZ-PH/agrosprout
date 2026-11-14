/// <reference types="node" />
// The Lot details questions (#41) as data: complete, safe to default, and understood by the engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lot, LotDetails } from "../types";
import { CROP_LIBRARY_FIXTURE } from "../engine/__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import { analyzeLot } from "../engine/analyze";
import {
  LOT_DETAILS_INTRO,
  LOT_DETAIL_QUESTIONS,
  NO_DETAILS,
  answeredCount,
  answeredSummary,
  setDetail,
} from "./lot-details-options";

test("three questions: land type, water and soil, in the order of #41", () => {
  assert.deepEqual(LOT_DETAIL_QUESTIONS.map((q) => q.key), ["land_type", "water", "soil"]);
});

test("every question offers its three real answers and \"I don't know\" last", () => {
  const expected: Record<string, string[]> = {
    land_type: ["lowland", "upland", "sloping", "unknown"],
    water: ["rain", "some", "full", "unknown"],
    soil: ["sandy", "loamy", "clayey", "unknown"],
  };
  for (const q of LOT_DETAIL_QUESTIONS) {
    assert.deepEqual(q.options.map((o) => o.value), expected[q.key], q.key);
    assert.equal(q.options[q.options.length - 1].label, "I don't know");
    assert.equal(new Set(q.options.map((o) => o.label)).size, q.options.length, "labels are distinct");
  }
});

test("a new lot starts with every answer unknown, and that counts as zero answered", () => {
  assert.deepEqual(NO_DETAILS, { land_type: "unknown", water: "unknown", soil: "unknown" });
  assert.equal(answeredCount(NO_DETAILS), 0);
  assert.equal(answeredSummary(NO_DETAILS), "0 of 3 answered");
});

test("setDetail changes one answer, returns a new object and leaves the input alone", () => {
  const before: LotDetails = { ...NO_DETAILS };
  const next = setDetail(before, "water", "some");
  assert.deepEqual(next, { land_type: "unknown", water: "some", soil: "unknown" });
  assert.deepEqual(before, NO_DETAILS);
  assert.notEqual(next, before);
  assert.equal(answeredCount(next), 1);
  assert.equal(answeredSummary(setDetail(setDetail(next, "soil", "loamy"), "land_type", "sloping")), "3 of 3 answered");
  // Choosing "I don't know" again takes the answer back.
  assert.equal(answeredCount(setDetail(next, "water", "unknown")), 0);
});

test("every offered answer is understood by the engine, for every question", () => {
  const lot = (details: LotDetails): Lot => ({
    id: "lot-1",
    name: "Lot 1",
    geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
    area_ha: 2,
    centroid: [124.2405, 8.2303],
    details,
    crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] }],
    data_status: "ready",
    data_ref: "lotdata:lot-1",
    travel: [],
  });
  for (const q of LOT_DETAIL_QUESTIONS) {
    for (const o of q.options) {
      const a = analyzeLot({
        farm: { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } },
        lot: lot(setDetail(NO_DETAILS, q.key, o.value)),
        data: ILIGAN_LOT_FIXTURE,
        library: CROP_LIBRARY_FIXTURE,
      });
      assert.ok(a.rotations.options.length > 0, `${q.key}=${o.value}`);
    }
  }
});

test("the texts follow the project rules: no banned word, no invented number, plain language", () => {
  const all = JSON.stringify([LOT_DETAILS_INTRO, LOT_DETAIL_QUESTIONS]);
  assert.doesNotMatch(all, /\bA\.?I\b/);
  assert.doesNotMatch(all, /\d/, "no numbers in the farmer-facing texts");
  assert.match(LOT_DETAILS_INTRO, /optional/);
  assert.match(LOT_DETAILS_INTRO, /lower confidence/);
});
