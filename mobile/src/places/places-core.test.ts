/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Travel } from "../types";
import {
  changeTravel,
  confirmTravel,
  defaultPlaceName,
  formatMinutes,
  MODE_OPTIONS,
  parseMinutes,
  parseOptionalPositive,
  placeFromDraft,
  PLACE_TYPE_OPTIONS,
  sourceLabel,
  travelRows,
} from "./places-core";

const est: Travel = { destination_id: "dest-1", distance_km: 12.5, minutes: 41.4, source: "estimate", route_profile: null };

test("every transport mode and place type of the data model has a label, in the docs/11 order", () => {
  assert.deepEqual(MODE_OPTIONS.map((o) => o.value), ["walk", "carabao", "bicycle", "motorcycle", "tricycle", "jeepney", "truck"]);
  assert.deepEqual(PLACE_TYPE_OPTIONS.map((o) => o.value), ["market", "storage", "buyer", "coop"]);
});

test("default names do not repeat: Market, Market 2, Market 3", () => {
  assert.equal(defaultPlaceName("market", []), "Market");
  assert.equal(defaultPlaceName("market", [{ name: "Market" }]), "Market 2");
  assert.equal(defaultPlaceName("market", [{ name: "market" }, { name: "Market 2" }]), "Market 3");
  assert.equal(defaultPlaceName("storage", [{ name: "Market" }]), "Storage");
});

test("minutes read as people say them", () => {
  assert.equal(formatMinutes(0), "0 min");
  assert.equal(formatMinutes(55.4), "55 min");
  assert.equal(formatMinutes(60), "1 h");
  assert.equal(formatMinutes(70), "1 h 10 min");
  assert.equal(formatMinutes(252.2), "4 h 12 min");
});

test("the label names how the time was found", () => {
  assert.equal(sourceLabel("route"), "road route");
  assert.equal(sourceLabel("estimate"), "rough estimate");
  assert.equal(sourceLabel("farmer"), "your time");
});

test("typed minutes: whole numbers from 1 to one day; anything else is refused", () => {
  assert.equal(parseMinutes("45"), 45);
  assert.equal(parseMinutes(" 45.6 "), 46);
  assert.equal(parseMinutes("1,5"), 2);
  for (const bad of ["", "0", "-5", "abc", "1e3", "1441", "12 min"]) assert.equal(parseMinutes(bad), null, bad);
  assert.equal(parseMinutes("1440"), 1440);
});

test("optional numbers: empty = I don't know (null), a valid number, or undefined when it is wrong", () => {
  assert.equal(parseOptionalPositive(""), null);
  assert.equal(parseOptionalPositive("  "), null);
  assert.equal(parseOptionalPositive("50"), 50);
  assert.equal(parseOptionalPositive("12,5"), 12.5);
  for (const bad of ["0", "-3", "abc", "5 kg"]) assert.equal(parseOptionalPositive(bad), undefined, bad);
});

test("Looks right turns the shown time into the farmer's own time and keeps the distance", () => {
  const t = confirmTravel(est);
  assert.deepEqual(t, { destination_id: "dest-1", distance_km: 12.5, minutes: 41.4, source: "farmer", route_profile: null });
  assert.equal(est.source, "estimate", "the input is not changed");
});

test("Change keeps the known distance, or none", () => {
  assert.deepEqual(changeTravel("dest-1", 90, est), { destination_id: "dest-1", distance_km: 12.5, minutes: 90, source: "farmer", route_profile: null });
  assert.equal(changeTravel("dest-2", 30, undefined).distance_km, null);
});

test("one row per lot for a place; a lot without an entry shows null", () => {
  const lots = [
    { id: "lot-1", name: "Lot 1", travel: [est] },
    { id: "lot-2", name: "Lot 2", travel: [] },
  ];
  const rows = travelRows(lots, "dest-1");
  assert.deepEqual(rows.map((r) => [r.lotId, r.travel?.source ?? null]), [["lot-1", "estimate"], ["lot-2", null]]);
});

test("the form: needs a pin and a name; load and fare are optional but must be numbers", () => {
  const ok = { point: [124.2, 8.2] as [number, number], name: " Poblacion market ", type: "market" as const, mode: "motorcycle" as const, loadText: "", fareText: "" };
  const r = placeFromDraft(ok);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.destination, { name: "Poblacion market", type: "market", point: [124.2, 8.2], mode: "motorcycle", load_kg_per_trip: null, fare_one_way: null });
  assert.deepEqual(placeFromDraft({ ...ok, point: null }), { ok: false, problem: "no-point" });
  assert.deepEqual(placeFromDraft({ ...ok, name: "  " }), { ok: false, problem: "no-name" });
  assert.deepEqual(placeFromDraft({ ...ok, loadText: "lots" }), { ok: false, problem: "bad-load" });
  assert.deepEqual(placeFromDraft({ ...ok, fareText: "-5" }), { ok: false, problem: "bad-fare" });
  const withNumbers = placeFromDraft({ ...ok, loadText: "80", fareText: "35,5" });
  assert.ok(withNumbers.ok);
  if (withNumbers.ok) assert.deepEqual([withNumbers.destination.load_kg_per_trip, withNumbers.destination.fare_one_way], [80, 35.5]);
});
