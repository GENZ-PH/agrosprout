/// <reference types="node" />
// The "looks like water" check on a lot (Natural Earth land and lakes, pipeline/build_land_water.py).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import type { Lot } from "../types";
import { lotLooksLikeWater, placeAt, prepareLandWater, type LandWaterData } from "./land-water-core";

const sq = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

// Window 0-10. Land 1-6 with a bay (hole) at 2-3; an island at 7-8; a lake inside the land at 4-5.
const TOY: LandWaterData = {
  meta: { window: [0, 0, 10, 10] },
  land: [[sq(1, 1, 6, 6), sq(2, 2, 3, 3)], [sq(7, 7, 8, 8)]],
  lakes: [[sq(4, 4, 5, 5)]],
};
const toy = prepareLandWater(TOY);

const lotAt = (ring: number[][]): Pick<Lot, "geometry" | "centroid"> => {
  const pts = ring.slice(0, -1);
  const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  return { geometry: { type: "Polygon", coordinates: [ring as [number, number][]] }, centroid: c as [number, number] };
};

test("placeAt: land, water, a hole in the land, a lake, and outside the map", () => {
  assert.equal(placeAt(toy, 1.5, 1.5), "land");
  assert.equal(placeAt(toy, 7.5, 7.5), "land", "an island");
  assert.equal(placeAt(toy, 9, 1), "water", "sea");
  assert.equal(placeAt(toy, 2.5, 2.5), "water", "a bay cut out of the land");
  assert.equal(placeAt(toy, 4.5, 4.5), "water", "a lake");
  assert.equal(placeAt(toy, 11, 5), null, "outside the map: no answer");
});

test("lotLooksLikeWater: only when the centre and every corner read as water", () => {
  assert.equal(lotLooksLikeWater(toy, lotAt(sq(8.5, 1, 9.5, 2))), true, "a lot out at sea");
  assert.equal(lotLooksLikeWater(toy, lotAt(sq(4.2, 4.2, 4.8, 4.8))), true, "a lot inside the lake");
  assert.equal(lotLooksLikeWater(toy, lotAt(sq(5.5, 1.5, 6.5, 2.5))), false, "a lot across the shore: some of it is land");
  assert.equal(lotLooksLikeWater(toy, lotAt(sq(1.2, 1.2, 1.8, 1.8))), false, "a lot on land");
  assert.equal(lotLooksLikeWater(toy, lotAt(sq(10.5, 1, 11, 2))), false, "outside the map: no warning");
  const pin = { geometry: { type: "Polygon" as const, coordinates: [[[9, 9], [9, 9], [9, 9], [9, 9]] as [number, number][]] }, centroid: [9, 9] as [number, number] };
  assert.equal(lotLooksLikeWater(toy, pin), true, "a pin lot in the sea");
});

// The real file, at places checked against the NASA POWER probe of 2026-11-15.
const REAL = prepareLandWater(
  JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "land-water-ph.json"), "utf8")) as LandWaterData,
);

test("the bundled map: the inner seas and Laguna de Bay that NASA POWER reads as land are water here", () => {
  const water: Record<string, [number, number]> = {
    "Manila Bay": [120.8, 14.5],
    "Sibuyan Sea": [122.6, 12.6],
    "Visayan Sea": [123.6, 11.6],
    "Camotes Sea": [124.2, 10.5],
    "Bohol Sea": [124.2, 9.2],
    "Moro Gulf": [123.6, 7.0],
    "Laguna de Bay": [121.3, 14.4],
  };
  for (const [name, [lon, lat]] of Object.entries(water)) assert.equal(placeAt(REAL, lon, lat), "water", name);
});

test("the bundled map: farms, the sample farm and small islands are land", () => {
  const land: Record<string, [number, number]> = {
    "sample farm (demo-farm-core.ts)": [123.8005, 8.0005],
    "Iligan City": [124.245, 8.228],
    "Nueva Ecija": [120.97, 15.6],
    Bukidnon: [125.1, 8.0],
    Siquijor: [123.55, 9.2],
    "Camotes Islands": [124.35, 10.65],
    "Batan Island": [121.97, 20.45],
  };
  for (const [name, [lon, lat]] of Object.entries(land)) assert.equal(placeAt(REAL, lon, lat), "land", name);
});

test("the bundled map's known limits: Lake Lanao is not in it, Pag-asa Island is outside it", () => {
  assert.equal(placeAt(REAL, 124.2, 7.9), "land", "Lake Lanao: not in Natural Earth 1:10m lakes");
  assert.equal(placeAt(REAL, 114.28, 11.05), null, "Pag-asa Island: west of the window");
});

test("lotLooksLikeWater on the bundled map: a farm near the shore gets no warning, open water still does (#176)", () => {
  const near = (lon: number, lat: number) => lotAt([[lon, lat], [lon + 0.001, lat], [lon + 0.001, lat + 0.001], [lon, lat + 0.001], [lon, lat]]);
  // About 1 km off the map's Iligan shore (the 0.01° probe grid: water at 124.23, land from 124.25 at 8.23 N).
  assert.equal(lotLooksLikeWater(REAL, near(124.235, 8.23)), false, "just off the map's shore near Iligan");
  assert.equal(lotLooksLikeWater(REAL, near(120.8, 14.5)), true, "Manila Bay");
  assert.equal(lotLooksLikeWater(REAL, near(121.2, 14.35)), true, "Laguna de Bay, west bay");
  assert.equal(lotLooksLikeWater(REAL, near(123.6, 11.6)), true, "Visayan Sea");
});
