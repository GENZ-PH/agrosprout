/// <reference types="node" />
// What "Explain this plan with SI" sends (D33): engine results only, nothing that locates the farm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeLot } from "../engine/analyze";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { CropLibrary, Lot } from "../types";
import { explainErrorText, explainRequest } from "./explain-core";
import { topPick } from "./recommendations-core";

const library = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "crops.json"), "utf8")) as CropLibrary;
const farm = { destinations: [], priorities: { water: 50, soil: 50, income: 50, labor: 50 } };
const cropName = (id: string) => library.crops.find((c) => c.id === id)?.name ?? id;

const lot: Lot = {
  id: "lot-1",
  name: "Mang Rodel's paddy by the river",
  geometry: { type: "Polygon", coordinates: [[[124.24, 8.23], [124.241, 8.23], [124.241, 8.231], [124.24, 8.23]]] },
  area_ha: 2,
  centroid: [124.2405, 8.2303],
  details: { land_type: "lowland", water: "rain", soil: "loamy" },
  crops: [
    { crop_id: "lowland-rice", seasons: [] },
    { crop_id: "eggplant", seasons: [] },
  ],
  data_status: "ready",
  data_ref: "lotdata:lot-1",
  travel: [],
};

function request() {
  const analysis = analyzeLot({ farm, lot, data: ILIGAN_LOT_FIXTURE, library });
  const pick = topPick(analysis.rotations.options);
  assert.ok(pick, "the Iligan fixture has a top option");
  const a = analysis.rotations.options.find((o) => o.key === "A");
  const explanation = analysis.explanations.find((e) => e.option_key === pick.key);
  assert.ok(explanation);
  return explainRequest({ pick, a, explanation, cropName, componentsLeftOut: analysis.rotations.components_left_out });
}

test("explainRequest: carries the plan, its scores and the engine's own lines", () => {
  const r = request();
  assert.ok(r.plan.length > 0);
  assert.ok(r.crops.length > 0);
  assert.ok(r.scores.length > 0, "at least one component score");
  assert.ok(r.checkLocally.length > 0, "the engine always says what to check locally");
  assert.ok(["high", "medium", "low"].includes(r.confidence));
  for (const s of r.scores) assert.match(s, /^[^:]+: \d+( \(.+\))?$/, s);
});

test("explainRequest: sends no location, shape, lot name or crop ids (rule 8)", () => {
  const sent = JSON.stringify(request());
  assert.doesNotMatch(sent, /124\.24|8\.23|Polygon|coordinates|centroid/);
  assert.doesNotMatch(sent, /Mang Rodel|river/);
  assert.doesNotMatch(sent, /lowland-rice/);
});

test("explainRequest: stays inside the API's limits (8 lines of 400 characters at most)", () => {
  const r = request();
  for (const xs of [r.scores, r.why, r.tradeoffs, r.unknowns, r.checkLocally, r.confidenceReasons]) {
    assert.ok(xs.length <= 8);
    for (const x of xs) assert.ok(x.length <= 400);
  }
  assert.ok(r.crops.length <= 300);
});

test("explainErrorText: every error says what happened in plain words", () => {
  for (const code of ["si_off", "rate_limited", "si_busy", "si_unchecked", "si_declined", "timeout", "network_error", "other"]) {
    const t = explainErrorText(code);
    assert.ok(t.length > 20);
    assert.doesNotMatch(t, /\bAI\b/);
  }
});
