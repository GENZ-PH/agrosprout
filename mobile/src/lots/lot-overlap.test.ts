/// <reference types="node" />
// "This lot overlaps Lot N" (#176).
import assert from "node:assert/strict";
import { test } from "node:test";

import type { LonLat, Lot } from "../types";
import { findOverlap, overlapM2, ringAreaM2 } from "./lot-overlap";

// Squares in metres east/north of a point near Iligan.
const LON0 = 124.24;
const LAT0 = 8.2;
const KX = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110_574;
const at = (e: number, n: number): LonLat => [LON0 + e / KX, LAT0 + n / KY];
const sq = (e0: number, n0: number, e1: number, n1: number): LonLat[] => [
  at(e0, n0),
  at(e1, n0),
  at(e1, n1),
  at(e0, n1),
  at(e0, n0),
];
const lot = (id: string, ring: LonLat[]): Pick<Lot, "id" | "name" | "geometry"> => ({
  id,
  name: id.replace("lot-", "Lot "),
  geometry: { type: "Polygon", coordinates: [ring] },
});

test("area of a 100 m square is about 1 ha", () => {
  assert.ok(Math.abs(ringAreaM2(sq(0, 0, 100, 100)) - 10_000) < 10);
});

test("lots apart don't overlap", () => {
  assert.equal(overlapM2(sq(0, 0, 100, 100), sq(200, 0, 300, 100)), 0);
  assert.equal(findOverlap(sq(0, 0, 100, 100), "lot-2", [lot("lot-1", sq(200, 0, 300, 100))]), null);
});

test("a half overlap is found and measured", () => {
  const o = overlapM2(sq(0, 0, 100, 100), sq(50, 0, 150, 100));
  assert.ok(Math.abs(o - 5_000) < 250, `got ${o}`);
  const hit = findOverlap(sq(50, 0, 150, 100), "lot-2", [lot("lot-1", sq(0, 0, 100, 100))]);
  assert.equal(hit?.id, "lot-1");
  assert.equal(hit?.name, "Lot 1");
});

test("neighbours drawn along a shared edge are accepted", () => {
  // Exactly touching, and a 5 m wobble across a 100 m edge (5% of the lot).
  assert.equal(findOverlap(sq(100, 0, 200, 100), "lot-2", [lot("lot-1", sq(0, 0, 100, 100))]), null);
  assert.equal(findOverlap(sq(95, 0, 195, 100), "lot-2", [lot("lot-1", sq(0, 0, 100, 100))]), null);
});

test("a small lot drawn inside a big one is found", () => {
  const hit = findOverlap(sq(40, 40, 60, 60), "lot-2", [lot("lot-1", sq(0, 0, 100, 100))]);
  assert.equal(hit?.id, "lot-1");
  // And the other way round: a big lot drawn around a small one.
  assert.equal(findOverlap(sq(0, 0, 100, 100), "lot-1", [lot("lot-2", sq(40, 40, 60, 60))])?.id, "lot-2");
});

test("the lot itself and pin lots are skipped", () => {
  assert.equal(findOverlap(sq(0, 0, 100, 100), "lot-1", [lot("lot-1", sq(0, 0, 100, 100))]), null);
  const p = at(50, 50);
  assert.equal(findOverlap(sq(0, 0, 100, 100), "lot-2", [lot("lot-1", [p, p, p, p])]), null);
});
