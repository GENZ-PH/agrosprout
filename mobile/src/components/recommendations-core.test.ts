/// <reference types="node" />
// Texts behind the dashboard's "Your crops here" and "Recommendations" cards (#29).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfidenceReason, FitReason, FitReasonCode } from "../engine";
import { analyzeLot } from "../engine/analyze";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { CropLibrary, Lot, LotCrop } from "../types";
import {
  sameCropsAs,
  topPick,
  confidenceReasonText,
  deltaText,
  FIT_LABELS,
  fitReasonText,
  fitSeasonsText,
  monthList,
  optionCropsText,
  optionSummary,
  scoreRows,
  shortCropName,
} from "./recommendations-core";

const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...path), "utf8")) as T;
const library = readJson<CropLibrary>("assets", "data", "crops.json");
const farm = { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } };
const cropName = (id: string) => library.crops.find((c) => c.id === id)?.name ?? id;

function lot(crops: LotCrop[]): Lot {
  return {
    id: "lot-1",
    name: "Lot 1",
    geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
    area_ha: 2,
    centroid: [124.2405, 8.2303],
    details: { land_type: "lowland", water: "rain", soil: "loamy" },
    crops,
    data_status: "ready",
    data_ref: "lotdata:lot-1",
    travel: [],
  };
}

/** A filled-in text: no leftover "undefined", "NaN" or "null" from a missing value. */
function assertClean(s: string, what: string) {
  assert.ok(s.trim().length > 0, `${what} is empty`);
  assert.doesNotMatch(s, /undefined|NaN|null/, `${what}: "${s}"`);
}

test("monthList: one, two and three months read like a sentence", () => {
  assert.equal(monthList([6]), "Jun");
  assert.equal(monthList([6, 7]), "Jun and Jul");
  assert.equal(monthList([11, 12, 1]), "Nov, Dec and Jan");
  assert.equal(monthList([]), "");
});

test("shortCropName: drops the part in brackets so option rows fit a phone", () => {
  assert.equal(shortCropName("Lowland rice (irrigated or rainfed paddy)"), "Lowland rice");
  assert.equal(shortCropName("Mungbean"), "Mungbean");
});

test("fitReasonText: water reasons show the engine's share and stress months", () => {
  const r: FitReason = { code: "water", level: "watch", months: [3, 4], value: 0.347, limit: 0.2 };
  assert.equal(fitReasonText(r), "In a typical year, 35% of its water need is not covered (short in Mar and Apr).");
  const dry: FitReason = { code: "dry-year", level: "watch", months: [], value: 0.71, limit: 0.6 };
  assert.equal(fitReasonText(dry), "Fine in a typical year, but in a dry year 71% of its water need is not covered.");
});

test("fitReasonText: temperature reasons give the monthly mean and the crop's own limit", () => {
  const hot: FitReason = { code: "too-hot", level: "poor", months: [5], value: 36.24, limit: 35 };
  assert.equal(fitReasonText(hot), "Too hot in May: the average reaches 36.2 °C, above its limit of 35 °C.");
  const cool: FitReason = { code: "cool", level: "watch", months: [1, 2], value: 19.5, limit: 20 };
  assert.match(fitReasonText(cool), /^Cooler than it likes in Jan and Feb: .*19\.5 °C.*from 20 °C/);
});

test("fitReasonText: every reason code gives a clean sentence, with and without numbers", () => {
  const codes: FitReasonCode[] = ["water", "dry-year", "too-hot", "too-cold", "warm", "cool", "waterlogging", "no-crop-data", "no-months", "missing-climate"];
  for (const code of codes) {
    assertClean(fitReasonText({ code, level: "watch", months: [7], value: 0.5, limit: 0.4 }), code);
    assertClean(fitReasonText({ code, level: "unknown", months: [], value: null, limit: null }), `${code} (no numbers)`);
  }
});

test("confidenceReasonText: every reason the engine can give has a sentence", () => {
  const reasons: ConfidenceReason[] = ["ranking-flips-dry-wet", "dry-wet-not-checked", "unknown-inputs", "one-unknown-input", "scores-missing", "crop-data-missing", "water-not-scored"];
  for (const r of reasons) assertClean(confidenceReasonText(r), r);
});

test("optionCropsText: one crop after another reads 'then'; crops sharing the field are grouped per crop", () => {
  const slot = (crop_id: string, plant_month: number, harvest_month: number, season_days: number) =>
    ({ crop_id, plant_month, harvest_month, season_days, origin: "engine" as const });
  // Rice May 15 + 120 days ends mid-September; eggplant goes in on Sep 15: no shared day.
  const sequence = { slots: [slot("lowland-rice", 5, 9, 120), slot("eggplant", 9, 2, 150)] };
  assert.equal(optionCropsText(sequence, cropName), "Lowland rice May–Sep, then Eggplant Sep–Feb");
  // Typical calendars: mungbean May–Jul is still in the field when rice goes in on Jun 15.
  const together = { slots: [slot("mungbean", 2, 4, 65), slot("mungbean", 5, 7, 65), slot("lowland-rice", 6, 10, 120)] };
  assert.equal(optionCropsText(together, cropName), "Mungbean Feb–Apr and May–Jul · Lowland rice Jun–Oct");
  // A slot that runs over the new year still overlaps one planted in January.
  const wrap = { slots: [slot("lowland-rice", 11, 3, 120), slot("mungbean", 1, 3, 65)] };
  assert.match(optionCropsText(wrap, cropName), / · /);
});

test("deltaText: gains, losses and no change", () => {
  assert.equal(deltaText(12), "+12");
  assert.equal(deltaText(-8), "−8");
  assert.equal(deltaText(0), "same");
});

test("scoreRows: eight scores in the fixed order, with the change vs your crops", () => {
  const a = { key: "A" as const, scores: { W: 60.4, H: 90, S: 40, E: 50, B: 30, I: 55, M: null, L: 70 } };
  const b = { key: "B" as const, scores: { W: 72.6, H: 90, S: 47.5, E: 50, B: 60, I: 50, M: null, L: 60 } };
  const rowsA = scoreRows(a, a, ["M"]);
  assert.deepEqual(rowsA.map((r) => r.key), ["W", "H", "S", "E", "B", "I", "M", "L"]);
  assert.ok(rowsA.every((r) => r.delta === null), "option A is the baseline, so no change is shown");
  const rowsB = scoreRows(b, a, ["M"]);
  assert.deepEqual(rowsB.find((r) => r.key === "W"), { key: "W", label: "Fits your rain", value: 73, delta: 12, left_out: false });
  assert.deepEqual(rowsB.find((r) => r.key === "M"), { key: "M", label: "Easy to get to market", value: null, delta: null, left_out: true });
  assert.equal(rowsB.find((r) => r.key === "S")?.delta, 8, "47.5 - 40 = 7.5 rounds to 8, as in the engine's Benefits line");
  const worse = scoreRows({ key: "C", scores: { ...b.scores, S: 32.5 } }, a, ["M"]);
  assert.equal(worse.find((r) => r.key === "S")?.delta, -8, "a loss of 7.5 shows as -8, not -7");
});

test("Iligan lot with crops.json: every crop fit and option turns into clean text", () => {
  const crops: LotCrop[] = [
    { crop_id: "lowland-rice", seasons: [] },
    { crop_id: "eggplant", seasons: [] },
    { crop_id: "mungbean", seasons: [] },
  ];
  const analysis = analyzeLot({ farm, lot: lot(crops), data: ILIGAN_LOT_FIXTURE, library });

  assert.equal(analysis.crop_fits.length, 3);
  for (const fit of analysis.crop_fits) {
    assert.ok(FIT_LABELS[fit.level]);
    for (const r of fit.reasons) assertClean(fitReasonText(r), `${fit.crop_id} ${r.code}`);
    const seasons = fitSeasonsText(fit);
    if (fit.seasons.length > 0) {
      assertClean(seasons ?? "", `${fit.crop_id} seasons`);
      assert.match(seasons ?? "", /typical local months, assumed/, "no months given yet, so they are labeled assumed");
    }
  }

  const { options, components_left_out } = analysis.rotations;
  assert.ok(options.length >= 3, "at least 3 options (DoD #6)");
  const a = options.find((o) => o.key === "A");
  let pointLines = 0;
  for (const [i, o] of options.entries()) {
    const crops = optionCropsText(o, cropName);
    assertClean(crops, `option ${o.key} crops`);
    assert.doesNotMatch(crops, /\(/, "short crop names only");
    const rows = scoreRows(o, a, components_left_out);
    assert.equal(rows.length, 8);
    assert.ok(rows.every((r) => r.value === null || (r.value >= 0 && r.value <= 100)));
    const ex = analysis.explanations[i];
    assert.equal(ex.option_key, o.key, "explanations come in the same order as the options");
    for (const r of ex.confidence.reasons) assertClean(confidenceReasonText(r), `${o.key} ${r}`);
    // The bar's change and the engine's "Fits your rain +41 points" line must show the same number.
    for (const l of [...ex.benefits, ...ex.tradeoffs]) {
      const m = /^(.+) ([+-]\d+) points/.exec(l.text);
      if (!m) continue;
      pointLines++;
      const row = rows.find((r) => r.label === m[1]);
      assert.equal(row?.delta, Number(m[2]), `option ${o.key}: "${l.text}" vs the score bar`);
    }
    assertClean(
      optionSummary({ key: o.key, title: "x", total: o.total, confidence: ex.confidence.level, top: o.top_total, crops }),
      `option ${o.key} summary`,
    );
  }
  assert.ok(pointLines > 0, "the Benefits and Trade-offs lines were checked against the bars");
});

test("topPick: the first option with the top total, or null", () => {
  const o = (key: "A" | "B" | "C" | "D", top_total: boolean) => ({ key, top_total });
  assert.equal(topPick([o("A", false), o("B", false), o("C", true), o("D", true)])?.key, "C");
  assert.equal(topPick([o("A", true), o("B", false)])?.key, "A");
  assert.equal(topPick([o("A", false)]), null);
});

test("sameCropsAs: a later option with the same crops in other months points to the earlier one", () => {
  const slot = (crop_id: string, plant_month: number) => ({ crop_id, plant_month }) as never;
  const opts = [
    { key: "A" as const, slots: [slot("rice", 6), slot("rice", 11)] },
    { key: "B" as const, slots: [slot("sorghum", 4), slot("rice", 8)] },
    { key: "C" as const, slots: [slot("mungbean", 2), slot("rice", 5), slot("eggplant", 9)] },
    { key: "D" as const, slots: [slot("mungbean", 4), slot("rice", 7), slot("eggplant", 11)] },
  ];
  assert.deepEqual(sameCropsAs(opts), { D: "C" });
  assert.deepEqual(sameCropsAs([opts[0], { key: "B" as const, slots: [slot("rice", 7)] }]), { B: "A" });
});
