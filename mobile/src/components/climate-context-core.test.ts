import assert from "node:assert/strict";
import { test } from "node:test";

import context from "../../assets/data/context.json";
import type { ClimateContext } from "../types";
import { contextLines, seasonLabel } from "./climate-context-core";

test("seasonLabel turns the NOAA code into months", () => {
  assert.equal(seasonLabel("ASO", 2026), "Aug–Oct 2026");
  assert.equal(seasonLabel("DJF", 2026), "Dec 2025–Feb 2026");
  assert.equal(seasonLabel("NDJ", 2026), "Nov 2025–Jan 2026");
  assert.equal(seasonLabel("XYZ", 2026), null);
});

test("contextLines shows the bundled ONI value and advisory with their sources", () => {
  const lines = contextLines(context as ClimateContext);
  assert.equal(lines.length, 2);
  assert.match(lines[0].body, /\+2\.46 °C/);
  assert.match(lines[0].source, /NOAA CPC/);
  assert.match(lines[1].source, /PAGASA/);
  for (const l of lines) assert.ok(l.url.startsWith("https://"));
});

test("contextLines hides what is missing", () => {
  assert.deepEqual(contextLines(null), []);
  assert.deepEqual(contextLines({ oni: { season: "ASO", year: 2026, anomaly_c: null, source: "s", url: "u", retrieved: "r" }, advisory: null }), []);
});
