/// <reference types="node" />
// Window size classes (#114).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsOf, sizeClassFor } from "./layout-core";

test("sizeClassFor: Material 3 window size classes at their edges", () => {
  assert.equal(sizeClassFor(360), "compact");
  assert.equal(sizeClassFor(599), "compact");
  assert.equal(sizeClassFor(600), "medium");
  assert.equal(sizeClassFor(839), "medium");
  assert.equal(sizeClassFor(840), "expanded");
  assert.equal(sizeClassFor(1440), "expanded");
});

test("rowsOf: fills rows left to right and keeps a short last row", () => {
  assert.deepEqual(rowsOf(["A", "B", "C", "D"], 2), [["A", "B"], ["C", "D"]]);
  assert.deepEqual(rowsOf(["A", "B", "C"], 2), [["A", "B"], ["C"]]);
  assert.deepEqual(rowsOf(["A", "B"], 1), [["A"], ["B"]]);
  assert.deepEqual(rowsOf([], 2), []);
});
