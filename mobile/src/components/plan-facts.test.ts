/// <reference types="node" />
// The side-by-side facts table on the dashboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planFacts } from "./plan-facts";

const plan = (total: number | null, m: Partial<{ bare_days: number; stress: number[]; heat: number[]; wet: number[]; families: string[]; legume_days: number }>) =>
  ({
    total,
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
