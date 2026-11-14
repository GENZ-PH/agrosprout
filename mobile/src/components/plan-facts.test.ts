/// <reference types="node" />
// The side-by-side facts table on the dashboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planFacts, planReasons } from "./plan-facts";

// A crop in the field all year, so every risk month counts.
const ALL_YEAR = [{ crop_id: "x", plant_month: 1, harvest_month: 12, season_days: 365, origin: "engine" }];
const plan = (
  total: number | null,
  m: Partial<{ bare_days: number; stress: number[]; heat: number[]; wet: number[]; families: string[]; legume_days: number; slots: unknown[] }>,
) =>
  ({
    total,
    slots: m.slots ?? ALL_YEAR,
    metrics: {
      bare_days: m.bare_days ?? 0,
      stress_months: m.stress ?? [],
      heat_months: m.heat ?? [],
      waterlog_months: m.wet ?? [],
      families: m.families ?? [],
      legume_days: m.legume_days ?? 0,
    },
  }) as unknown as Parameters<typeof planFacts>[0][number];

const row = (rows: ReturnType<typeof planFacts>, key: string) => rows.find((r) => r.key === key)!;

test("each fact is read from the plan's metrics", () => {
  const rows = planFacts([plan(57.4, { bare_days: 121, stress: [1, 2, 3], heat: [4], wet: [4, 7], families: ["Poaceae"], legume_days: 0 })]);
  assert.deepEqual(rows.map((r) => r.key), ["empty", "dry", "risk", "families", "legume", "score"]);
  assert.deepEqual(rows.map((r) => r.values[0]), [121, 3, 2, 1, 0, 57]);
});

test("fewer empty days and dry months win; more families, legume days and score win", () => {
  const rows = planFacts([
    plan(57, { bare_days: 121, stress: [1, 2, 3], families: ["Poaceae"], legume_days: 0 }),
    plan(86, { bare_days: 48, stress: [2], families: ["Poaceae", "Fabaceae"], legume_days: 65 }),
  ]);
  assert.deepEqual(row(rows, "empty").best, [false, true]);
  assert.deepEqual(row(rows, "dry").best, [false, true]);
  assert.deepEqual(row(rows, "families").best, [false, true]);
  assert.deepEqual(row(rows, "legume").best, [false, true]);
  assert.deepEqual(row(rows, "score").best, [false, true]);
});

test("ties share the mark, and a line where every plan is the same has none", () => {
  const rows = planFacts([plan(80, { bare_days: 48 }), plan(80, { bare_days: 48 }), plan(60, { bare_days: 90 })]);
  assert.deepEqual(row(rows, "empty").best, [true, true, false]);
  assert.deepEqual(row(rows, "risk").best, [false, false, false]);
});

test("a plan with no score shows as unknown and never wins", () => {
  const rows = planFacts([plan(null, {}), plan(70, {})]);
  assert.deepEqual(row(rows, "score").values, [null, 70]);
  assert.deepEqual(row(rows, "score").best, [false, true]);
});

test("reasons list only what changes against the farmer's crops now", () => {
  const base = plan(57, { bare_days: 121, stress: [1, 2, 3], families: ["Poaceae"], legume_days: 0 });
  const better = plan(86, {
    bare_days: 48,
    stress: [2],
    families: ["Poaceae", "Fabaceae", "Solanaceae"],
    legume_days: 65,
    slots: [...ALL_YEAR, { crop_id: "mungbean", plant_month: 4, harvest_month: 6, season_days: 65, origin: "engine" }],
  });
  const { gains, watch } = planReasons(better, base, (id) => id === "mungbean");
  assert.deepEqual(gains, [
    { key: "reason.cover", n: 73 },
    { key: "reason.legume", crop_id: "mungbean" },
    { key: "reason.dry", n: 2 },
    { key: "reason.families", n: 3, base: 1 },
  ]);
  assert.deepEqual(watch, []);
});

test("a plan that is worse on water or empty days says so", () => {
  const base = plan(57, { bare_days: 48, stress: [2] });
  const worse = plan(60, { bare_days: 150, stress: [1, 2, 3] });
  const { gains, watch } = planReasons(worse, base, () => false);
  assert.deepEqual(gains, []);
  assert.deepEqual(watch, [
    { key: "watch.dry", n: 2 },
    { key: "watch.empty", n: 102 },
  ]);
});

test("dry months with no crop in the field are not counted", () => {
  // In the field Jul and Aug only; a stress month in March is the empty field, not a crop.
  const rows = planFacts([plan(50, { stress: [3, 7], slots: [{ crop_id: "x", plant_month: 7, harvest_month: 8, season_days: 40, origin: "engine" }] })]);
  assert.equal(rows.find((r) => r.key === "dry")!.values[0], 1);
});
