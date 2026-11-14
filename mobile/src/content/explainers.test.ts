import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_LABELS } from "../engine/explain";
import { DATA_SOURCES, DISCLAIMER, EXPLAINERS, GLOSSARY, LIMITATIONS, fill } from "./explainers";

const ALL_TEXT = (): string =>
  JSON.stringify([DISCLAIMER, EXPLAINERS, GLOSSARY, DATA_SOURCES, LIMITATIONS]);

test("every explainer answers what, where from, how to read and limits", () => {
  for (const [id, e] of Object.entries(EXPLAINERS)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.what && e.source && e.read, id);
    assert.ok(e.limits.length > 0, id);
  }
});

test("texts say SI, never the banned word", () => {
  assert.doesNotMatch(ALL_TEXT(), /\bA\.?I\b/);
  assert.match(DISCLAIMER, /does not replace/);
});

test("period token is filled from the lot's data and unknown tokens stay", () => {
  assert.equal(fill("Years used: {period}.", { period: "2001-2025" }), "Years used: 2001-2025.");
  assert.equal(fill("{other}", { period: "x" }), "{other}");
});

test("every data source names a period and a resolution", () => {
  for (const s of DATA_SOURCES) assert.ok(s.period && s.resolution && s.used_for, s.name);
});

test("the months card never says already good for a blocked month", () => {
  const read = EXPLAINERS["months-compare"].read;
  assert.match(read, /clash/);
  assert.match(read, /even on a lot with nothing else on it/);
});

test("the recommendations text uses the same score names the app shows", () => {
  for (const label of Object.values(COMPONENT_LABELS)) assert.ok(EXPLAINERS.recommendations.read.includes(label), label);
});
