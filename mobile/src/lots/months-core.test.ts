/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { cellState, monthRange, pickMonth, seasonLabel, seasonsText, usualSeasons } from "./months-core";

test("a season's months run across the new year when needed", () => {
  assert.deepEqual(monthRange(6, 10), [6, 7, 8, 9, 10]);
  assert.deepEqual(monthRange(11, 3), [11, 12, 1, 2, 3]);
  assert.deepEqual(monthRange(12, 1), [12, 1]);
});

test("first tap is the planting month, second tap the harvest month; the same month twice is refused", () => {
  const first = pickMonth(null, 6);
  assert.deepEqual(first, { kind: "draft", draft: { plant: 6 } });
  assert.deepEqual(pickMonth({ plant: 6 }, 6), { kind: "same-month", draft: { plant: 6 } });
  assert.deepEqual(pickMonth({ plant: 11 }, 3), { kind: "season", season: { plant_month: 11, harvest_month: 3 } });
});

test("cells show planting, growing and harvest months; a draft shows only its planting month", () => {
  const s = { plant_month: 11, harvest_month: 2 };
  assert.equal(cellState(11, s, null), "plant");
  assert.equal(cellState(1, s, null), "growing");
  assert.equal(cellState(2, s, null), "harvest");
  assert.equal(cellState(6, s, null), "none");
  assert.equal(cellState(11, s, { plant: 4 }), "none");
  assert.equal(cellState(4, s, { plant: 4 }), "plant");
  assert.equal(cellState(4, null, null), "none");
});

test("labels and the crop's usual months", () => {
  assert.equal(seasonLabel({ plant_month: 6, harvest_month: 10 }), "Jun → Oct");
  const usual = usualSeasons({
    typical_calendar: [
      { plant_month: 6, harvest_month: 10 },
      { plant_month: 11, harvest_month: 3 },
    ],
  } as never);
  assert.deepEqual(usual, [
    { plant_month: 6, harvest_month: 10 },
    { plant_month: 11, harvest_month: 3 },
  ]);
  assert.equal(seasonsText(usual).replaceAll("\u2060", ""), "Jun–Oct and Nov–Mar");
  assert.equal(seasonsText([]), "");
});
