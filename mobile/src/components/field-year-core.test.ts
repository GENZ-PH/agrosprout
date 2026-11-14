/// <reference types="node" />
// Geometry and wording behind the field-year calendar on the dashboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RotationSlot } from "../engine/scores";
import { bandPieces, bareText, familiesIn, familyStyle, monthsText, monthX, shortCropName } from "./field-year-core";

const slot = (crop_id: string, plant_month: number, season_days: number): RotationSlot => ({
  crop_id,
  plant_month,
  harvest_month: plant_month,
  season_days,
  origin: "engine",
});

test("a crop inside one year is one labeled piece from planting day to harvest", () => {
  const { pieces, lanes } = bandPieces([slot("rice", 6, 120)]);
  assert.equal(lanes, 1);
  assert.equal(pieces.length, 1);
  // June 15 is day 151 + 14 (0-based).
  assert.deepEqual(pieces[0], { crop_id: "rice", start: 165, end: 285, lane: 0, labeled: true });
});

test("a crop that runs past December is split, and the longer piece carries the label", () => {
  const { pieces, lanes } = bandPieces([slot("eggplant", 11, 150)]);
  assert.equal(lanes, 1);
  assert.equal(pieces.length, 2);
  const [late, early] = pieces;
  assert.equal(late.end, 365);
  assert.equal(early.start, 0);
  assert.equal(late.end - late.start + (early.end - early.start), 150);
  assert.equal(early.labeled, true);
  assert.equal(late.labeled, false);
});

test("crops in the field at the same time go to separate lanes; crops in sequence share one", () => {
  assert.equal(bandPieces([slot("corn", 5, 110), slot("eggplant", 6, 150)]).lanes, 2);
  assert.equal(bandPieces([slot("mungbean", 4, 65), slot("rice", 7, 120)]).lanes, 1);
});

test("a wrapped crop still collides with a crop planted in January", () => {
  assert.equal(bandPieces([slot("eggplant", 11, 150), slot("corn", 1, 100)]).lanes, 2);
});

test("monthX puts January at the left edge and stays inside the ruler", () => {
  assert.equal(monthX(1), 0);
  assert.ok(monthX(12) > 0.9 && monthX(12) < 1);
});

test("monthsText reads runs in calendar order", () => {
  assert.equal(monthsText([]), "none");
  assert.equal(monthsText([3]), "Mar");
  assert.equal(monthsText([4, 3]), "Mar and Apr");
  assert.equal(monthsText([3, 4, 5]), "Mar to May");
  assert.equal(monthsText([10, 4, 5]), "Apr to May and Oct");
  assert.equal(monthsText([8, 9, 5, 6]), "May to Jun and Aug to Sep");
  assert.equal(monthsText([2, 5, 9]), "Feb, May and Sep");
});

test("monthsText keeps a run that crosses the year end together", () => {
  assert.equal(monthsText([12, 1, 2, 3]), "Dec to Mar");
  assert.equal(monthsText([1, 12]), "Dec and Jan");
  assert.equal(monthsText([1, 2, 6, 11, 12]), "Jun and Nov to Feb");
  assert.equal(monthsText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "Jan to Dec");
});

test("bareText says how long and when the field is empty", () => {
  assert.equal(bareText({ bare_days: 0, bare_months: [] }), "Never bare");
  assert.equal(bareText({ bare_days: 48, bare_months: [] }), "Bare 48 days");
  assert.equal(bareText({ bare_days: 150, bare_months: [12, 1, 2, 3] }), "Bare 150 days, mostly Dec to Mar");
});

test("shortCropName drops the part in brackets and falls back to the id", () => {
  assert.equal(shortCropName({ name: "Lowland rice (irrigated or rainfed paddy)" }, "rice"), "Lowland rice");
  assert.equal(shortCropName({ name: "Eggplant" }, "eggplant"), "Eggplant");
  assert.equal(shortCropName(undefined, "mystery"), "mystery");
});

test("families color the bands and list once each in the legend", () => {
  assert.equal(familyStyle("Fabaceae").label, "Legumes");
  assert.equal(familyStyle(null).label, "Other crops");
  assert.equal(familyStyle("Unknownaceae").label, "Other crops");
  const fam: Record<string, string> = { rice: "Poaceae", corn: "Poaceae", mungbean: "Fabaceae" };
  const legend = familiesIn(
    [{ slots: [slot("rice", 6, 120), slot("corn", 11, 100)] }, { slots: [slot("mungbean", 4, 65), slot("rice", 7, 120)] }],
    (id) => fam[id],
  );
  assert.deepEqual(legend.map((f) => f.label), ["Grains", "Legumes"]);
});
