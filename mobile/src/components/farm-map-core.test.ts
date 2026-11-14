/// <reference types="node" />
// The dashboard's farm map (#124): lot colors and words from the engine's crop-fit levels.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FitLevel } from "../engine";
import type { LotAnalysis } from "../engine/analyze";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { CropLibrary, Lot } from "../types";
import {
  FARM_MAP_LEGEND,
  FIT_COLORS,
  farmMapLots,
  farmMapLotStatus,
  farmMapPeriod,
  farmMapSummary,
  lotFitLevel,
  NO_RESULT_COLOR,
  type MapLotView,
} from "./farm-map-core";
import { lotView } from "./lot-analysis-core";
import { FIT_LABELS } from "./recommendations-core";

const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...path), "utf8")) as T;
const library = readJson<CropLibrary>("assets", "data", "crops.json");

const fits = (...levels: FitLevel[]) => levels.map((level) => ({ level }));
/** A "ready" view whose only meaningful part is its crop fits. */
const ready = (levels: FitLevel[], period = "2001-2025"): MapLotView => ({
  kind: "ready",
  analysis: { crop_fits: fits(...levels) } as unknown as LotAnalysis,
  period,
  months: { planting: { seasons: [], gaps: [] }, crops: [], assumed: [] },
  data: ILIGAN_LOT_FIXTURE,
});

const ring: Lot["geometry"] = {
  type: "Polygon",
  coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]],
};
const lots = [
  { id: "lot-1", name: "Lot 1", geometry: ring },
  { id: "lot-2", name: "Lot 2", geometry: ring },
];

test("lotFitLevel: a lot is as good as its worst crop (same order as the engine)", () => {
  assert.equal(lotFitLevel(fits("good", "good")), "good");
  assert.equal(lotFitLevel(fits("good", "unknown")), "unknown");
  assert.equal(lotFitLevel(fits("unknown", "watch", "good")), "watch");
  assert.equal(lotFitLevel(fits("watch", "poor", "good")), "poor");
  assert.equal(lotFitLevel([]), "unknown", "no crop results is not a good fit");
});

test("farmMapLotStatus: a ready lot uses the crop-fit badge's color and words", () => {
  for (const level of ["good", "watch", "poor", "unknown"] as const) {
    assert.deepEqual(farmMapLotStatus(ready([level])), { level, color: FIT_COLORS[level], status: FIT_LABELS[level] });
  }
});

test("farmMapLotStatus: lots without a result are gray and say what is missing", () => {
  const cases: [MapLotView, string][] = [
    [{ kind: "no-crops" }, "Pick crops"],
    [{ kind: "no-soil" }, "No soil data"],
    [{ kind: "no-data", status: "pending" }, "Waiting for NASA data"],
    [{ kind: "no-data", status: "error" }, "No NASA data yet"],
    [{ kind: "loading" }, "Loading"],
    [{ kind: "failed", message: "boom" }, "No result"],
  ];
  for (const [view, status] of cases) {
    assert.deepEqual(farmMapLotStatus(view), { level: null, color: NO_RESULT_COLOR, status });
  }
});

test("farmMapLots: every lot gets a style; a lot with no view yet shows as loading", () => {
  const out = farmMapLots(lots, { "lot-1": ready(["watch"]) });
  assert.deepEqual(out[0].style, { color: FIT_COLORS.watch, status: "Watch out" });
  assert.deepEqual(out[1].style, { color: NO_RESULT_COLOR, status: "Loading" });
  assert.equal(out[0].geometry, ring);
});

test("farmMapSummary reads every lot's result in words", () => {
  assert.equal(
    farmMapSummary(lots, { "lot-1": ready(["good"]), "lot-2": { kind: "no-crops" } }),
    "Map of your lots. Lot 1: Good fit. Lot 2: Pick crops.",
  );
});

test("farmMapPeriod: the years of the lots with results, each once", () => {
  assert.equal(farmMapPeriod({ a: { kind: "no-crops" } }), null);
  assert.equal(farmMapPeriod({ a: ready(["good"]), b: ready(["poor"]) }), "2001-2025");
  assert.equal(farmMapPeriod({ a: ready(["good"]), b: ready(["poor"], "2005-2025") }), "2001-2025 and 2005-2025");
});

test("legend: one row per color, every color a lot can get", () => {
  const legendColors = FARM_MAP_LEGEND.map((r) => r.color);
  assert.equal(new Set(legendColors).size, legendColors.length, "no two rows share a color");
  for (const c of [...Object.values(FIT_COLORS), NO_RESULT_COLOR]) assert.ok(legendColors.includes(c));
  for (const c of legendColors) assert.match(c, /^#[0-9A-F]{6}$/i, "the map page only accepts #RRGGBB");
});

test("end to end: a real engine run colors the lot by its worst crop", () => {
  const lot: Lot = {
    id: "lot-1",
    name: "Lot 1",
    geometry: ring,
    area_ha: 2,
    centroid: [124.2405, 8.2303],
    details: { land_type: "lowland", water: "rain", soil: "loamy" },
    crops: [{ crop_id: "lowland-rice", seasons: [] }],
    data_status: "ready",
    data_ref: "lotdata:lot-1",
    travel: [],
  };
  const farm = { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } };
  const view = lotView({ farm, lot, data: ILIGAN_LOT_FIXTURE, library });
  assert.equal(view.kind, "ready");
  if (view.kind !== "ready") return;
  const expected = lotFitLevel(view.analysis.crop_fits);
  assert.equal(farmMapLotStatus(view).level, expected);
  assert.equal(farmMapLotStatus(view).color, FIT_COLORS[expected]);
});
