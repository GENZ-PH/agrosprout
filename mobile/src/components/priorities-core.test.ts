/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { COMPONENT_KEYS, priorityWeights, type ComponentKey } from "../engine/scores";
import { DEFAULT_PRIORITIES } from "../state/farm-core";
import type { Priorities } from "../types";
import { chipList, isPicked, notScoredNote, pickedButNotScored, PRIORITY_CHIPS, togglePriority } from "./priorities-core";

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

test("the note under the chips names the hidden priorities and why", () => {
  assert.equal(notScoredNote([]), null);
  assert.equal(
    notScoredNote(["income", "labor"]),
    "Extra income and Less work are not shown yet: the crop list has no local prices or labor needs, so they would change nothing. " +
      "Add a place where you sell or store your harvest and they come back, counting how easy the trip to market is.",
  );
  assert.match(notScoredNote(["income"]) ?? "", /^Extra income is not shown yet: .* and it comes back, /);
});
