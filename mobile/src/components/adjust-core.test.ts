import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PRIORITIES } from "../state/farm-core";
import { adjustSummary } from "./adjust-core";

test("adjustSummary: null when nothing is changed", () => {
  assert.equal(adjustSummary(DEFAULT_PRIORITIES, null), null);
});

test("adjustSummary: picked goals, then the what-if", () => {
  const p = { ...DEFAULT_PRIORITIES, water: 100 };
  assert.equal(adjustSummary(p, null), "Save water");
  assert.equal(adjustSummary(p, { rain_pct: -20, temp_c: 1 }), "Save water; what-if: 20% less rain and 1 °C warmer");
  assert.equal(adjustSummary(DEFAULT_PRIORITIES, { rain_pct: 0, temp_c: 2 }), "what-if: 2 °C warmer");
});
