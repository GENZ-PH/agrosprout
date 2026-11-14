/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { COMPONENT_KEYS, priorityWeights, type ComponentKey } from "../engine/scores";
import { DEFAULT_PRIORITIES } from "../state/farm-core";
import type { Priorities } from "../types";
import { chipList, isPicked, pickedButNotScored, PRIORITY_CHIPS, togglePriority } from "./priorities-core";

const equal: Priorities = { ...DEFAULT_PRIORITIES };

test("no chip is picked at the equal defaults; tapping picks it, tapping again goes back to the default", () => {
  assert.deepEqual(
    PRIORITY_CHIPS.filter((c) => isPicked(equal, c.key)),
    [],
  );
  const patch = togglePriority(equal, "water");
  const picked = { ...equal, ...patch };
  assert.equal(isPicked(picked, "water"), true);
  assert.equal(isPicked(picked, "soil"), false);
  assert.deepEqual(togglePriority(picked, "water"), { water: DEFAULT_PRIORITIES.water });
});

test("picking Save water raises the water components' weight (W, H) in the engine", () => {
  // Only water and soil can be scored here (no market, income or labor data), like a lot today.
  const available = new Set<ComponentKey>(COMPONENT_KEYS.filter((k) => k !== "I" && k !== "M" && k !== "L"));
  const before = priorityWeights(equal, available).weights;
  const after = priorityWeights({ ...equal, ...togglePriority(equal, "water") }, available).weights;
  assert.ok(after.W > before.W && after.H > before.H);
  assert.ok(after.S < before.S);
});

test("a picked chip with no data behind it is reported, so the card can say why it doesn't count yet", () => {
  const p: Priorities = { ...equal, income: 100, water: 100 };
  assert.deepEqual(
    pickedButNotScored(p, ["income", "labor"]).map((c) => c.key),
    ["income"],
  );
  assert.deepEqual(pickedButNotScored(equal, ["income", "labor"]), []);
});

test("chip lists read as plain English", () => {
  assert.equal(chipList([]), "");
  assert.equal(chipList([{ label: "Extra income" }]), "Extra income");
  assert.equal(chipList([{ label: "Extra income" }, { label: "Less work" }]), "Extra income and Less work");
});
