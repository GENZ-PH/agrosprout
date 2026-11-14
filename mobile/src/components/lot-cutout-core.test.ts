/// <reference types="node" />
// The lot cutout card (#134): the lot's shape, Now vs the best other option, one value per layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeLot, type LotAnalysis } from "../engine/analyze";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { SoilHealthResult } from "../engine";
import type { CutoutModel, PanelValue } from "./lot-cutout-core";
import type { CropLibrary, LonLat, Lot } from "../types";
import { FIT_COLORS, lotFitLevel, NO_RESULT_COLOR } from "./farm-map-core";
import { colors } from "./theme";
import {
  bestOtherOption,
  cropMonths,
  CUTOUT_LAYERS,
  cutoutComparison,
  cutoutLegend,
  cutoutModel,
  cutoutShade,
  cutoutShape,
  cutoutSummary,
  mixColor,
  NO_DATA_COLOR,
  optionFitLevel,
  rainPanel,
  shade,
  SOIL_CLASSES,
  soilPanel,
  wetnessPanel,
} from "./lot-cutout-core";

const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...path), "utf8")) as T;
const library = readJson<CropLibrary>("assets", "data", "crops.json");

const lot: Lot = {
  id: "lot-1",
  name: "Lot 1",
  geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
  area_ha: 2,
  centroid: [124.2405, 8.2303],
  details: { land_type: "lowland", water: "rain", soil: "loamy" },
  crops: [{ crop_id: "lowland-rice", seasons: [] }],
  data_status: "ready",
  data_ref: "lotdata:lot-1",
  travel: [],
};
const analysis: LotAnalysis = analyzeLot({
  farm: { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } },
  lot,
  data: ILIGAN_LOT_FIXTURE,
  library,
});

test("cutoutShape: fits the outline in the box, north up, and centres it", () => {
  // A 2:1 rectangle (east-west long) near the equator.
  const ring: LonLat[] = [[0, 0], [0.002, 0], [0.002, 0.001], [0, 0.001], [0, 0]];
  const s = cutoutShape(ring, 220, 160, 10);
  assert.ok(s);
  const nums = s.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  assert.equal(Math.min(...xs), 10);
  assert.equal(Math.max(...xs), 210);
  assert.equal(Math.min(...ys), 30, "100 px tall, centred in 160");
  assert.equal(Math.max(...ys), 130);
  // North up: the first point (lat 0, the south edge) is at the bottom.
  assert.equal(ys[0], 130);
  assert.match(s.path, / Z$/);
  assert.deepEqual([s.labelX, s.labelY], [110, 80]);
});

test("cutoutShape: no shape for fewer than 3 points or a box too small", () => {
  assert.equal(cutoutShape([[0, 0], [1, 1], [0, 0]], 100, 100, 5), null);
  assert.equal(cutoutShape([[0, 0], [1, 0], [1, 1], [0, 0]], 10, 100, 5), null);
});

test("bestOtherOption: the highest total that is not A, first on a tie", () => {
  const opts = [
    { key: "A" as const, total: 90 },
    { key: "B" as const, total: 60 },
    { key: "C" as const, total: 70 },
    { key: "D" as const, total: 70 },
  ];
  assert.equal(bestOtherOption(opts)?.key, "C");
  assert.equal(bestOtherOption([{ key: "A" as const, total: 50 }, { key: "B" as const, total: null }]), null);
});

test("soilPanel: value is the rounded year-3 index; color only says up, level or down", () => {
  const result = (end: number): SoilHealthResult =>
    ({
      start: 50,
      years: 3,
      options: [{ option_key: "A", trajectory: { points: [{ year: 0, value: 50 }, { year: 3, value: end }] }, vs_yours: null }],
    }) as unknown as SoilHealthResult;
  assert.deepEqual(soilPanel(result(56.4), "A"), {
    color: SOIL_CLASSES.up.color,
    value: "56",
    detail: "Year 3: 56 (up 6 from 50)",
    className: "Goes up",
    num: 56,
  });
  assert.equal(soilPanel(result(50.2), "A").className, "Stays level");
  assert.equal(soilPanel(result(41), "A").className, "Goes down");
  assert.equal(soilPanel(result(41), "B").missing, true, "an option with no line is No data");
});

test("soil health copy never says carbon, SOC or a percent", () => {
  const model = cutoutModel("soil", analysis, { lot, library });
  const words = JSON.stringify([model, cutoutLegend("soil"), CUTOUT_LAYERS]);
  assert.doesNotMatch(words, /carbon|\bSOC\b|%/i);
});

test("optionFitLevel: option A matches the farm map; other options run the engine check on their crops", () => {
  const a = analysis.rotations.options.find((o) => o.key === "A")!;
  assert.equal(optionFitLevel(a, analysis, { lot, library, monthly: analysis.monthly }), lotFitLevel(analysis.crop_fits));
  for (const o of analysis.rotations.options.filter((x) => x.key !== "A")) {
    const level = optionFitLevel(o, analysis, { lot, library, monthly: analysis.monthly });
    assert.ok(["good", "watch", "poor", "unknown"].includes(level), o.key);
  }
});

test("wetnessPanel: mean over the crop months, driest month named; missing months give No data", () => {
  const wet = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
  const p = wetnessPanel([1, 2, 3], wet);
  assert.equal(p.value, "0.60");
  assert.equal(p.color, shade(0.6));
  assert.match(p.detail, /driest Jan 0\.50/);
  assert.equal(wetnessPanel([1, 2], [null, ...wet.slice(1)]).missing, true);
});

test("rainPanel: dry-year rain in the crop months, shaded by its share of the year", () => {
  const p20 = Array.from({ length: 12 }, () => 100);
  const p = rainPanel([6, 7, 8], p20);
  assert.equal(p.value, "300 mm");
  assert.equal(p.color, shade(0.25));
  assert.match(p.detail, /25% of that year's rain/);
  assert.equal(rainPanel([6], [null, ...p20.slice(1)]).missing, true);
});

test("cropMonths: the months a crop is in the field, from the option's calendar", () => {
  const opt = { slots: [{ crop_id: "x", plant_month: 11, harvest_month: 2, season_days: 120, origin: "engine" as const }], metrics: { bare_months: [3, 4, 5, 6, 7, 8, 9, 10] } };
  assert.deepEqual(cropMonths(opt as never), [1, 2, 11, 12]);
});

test("cutoutModel: Now (A) next to the best other option, for every layer, on the Iligan data", () => {
  const best = bestOtherOption(analysis.rotations.options);
  for (const { key } of CUTOUT_LAYERS) {
    const m = cutoutModel(key, analysis, { lot, library });
    assert.equal(m.panels[0].key, "A", key);
    assert.equal(m.panels[0].title, "Your current crops");
    assert.equal(m.panels[0].option, "Option A: Your crops");
    if (best) assert.equal(m.panels[1].key, best.key, key);
    for (const p of m.panels) assert.ok(p.value.value && p.value.detail && p.value.color, `${key} ${p.key}`);
    assert.ok(cutoutSummary("Lot 1", key, m).startsWith("Lot 1, "));
  }
});

test("cutoutModel: same flag when both panels show the same value", () => {
  const twin = {
    ...analysis,
    rotations: {
      ...analysis.rotations,
      options: [
        analysis.rotations.options[0],
        { ...analysis.rotations.options[0], key: "B" as const, total: 1 },
      ],
    },
  };
  assert.equal(cutoutModel("rain", twin, { lot, library }).same, true);
});

test("legend and shade: class layers list classes plus No data; wetness and rain get a shade", () => {
  assert.deepEqual(cutoutLegend("fit").map((r) => r.color), [FIT_COLORS.good, FIT_COLORS.watch, FIT_COLORS.poor, FIT_COLORS.unknown, NO_DATA_COLOR]);
  assert.equal(cutoutLegend("soil").length, 4);
  assert.equal(cutoutShade("soil"), null);
  assert.deepEqual(cutoutShade("wetness")?.lowLabel, "0 dry");
  assert.equal(mixColor("#000000", "#FFFFFF", 0.5), "#808080");
  assert.equal(mixColor("#000000", "#FFFFFF", 2), "#FFFFFF");
});

test("No data never looks like a neutral result (#171)", () => {
  assert.notEqual(NO_DATA_COLOR, SOIL_CLASSES.level.color);
  assert.notEqual(NO_DATA_COLOR, FIT_COLORS.unknown);
  assert.notEqual(NO_DATA_COLOR, NO_RESULT_COLOR);
  assert.equal(NO_DATA_COLOR, colors.surface);
  assert.equal(cutoutLegend("soil").at(-1)?.missing, true);
});

// A two-panel model with the given panel values, for the comparison row (#171).
const pair = (cur: Partial<PanelValue>, oth: Partial<PanelValue>): CutoutModel => {
  const v = (x: Partial<PanelValue>): PanelValue => ({ color: "#000000", value: String(x.num), detail: "", className: "", num: null, ...x });
  return {
    panels: [
      { key: "A", title: "Your current crops", option: "Option A: Your crops", crops: "", value: v(cur) },
      { key: "C", title: "Best other option", option: "Option C: Best for soil", crops: "", value: v(oth) },
    ],
    same: false,
  };
};

test("cutoutComparison: soil health, current better, other better, tie", () => {
  const cur = cutoutComparison("soil", pair({ num: 63 }, { num: 62 }))!;
  assert.deepEqual(cur, {
    better: "current",
    diff: "−1 point",
    sign: -1,
    sentence: "Your current crops do better on soil health, by 1 point.",
  });
  const oth = cutoutComparison("soil", pair({ num: 50 }, { num: 56 }))!;
  assert.equal(oth.better, "other");
  assert.equal(oth.diff, "+6 points");
  assert.equal(oth.sentence, "Option C does better on soil health, by 6 points.");
  const tie = cutoutComparison("soil", pair({ num: 63 }, { num: 63 }))!;
  assert.equal(tie.better, "same");
  assert.equal(tie.diff, "No difference");
});

test("cutoutComparison: crop fit compares levels, never numbers; Not sure yet is not compared", () => {
  const up = cutoutComparison("fit", pair({ num: 0 }, { num: 2 }))!;
  assert.equal(up.better, "other");
  assert.equal(up.diff, "+2 levels");
  assert.equal(up.sentence, "Option C fits better, by two levels.");
  assert.equal(cutoutComparison("fit", pair({ num: 2 }, { num: 1 }))!.sentence, "Your current crops fit better, by one level.");
  assert.equal(cutoutComparison("fit", pair({ num: 1 }, { num: 1 }))!.better, "same");
  const unsure = cutoutComparison("fit", pair({ num: 2 }, { num: null }))!;
  assert.equal(unsure.diff, null);
  assert.match(unsure.sentence, /not sure yet/);
});

test("cutoutComparison: wetness and rain say more or less, never better", () => {
  const wet = cutoutComparison("wetness", pair({ num: 0.81 }, { num: 0.84 }))!;
  assert.equal(wet.better, null);
  assert.equal(wet.diff, "+0.03");
  assert.match(wet.sentence, /wetter, by 0\.03/);
  const rain = cutoutComparison("rain", pair({ num: 1240 }, { num: 1000 }))!;
  assert.equal(rain.better, null);
  assert.equal(rain.diff, "−240 mm");
  assert.match(rain.sentence, /240 mm less rain/);
});

test("cutoutComparison: missing data on either side can't be compared; one panel gives nothing", () => {
  for (const m of [pair({ num: null, missing: true }, { num: 5 }), pair({ num: 5 }, { num: null, missing: true })]) {
    const c = cutoutComparison("soil", m)!;
    assert.deepEqual([c.better, c.diff, c.sign], [null, null, null]);
    assert.equal(c.sentence, "Can't compare: data is missing for one of them.");
  }
  assert.equal(cutoutComparison("soil", { panels: pair({ num: 1 }, { num: 2 }).panels.slice(0, 1), same: false }), null);
});

test("cutoutComparison: on the Iligan data the row matches the values on the two shapes", () => {
  for (const { key } of CUTOUT_LAYERS) {
    const m = cutoutModel(key, analysis, { lot, library });
    const c = cutoutComparison(key, m);
    if (m.panels.length < 2) continue;
    assert.ok(c, key);
    const [a, b] = m.panels.map((p) => p.value.num);
    if (a !== null && b !== null) assert.equal(c.sign, Math.sign(Math.round((b - a) * 100) / 100) || 0, key);
  }
});
