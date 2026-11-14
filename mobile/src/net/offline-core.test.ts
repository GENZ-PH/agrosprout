/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Provenance } from "../types";
import { dataDate, dateRangeText, offlineDetail } from "./offline-core";

const prov = (...retrieved: string[]): { provenance: Provenance[] } => ({
  provenance: retrieved.map((r, i) => ({ field: `f${i}`, source: "NASA POWER", native_res: "0.5°", period: "2001-2025", retrieved: r })),
});

test("a lot's data date is its newest retrieved date; no usable date gives null", () => {
  assert.equal(dataDate(prov("2026-11-13", "2026-11-14", "2026-11-12")), "2026-11-14");
  assert.equal(dataDate(prov("2026-11-14T03:20:00Z")), "2026-11-14");
  assert.equal(dataDate(prov()), null);
  assert.equal(dataDate(prov("", "not a date")), null);
});

test("dates read as one day, a range in one month, across months, or across years", () => {
  assert.equal(dateRangeText([]), null);
  assert.equal(dateRangeText(["2026-11-14", "2026-11-14"]), "14 Nov 2026");
  assert.equal(dateRangeText(["2026-11-14", "2026-11-13"]), "13–14 Nov 2026");
  assert.equal(dateRangeText(["2026-11-02", "2026-10-30"]), "30 Oct – 2 Nov 2026");
  assert.equal(dateRangeText(["2026-01-02", "2025-12-30"]), "30 Dec 2025 – 2 Jan 2026");
});

test("offline: says the results use the saved NASA data and when it was last updated", () => {
  assert.equal(
    offlineDetail({ dates: ["2026-11-14"], pending: [] }),
    "Your results use the NASA data saved on this phone, last updated 14 Nov 2026.",
  );
});

test("offline: lots still waiting for data are named, and get it when the phone is back online", () => {
  assert.equal(
    offlineDetail({ dates: ["2026-11-14"], pending: ["Lot 2"] }),
    "Your results use the NASA data saved on this phone, last updated 14 Nov 2026. Lot 2 gets its NASA data when the phone is back online.",
  );
  assert.equal(
    offlineDetail({ dates: [], pending: ["Lot 2", "Lot 3", "Rice field"] }),
    "Lot 2, Lot 3 and Rice field get their NASA data when the phone is back online.",
  );
});

test("offline with no saved data: says what needs signal; while the dates load, says nothing about them", () => {
  assert.equal(offlineDetail({ dates: [], pending: [] }), "The map and new NASA data need signal.");
  assert.equal(offlineDetail({ dates: null, pending: [] }), "");
  assert.equal(offlineDetail({ dates: null, pending: ["Lot 1"] }), "Lot 1 gets its NASA data when the phone is back online.");
});
