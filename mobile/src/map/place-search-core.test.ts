/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { BARANGAY_ZOOM, COORDS_ZOOM, MAX_HITS, TOWN_ZOOM, parseCoords, searchPlaces, toPlaces, type BarangayRow, type PlaceRow } from "./place-search-core";

// The real bundled town list (pipeline/build_places.py), so the tests check what the farmer will see.
const FILE = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "places-ph.json"), "utf8")) as {
  places: PlaceRow[];
  barangays: BarangayRow[];
};
const P = toPlaces(FILE.places, FILE.barangays);
const titles = (q: string) => searchPlaces(P, q).map((h) => h.title);

test("core name first: a city whose name is the typed word comes first", () => {
  const [first] = searchPlaces(P, "iligan");
  assert.equal(first.title, "Iligan City");
  assert.equal(first.detail, "Lanao del Norte");
  assert.equal(first.zoom, TOWN_ZOOM);
  assert.equal(titles("vigan")[0], "City of Vigan");
});

test("word start: matches the start of any word in the name, not the province", () => {
  assert.ok(titles("ili").includes("Iligan City"));
  assert.ok(titles("lanao").every((t) => /lanao/i.test(t)), "province names are not searched");
});

test("accents: with or without ñ finds Peñaranda", () => {
  assert.equal(titles("penaranda")[0], "Peñaranda");
  assert.equal(titles("Peñaranda")[0], "Peñaranda");
});

test("same name in two provinces: each result says where it is", () => {
  const hits = searchPlaces(P, "tubod").filter((h) => h.title === "Tubod");
  assert.ok(hits.length >= 2);
  assert.equal(new Set(hits.map((h) => h.detail)).size, hits.length);
});

test("barangays: found by name, say their town and province, and open closer than a town", () => {
  const [first] = searchPlaces(P, "dalipuga");
  assert.equal(first.title, "Dalipuga");
  assert.equal(first.detail, "Iligan City, Lanao del Norte");
  assert.equal(first.zoom, BARANGAY_ZOOM);
});

test("barangay then town: typing part of the town picks the right barangay", () => {
  const [first] = searchPlaces(P, "abuno ili");
  assert.equal(first.title, "Abuno");
  assert.match(first.detail, /^Iligan City, /);
});

test("towns before barangays with the same name", () => {
  const hits = searchPlaces(P, "tubod");
  const firstBarangay = hits.findIndex((h) => h.zoom === BARANGAY_ZOOM);
  assert.ok(firstBarangay > 0, "a barangay is listed, after the towns");
  assert.ok(hits.slice(0, firstBarangay).every((h) => h.zoom === TOWN_ZOOM));
  assert.ok(hits.slice(firstBarangay).every((h) => h.zoom === BARANGAY_ZOOM));
});

test("limits: nothing under 2 letters, at most 6 results", () => {
  assert.deepEqual(searchPlaces(P, "a"), []);
  assert.deepEqual(searchPlaces(P, "  "), []);
  assert.equal(searchPlaces(P, "san").length, MAX_HITS);
});

test("coordinates: typed lat, lon go to that point; impossible ones give nothing", () => {
  const hits = searchPlaces(P, "8.23, 124.24");
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].lat, hits[0].lon, hits[0].zoom], [8.23, 124.24, COORDS_ZOOM]);
  assert.equal(hits[0].title, "Go to 8.23, 124.24");
  assert.deepEqual(parseCoords("8.23 124.24"), { lat: 8.23, lon: 124.24 });
  assert.equal(parseCoords("91, 10"), null);
  assert.deepEqual(searchPlaces(P, "91, 10"), []);
});

test("trim and case: extra spaces and capitals don't matter", () => {
  assert.deepEqual(titles("  ILIGAN "), titles("iligan"));
});
