/// <reference types="node" />
// Wording and priority-chip logic for the dashboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cropListText, formatHa, chosenPriorities, fitReasonText, mergeCropLines, togglePriority, unavailablePriorities, verdictText } from "./plan-text";

const EQUAL = { water: 50, soil: 50, income: 50, labor: 50, forage: 50 };

test("nothing is chosen at the default priorities", () => {
  assert.deepEqual(chosenPriorities(EQUAL), []);
});

test("tapping a chip chooses it and keeps the others counting a little", () => {
  const p = togglePriority(EQUAL, "water");
  assert.deepEqual(p, { water: 100, soil: 20, income: 20, labor: 20, forage: 20 });
  assert.deepEqual(chosenPriorities(p), ["water"]);
});

test("several chips can be chosen, and tapping the last one off returns to equal", () => {
  const two = togglePriority(togglePriority(EQUAL, "water"), "soil");
  assert.deepEqual(two, { water: 100, soil: 100, income: 20, labor: 20, forage: 20 });
  const one = togglePriority(two, "water");
  assert.deepEqual(one, { water: 20, soil: 100, income: 20, labor: 20, forage: 20 });
  assert.deepEqual(togglePriority(one, "soil"), EQUAL);
});

test("fit reasons name the months in order", () => {
  assert.equal(
    fitReasonText({ code: "water", months: [8, 9, 5, 6] }),
    "Rain covers too little of its water need in May to Jun and Aug to Sep in a typical year.",
  );
  assert.equal(fitReasonText({ code: "no-months", months: [] }), "We do not know its planting months yet.");
});

test("the same gap on several crops is said once", () => {
  const merged = mergeCropLines([
    { code: "a", text: "Scores use a typical year; a dry year or a wet year can turn out different." },
    { code: "b", text: "Eggplant: season length comes from FAO stage lengths, not a local value." },
    { code: "c", text: "Lowland rice: the crop library has no value for cover value, market, labor." },
    { code: "d", text: "Mungbean: the crop library has no value for cover value, market, labor." },
    { code: "e", text: "Eggplant: the crop library has no value for cover value, market, labor." },
  ]);
  assert.deepEqual(merged, [
    { code: "a", text: "Scores use a typical year; a dry year or a wet year can turn out different." },
    { code: "b", text: "Eggplant: season length comes from FAO stage lengths, not a local value." },
    { code: "c", text: "Lowland rice, Mungbean and Eggplant: the crop library has no value for cover value, market, labor." },
  ]);
});

test("two crops join with and; unrelated lines stay as they are", () => {
  assert.deepEqual(mergeCropLines([{ code: "a", text: "Rice: no value." }, { code: "b", text: "Corn: no value." }]), [
    { code: "a", text: "Rice and Corn: no value." },
  ]);
  assert.deepEqual(mergeCropLines([{ code: "a", text: "No harvest place is added yet." }]), [
    { code: "a", text: "No harvest place is added yet." },
  ]);
});

test("goals that only use scores the lot does not have are unavailable", () => {
  assert.deepEqual(unavailablePriorities([]), []);
  assert.deepEqual(unavailablePriorities(["I", "M", "L"]), ["income", "labor"]);
});

test("the verdict names the goals, the best plan, and the gap to the farmer's crops", () => {
  const base = { bestKey: "D", bestName: "Balanced", bestTotal: 88.6, baselineTotal: 72.2, bestIsBaseline: false };
  assert.equal(
    verdictText({ ...base, chosen: ["water"] }),
    "With Save water first, plan D (Balanced) fits best: 89 out of 100, 17 above your crops now.",
  );
  assert.equal(
    verdictText({ ...base, chosen: [] }),
    "With every goal counted the same, plan D (Balanced) fits best: 89 out of 100, 17 above your crops now.",
  );
  assert.equal(
    verdictText({ ...base, chosen: ["water", "soil"], baselineTotal: null }),
    "With Save water and Build soil first, plan D (Balanced) fits best: 89 out of 100.",
  );
});

test("the verdict says so when the farmer's own crops fit best, or nothing can be scored", () => {
  assert.equal(
    verdictText({ chosen: ["soil"], bestKey: "A", bestName: "Your crops", bestTotal: 70, baselineTotal: 70, bestIsBaseline: true }),
    "With Build soil first, your crops now already fit best: 70 out of 100.",
  );
  assert.equal(
    verdictText({ chosen: [], bestKey: "A", bestName: "Your crops", bestTotal: null, baselineTotal: null, bestIsBaseline: true }),
    "With every goal counted the same, the plans cannot be scored on this lot yet.",
  );
});

test("lot areas are rounded for people", () => {
  assert.equal(formatHa(72.56156326821265), "72.6 ha");
  assert.equal(formatHa(1), "1 ha");
  assert.equal(formatHa(0.49), "0.49 ha");
  assert.equal(formatHa(0.5), "0.5 ha");
  assert.equal(formatHa(10), "10 ha");
});

test("repeated crops in a plan are folded", () => {
  assert.equal(cropListText(["Rice", "Rice"]), "Rice \u00D72");
  assert.equal(cropListText(["Mungbean", "Rice", "Eggplant"]), "Mungbean, Rice, Eggplant");
  assert.equal(cropListText(["Corn", "Peanut", "Peanut", "Corn"]), "Corn, Peanut \u00D72, Corn");
});
