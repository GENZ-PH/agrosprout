/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RotationSlot } from "../engine/scores";
import { monthStates, nowSummary } from "./season-guide-core";

const slot = (crop_id: string, plant_month: number, harvest_month: number, season_days: number): RotationSlot => ({
  crop_id,
  plant_month,
  harvest_month,
  season_days,
  origin: "engine",
});
// The sample paddy lot's balanced plan: mungbean Apr-Jun, rice Jul-Nov, eggplant Nov-Apr.
const plan = {
  slots: [slot("mungbean", 4, 6, 65), slot("lowland-rice", 7, 11, 120), slot("eggplant", 11, 4, 150)],
  metrics: { stress_months: [1, 2, 3, 6], heat_months: [], waterlog_months: [8] } as never,
};

test("monthStates: planting, harvest and crops in the field per month", () => {
  const s = monthStates(plan);
  assert.equal(s.length, 12);
  assert.deepEqual(s[10].plant, ["eggplant"]);
  assert.deepEqual(s[10].harvest, ["lowland-rice"]);
  assert.deepEqual(s[8].field, ["lowland-rice"]);
  assert.deepEqual(s[0].risks, ["dry"]);
  assert.deepEqual(s[7].risks, ["wet"]);
});

test("nowSummary: November plants eggplant, harvests rice, and points to the next planting", () => {
  const n = nowSummary(plan, 11);
  assert.deepEqual(n.plant, ["eggplant"]);
  assert.deepEqual(n.harvest, ["lowland-rice"]);
  assert.deepEqual(n.next, { crop_id: "mungbean", month: 4, inMonths: 5 });
});

test("nowSummary: a growing month names the crop and its harvest month", () => {
  const n = nowSummary(plan, 9);
  assert.deepEqual(n.growing, [{ crop_id: "lowland-rice", harvest_month: 11 }]);
  assert.deepEqual(n.plant, []);
  assert.deepEqual(n.next, { crop_id: "eggplant", month: 11, inMonths: 2 });
});
