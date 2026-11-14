/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import type { CropLibrary, EcocropNames } from "../types";
import { buildSearchEntries, enterChoice, normalizeName, searchCrops, searchSummary, type SearchResult } from "./crop-search-core";

// Read from disk: Node's test runner can't import JSON without import attributes (same as crops.test.ts).
const read = <T>(file: string) => JSON.parse(readFileSync(join(process.cwd(), "assets", "data", file), "utf8")) as T;
const LIBRARY = read<CropLibrary>("crops.json");
const INDEX = read<EcocropNames>("ecocrop-names.json");
const ENTRIES = buildSearchEntries(LIBRARY, INDEX);

const libraryId = (r: SearchResult) => (r.entry.kind === "library" ? r.entry.crop_id : null);
const sci = (r: SearchResult) => r.entry.sci;

test("normalizeName folds case and accents and turns punctuation into single spaces", () => {
  assert.equal(normalizeName("  KAMÓTE "), "kamote");
  assert.equal(normalizeName("Corn (maize, grain)"), "corn maize grain");
  assert.equal(normalizeName("sweet  pot"), "sweet pot");
  assert.equal(normalizeName("Aaron's rod"), "aarons rod");
  assert.equal(normalizeName("Ipomoea aquatica var. reptans"), "ipomoea aquatica reptans");
  assert.equal(normalizeName("Acacia julifera ssp. julifera"), "acacia julifera julifera");
});

test("empty query lists our crops in library order and offers no Add", () => {
  for (const q of ["", "   "]) {
    const out = searchCrops(ENTRIES, q);
    assert.deepEqual(out.results.map(libraryId), LIBRARY.crops.map((c) => c.id));
    assert.equal(out.add, null);
  }
});

test("kamote and camote find Sweet potato from our list, once", () => {
  for (const q of ["kamote", "camote"]) {
    const out = searchCrops(ENTRIES, q);
    assert.equal(libraryId(out.results[0]), "sweet-potato");
    assert.equal(out.results[0].title, "Sweet potato");
    assert.equal(out.results.filter((r) => sci(r) === "Ipomoea batatas").length, 1);
    assert.equal(out.add, null);
  }
  assert.equal(searchCrops(ENTRIES, "camote").results[0].matched, "camote");
  assert.equal(searchCrops(ENTRIES, "kamote").results[0].matched, null, "Kamote is the local name, shown already");
});

test("cassava finds Ecocrop Manihot esculenta titled Cassava", () => {
  const out = searchCrops(ENTRIES, "cassava");
  const hit = out.results.find((r) => sci(r) === "Manihot esculenta");
  assert.ok(hit, "Manihot esculenta in the results");
  assert.equal(hit.entry.kind, "ecocrop");
  assert.equal(hit.title, "Cassava");
  assert.equal(hit.matched, null);
  assert.equal(out.add, null);
});

test("okra shows the matched name, not the first Ecocrop name", () => {
  const out = searchCrops(ENTRIES, "okra");
  const hit = out.results.find((r) => sci(r) === "Abelmoschus esculentus");
  assert.ok(hit, "Abelmoschus esculentus in the results");
  assert.equal(hit.title, "Okra");
  assert.equal(out.add, null);
});

test("sili finds Ecocrop's Sili (Capsicum frutescens) first, with no Add", () => {
  const out = searchCrops(ENTRIES, "sili");
  assert.equal(sci(out.results[0]), "Capsicum frutescens");
  assert.equal(out.results[0].title, "Sili");
  assert.equal(out.add, null);
});

test("ampalaya, which Ecocrop doesn't list, gives only the Add row", () => {
  const out = searchCrops(ENTRIES, "Ampalaya");
  assert.equal(out.results.length, 0);
  assert.equal(out.add, "Ampalaya");
});

test("part of a name shows the matches and still offers Add", () => {
  const out = searchCrops(ENTRIES, "toma");
  assert.ok(out.results.some((r) => sci(r) === "Lycopersicon esculentum" && r.title === "Tomato"));
  assert.equal(out.add, "toma");
});

test("one letter matches the start of main names only", () => {
  const { results } = searchCrops(ENTRIES, "s");
  assert.ok(results.every((r) => r.entry.names.slice(0, r.entry.main).some((n) => normalizeName(n).startsWith("s"))));
  assert.ok(!results.some((r) => libraryId(r) === "corn"), "not Corn by its rare Ecocrop name 'sila'");
  assert.equal(libraryId(searchCrops(ENTRIES, "k").results[0]), "sweet-potato", "local name Kamote counts as a main name");
  assert.equal(libraryId(searchCrops(ENTRIES, "T").results[0]), "eggplant", "Talong");
});

test("no match note when the row already shows the matched words", () => {
  const rice = searchCrops(ENTRIES, "rice").results[0];
  assert.equal(libraryId(rice), "lowland-rice");
  assert.equal(rice.matched, null);
  assert.equal(searchCrops(ENTRIES, "maize").results[0].matched, "maize");
});

test("a name nobody knows gives no results and only the Add row", () => {
  const out = searchCrops(ENTRIES, "  xyz   qq ");
  assert.equal(out.results.length, 0);
  assert.equal(out.add, "xyz qq");
});

test("the Add text is cut to 40 characters", () => {
  assert.equal(searchCrops(ENTRIES, "x".repeat(60)).add, "x".repeat(40));
});

test("normalizes case, accents and spaces", () => {
  assert.deepEqual(searchCrops(ENTRIES, "  KAMÓTE ").results[0], searchCrops(ENTRIES, "kamote").results[0]);
  assert.equal(libraryId(searchCrops(ENTRIES, "sweet  pot").results[0]), "sweet-potato");
});

test("local names in brackets and Ecocrop's other names find our crops", () => {
  assert.equal(libraryId(searchCrops(ENTRIES, "balatong").results[0]), "string-bean");
  assert.equal(libraryId(searchCrops(ENTRIES, "maize").results[0]), "corn");
  assert.equal(libraryId(searchCrops(ENTRIES, "utaw").results[0]), "soybean");
});

test("caps at 8 with library first", () => {
  const { results } = searchCrops(ENTRIES, "s");
  assert.equal(results.length, 8);
  const firstEcocrop = results.findIndex((r) => r.entry.kind === "ecocrop");
  const lastLibrary = results.map((r) => r.entry.kind).lastIndexOf("library");
  assert.ok(firstEcocrop === -1 || lastLibrary < firstEcocrop, "every library result comes before the first Ecocrop one");
});

test("exact name ranks above other matches", () => {
  const { results } = searchCrops(ENTRIES, "corn");
  assert.equal(libraryId(results[0]), "corn");
  assert.equal(results[0].title, "Corn");
});

test("a species with no common name is found and titled by its scientific name", () => {
  const bare = INDEX.species.find((s) => s.names.length === 0);
  assert.ok(bare, "the index has a species with no common name");
  const hit = searchCrops(ENTRIES, bare.sci).results.find((r) => sci(r) === bare.sci);
  assert.ok(hit);
  assert.equal(hit.title, bare.sci);
  assert.equal(hit.matched, null);
});

test("with the index disabled only our crops and Add remain", () => {
  const entries = buildSearchEntries(LIBRARY, null);
  assert.equal(entries.length, LIBRARY.crops.length);
  const out = searchCrops(entries, "cassava");
  assert.equal(out.results.length, 0);
  assert.equal(out.add, "cassava");
  assert.equal(libraryId(searchCrops(entries, "talong").results[0]), "eggplant");
});

test("an Ecocrop name that is also one of our crops' names finds only our crop", () => {
  const ours = new Set(ENTRIES.filter((e) => e.kind === "library").flatMap((e) => e.names.map(normalizeName)));
  for (const q of ["mung", "mung bean", "groundnut", "batata", "yard long bean", "rice", "corn", "kamote", "sorghum"]) {
    const clash = searchCrops(ENTRIES, q).results.filter((r) => r.entry.kind === "ecocrop" && ours.has(normalizeName(r.title)));
    assert.deepEqual(clash.map((r) => `${r.title} (${r.entry.sci})`), [], q);
  }
  assert.ok(searchCrops(ENTRIES, "black gram").results.some((r) => sci(r) === "Vigna mungo"), "Vigna mungo is still found by its other names");
});

test("Enter chooses only an exact name, or the typed name when nothing matched", () => {
  const pick = (q: string) => {
    const c = enterChoice(searchCrops(ENTRIES, q), q);
    return c === null || c === "add" ? c : c.title;
  };
  assert.equal(pick("sorghum"), "Sorghum");
  assert.equal(pick("camote"), "Sweet potato");
  assert.equal(pick("okra"), "Okra");
  assert.equal(pick("ampalaya"), "add");
  for (const q of ["", "  ", "-", "var", "ka", "toma", "ric"]) assert.equal(pick(q), null, JSON.stringify(q));
});

test("the screen reader hears a short summary, not every row", () => {
  assert.equal(searchSummary(0, null, true), "");
  assert.equal(searchSummary(10, null, true), "");
  assert.equal(searchSummary(1, null, false), "1 crop found.");
  assert.equal(searchSummary(8, "Toma", false), "8 crops found. You can also choose “Toma” as typed.");
  assert.equal(searchSummary(0, "Ampalaya", false), "No crop found. You can choose “Ampalaya” as typed.");
});
