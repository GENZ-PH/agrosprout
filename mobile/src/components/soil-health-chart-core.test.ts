/// <reference types="node" />
// Pure helpers behind the 3-year Soil Health chart (#43).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LotDetails, Priorities } from "../types";
import { CROP_LIBRARY_FIXTURE } from "../engine/__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { RotationOption } from "../engine";
import { rotations } from "../engine/rotations";
import { soilHealth } from "../engine/soilHealth";
import { SHI_START, SHI_YEARS } from "../engine/params";
import {
  chartSummary,
  cropList,
  monthCells,
  optionNames,
  signed,
  soilHealthSummary,
  stepLabel,
  movesText,
  OPTION_LABELS,
  shiAxis,
  soilHealthRows,
  spreadLabels,
  xForYear,
  yForValue,
} from "./soil-health-chart-core";

const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50 };
const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };

/** Rice-rice-bare on the Iligan test lot (the demo's "current" rotation). */
function riceRiceBare() {
  return rotations({
    lot: {
      crops: [
        { crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] },
        { crop_id: "lowland-rice", seasons: [{ plant_month: 11, harvest_month: 3 }] },
      ],
      details: lowland,
    },
    data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
    library: CROP_LIBRARY_FIXTURE,
    priorities: EQUAL,
  });
}
const cropName = (id: string) => CROP_LIBRARY_FIXTURE.crops.find((c) => c.id === id)?.name ?? id;

test("y-axis: start ± 10 at least, widening in steps of 10 to fit the furthest line", () => {
  const flat = shiAxis([{ values: [50, 51, 52, 53] }, { values: null }]);
  assert.deepEqual(flat, { min: 40, start: SHI_START, max: 60, years: SHI_YEARS });
  assert.equal(shiAxis([]).min, 40);
  const wide = shiAxis([{ values: [50, 54, 58, 62] }, { values: [50, 47, 44, 41] }]);
  assert.deepEqual([wide.min, wide.max], [30, 70]);
  const most = shiAxis([{ values: [50, 60, 70, 80] }]);
  assert.deepEqual([most.min, most.max], [20, 80]);
});

test("x and y scales map the axis ends to the plot edges", () => {
  const box = { left: 30, right: 230, top: 10, bottom: 110 };
  const axis = shiAxis([]);
  assert.equal(xForYear(0, box), 30);
  assert.equal(xForYear(SHI_YEARS, box), 230);
  assert.equal(yForValue(axis.max, box, axis), 10);
  assert.equal(yForValue(axis.min, box, axis), 110);
  assert.ok(yForValue(SHI_START + 1, box, axis) < yForValue(SHI_START, box, axis), "higher value draws higher");
  assert.equal(yForValue(1000, box, axis), 10, "clamped to the plot");
});

test("spreadLabels keeps order, removes overlaps and stays inside the plot", () => {
  const ys = spreadLabels([50, 52, 51, 90], 14, 0, 100);
  const sorted = [...ys].sort((a, b) => a - b);
  for (let k = 1; k < sorted.length; k++) assert.ok(sorted[k] - sorted[k - 1] >= 14 - 1e-9);
  assert.ok(ys[0] < ys[2] && ys[2] < ys[1], "input order by y is kept (50 < 51 < 52)");
  const top = spreadLabels([98, 99, 100], 14, 0, 100);
  assert.ok(Math.max(...top) <= 100);
  assert.deepEqual(spreadLabels([], 14, 0, 100), []);
  assert.deepEqual(spreadLabels([5, 60], 14, 10, 100), [10, 60]);
});

test("monthCells: seasons wrap the year end, and the engine's bare months are bare", () => {
  const cells = monthCells({
    slots: [
      { crop_id: "rice", plant_month: 6, harvest_month: 9, season_days: 110, origin: "farmer" },
      { crop_id: "mungbean", plant_month: 11, harvest_month: 1, season_days: 65, origin: "engine" },
    ],
    metrics: { bare_months: [2, 3, 4, 5, 10] } as RotationOption["metrics"],
  });
  assert.equal(cells.length, 12);
  assert.deepEqual(
    cells.map((c) => c.kind),
    ["crop", "bare", "bare", "bare", "bare", "crop", "crop", "crop", "crop", "bare", "crop", "crop"],
  );
  assert.equal(cells[0].crop_id, "mungbean", "January is inside the Nov-Jan season");
  assert.equal(cells[6].crop_id, "rice");
  assert.equal(cells[2].crop_id, null);
});

test("rows on the Iligan lot: one per option, A first, and legume options sit above your crops", () => {
  const res = riceRiceBare();
  const shi = soilHealth(res.options);
  const rows = soilHealthRows(shi, res.options, cropName);
  assert.deepEqual(
    rows.map((r) => r.key),
    res.options.map((o) => o.key),
  );
  const a = rows[0];
  assert.equal(a.key, "A");
  assert.equal(a.title, OPTION_LABELS.A);
  assert.equal(a.vs_text, null);
  assert.equal(a.values?.[0], SHI_START);
  assert.equal(a.values?.length, SHI_YEARS + 1);
  assert.match(a.crops, /rice/i);
  assert.match(a.crops, /×2$/, "rice-rice shows rice once with its count");
  assert.equal(a.line?.length, SHI_YEARS + 1);
  for (const o of res.options.filter((x) => x.key !== "A" && x.metrics.legume_days > 0)) {
    const row = rows.find((r) => r.key === o.key);
    assert.ok((row?.vs_yours as number) > 0, `${o.key}: ${row?.vs_text}`);
    assert.match(row?.vs_text ?? "", /above your crops/);
  }
});

test("every word the chart shows avoids %, nitrogen and carbon claims (gap F1)", () => {
  const res = riceRiceBare();
  const shi = soilHealth(res.options);
  const rows = soilHealthRows(shi, res.options, cropName);
  const words = [chartSummary(shi, rows), ...rows.flatMap((r) => [r.summary, r.vs_text ?? "", movesText(r) ?? ""])];
  for (const w of words) {
    assert.doesNotMatch(w, /%/);
    assert.doesNotMatch(w, /nitrogen|carbon/i);
  }
  assert.match(chartSummary(shi, rows), /relative indicator from this model/);
});

test("an option with no line says why, and the summary and moves text say so too", () => {
  const shi = soilHealth([
    { key: "A", scores: { W: 50, H: 50, S: 20, E: 60, B: 0, I: null, M: null, L: null } },
    { key: "C", scores: { W: 50, H: 50, S: null, E: 90, B: 0, I: null, M: null, L: null } },
  ]);
  const rows = soilHealthRows(shi, []);
  assert.equal(rows[1].end, null);
  assert.equal(rows[1].vs_text, null);
  assert.match(rows[1].summary, /missing/);
  assert.equal(movesText(rows[1]), null);
  assert.match(chartSummary(shi, rows), /Best for soil: no line/);
  // A: +2 a year from S = 20, -4 a year from E = 60 (alpha = beta = 10), so it goes down.
  assert.match(rows[0].summary, /^Year 3: \d+ \(down \d+\)$/);
  assert.equal(movesText(rows[0]), "+2 from building soil, −4 from rain on bare soil");
});

test("the gap to your crops is worked out from the rounded ends shown on screen", () => {
  // A ends at 52.3 (shown 52); C ends at 54.6 (shown 55). The engine gap is 2.3, the screen says 3.
  const shi = soilHealth([
    { key: "A", scores: { W: 50, H: 50, S: 30, E: 77.67, B: 0, I: null, M: null, L: null } },
    { key: "C", scores: { W: 50, H: 50, S: 30, E: 85.33, B: 0, I: null, M: null, L: null } },
  ]);
  const [a, c] = soilHealthRows(shi, []);
  assert.equal(a.end, 52);
  assert.equal(c.end, 55);
  assert.equal(c.vs_yours, 3);
  assert.equal(c.vs_text, "3 above your crops");
});

test("cropList: each crop once in planting order, with a count when repeated", () => {
  assert.equal(cropList(["Mungbean", "Rice", "Rice"]), "Mungbean, Rice ×2");
  assert.equal(cropList(["Rice"]), "Rice");
  assert.equal(cropList([]), "");
});

test("vs text: above, below and the same", () => {
  const shi = soilHealth([
    { key: "A", scores: { W: 50, H: 50, S: 50, E: 50, B: 0, I: null, M: null, L: null } },
    { key: "B", scores: { W: 50, H: 50, S: 20, E: 50, B: 0, I: null, M: null, L: null } },
    { key: "C", scores: { W: 50, H: 50, S: 90, E: 50, B: 0, I: null, M: null, L: null } },
    { key: "D", scores: { W: 50, H: 50, S: 50, E: 50, B: 0, I: null, M: null, L: null } },
  ]);
  const rows = soilHealthRows(shi, []);
  assert.equal(rows[0].summary, "Year 3: 50 (no change)");
  assert.equal(rows[1].vs_text, "9 below your crops");
  assert.equal(rows[2].vs_text, "12 above your crops");
  assert.equal(rows[3].vs_text, "Same as your crops");
  assert.equal(rows[1].crops, "No crops");
});

test("summary names the highest last-year value and keeps ties", () => {
  const rows = [
    { key: "A" as const, end: 63 },
    { key: "B" as const, end: 53 },
    { key: "C" as const, end: 63 },
    { key: "D" as const, end: 62 },
  ];
  const s = soilHealthSummary({ start: 50 }, rows);
  assert.deepEqual(s, { start: 50, best: 63, best_keys: ["A", "C"], change: 13 });
  assert.equal(optionNames(s.best_keys), "Your crops and Best for soil");
});

test("summary skips options with no line and is empty when none has one", () => {
  const s = soilHealthSummary({ start: 50 }, [
    { key: "A" as const, end: null },
    { key: "B" as const, end: 48 },
  ]);
  assert.deepEqual(s, { start: 50, best: 48, best_keys: ["B"], change: -2 });
  assert.deepEqual(soilHealthSummary({ start: 50 }, [{ key: "A" as const, end: null }]), {
    start: 50,
    best: null,
    best_keys: [],
    change: null,
  });
});

test("summary uses the engine's real output, not sample numbers", () => {
  const opts = riceRiceBare().options;
  const result = soilHealth(opts);
  const rows = soilHealthRows(result, opts);
  const s = soilHealthSummary(result, rows);
  assert.equal(s.start, SHI_START);
  const ends = rows.map((r) => r.end).filter((e): e is number => e !== null);
  assert.equal(s.best, Math.max(...ends));
  for (const k of s.best_keys) assert.equal(rows.find((r) => r.key === k)?.end, s.best);
});

test("signed change, option names and step labels", () => {
  assert.equal(signed(13), "+13");
  assert.equal(signed(-2), "−2");
  assert.equal(signed(0), "0");
  assert.equal(optionNames(["C"]), "Best for soil");
  assert.equal(optionNames(["A", "C", "D"]), "Your crops, Best for soil and Balanced");
  assert.equal(stepLabel(0), "Start");
  assert.equal(stepLabel(SHI_YEARS), `Year ${SHI_YEARS}`);
});
