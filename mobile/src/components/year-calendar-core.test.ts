import assert from "node:assert/strict";
import { test } from "node:test";
import { listNames, RISK_TIPS, tileLabel, yearCalendarLines } from "./year-calendar-core";
import type { MonthState } from "./season-guide-core";

const name = (id: string) => ({ rice: "Lowland rice", sorghum: "Sorghum", corn: "Corn" })[id as "rice"] ?? id;
const month = (over: Partial<MonthState>): MonthState => ({ month: 11, plant: [], harvest: [], field: [], risks: [], ...over });

test("lists read naturally", () => {
  assert.equal(listNames([]), "");
  assert.equal(listNames(["Sorghum"]), "Sorghum");
  assert.equal(listNames(["Sorghum", "Corn"]), "Sorghum and Corn");
  assert.equal(listNames(["Sorghum", "Corn", "Rice"]), "Sorghum, Corn and Rice");
});

test("a month with a planting, a harvest and a dry risk gives the three lines of the screenshot", () => {
  const lines = yearCalendarLines(month({ plant: ["sorghum"], harvest: ["rice"], field: ["sorghum", "rice"], risks: ["dry"] }), name);
  assert.deepEqual(lines.map((l) => l.text), ["Plant Sorghum.", "Harvest Lowland rice.", RISK_TIPS.dry]);
});

test("a crop that is only growing is said to be in the field", () => {
  const lines = yearCalendarLines(month({ field: ["corn"] }), name);
  assert.deepEqual(lines.map((l) => l.text), ["Corn in the field."]);
});

test("an empty month says the soil is bare", () => {
  const lines = yearCalendarLines(month({}), name);
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /^Nothing planted\. Bare soil/);
});

test("no risk line appears for a month without risk", () => {
  const lines = yearCalendarLines(month({ plant: ["corn"], field: ["corn"] }), name);
  assert.ok(lines.every((l) => !l.tone.startsWith("risk")));
});

test("a month tile says in words what its icons show, for screen readers (#45)", () => {
  assert.equal(
    tileLabel(month({ plant: ["sorghum"], harvest: ["rice"], field: ["sorghum", "rice"], risks: ["dry", "hot"] }), "November", name, true),
    "November, now: plant Sorghum; harvest Lowland rice; short of water; too hot",
  );
  assert.equal(tileLabel(month({ field: ["corn"], risks: ["wet"] }), "July", name), "July: Corn in the field; too wet");
  assert.equal(tileLabel(month({}), "March", name), "March: bare soil");
});
