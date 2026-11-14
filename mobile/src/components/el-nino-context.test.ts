/// <reference types="node" />
// ElNinoNotice types "first half of 2027" and "November 2026" by hand from the PAGASA advisory
// (#153 review). If the pipeline bundles a newer advisory, this fails so the notice text is updated too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const context = JSON.parse(readFileSync(new URL("../../assets/data/context.json", import.meta.url), "utf8"));

test("El Niño notice dates match the bundled PAGASA advisory", () => {
  assert.equal(context.advisory.issued, "2026-11-04");
  assert.match(context.advisory.summary_by_hand, /first half of 2027/);
  assert.match(context.advisory.summary_by_hand, /November 2026/);
  assert.ok(context.oni.url.startsWith("https://"));
});
