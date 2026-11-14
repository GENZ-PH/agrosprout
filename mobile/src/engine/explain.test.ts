/// <reference types="node" />
// Explanations and confidence (#28, docs/07 §5).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Destination, LotCrop, LotDetails, Priorities, Travel } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { marketAccess } from "./access";
import { explain, type Explanation } from "./explain";
import { rotations } from "./rotations";

const lib = CROP_LIBRARY_FIXTURE;
const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50 };
const known: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const unknown: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown" };
const crops = (...ids: string[]): LotCrop[] => ids.map((crop_id) => ({ crop_id, seasons: [{ plant_month: 6, harvest_month: 10 }] }));

function run(details: LotDetails, lotCrops: LotCrop[] = crops("lowland-rice"), access = null as ReturnType<typeof marketAccess> | null) {
  const lot = { crops: lotCrops, details };
  const result = rotations({
    lot,
    data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
    library: lib,
    priorities: EQUAL,
    marketAccess: access?.scores ?? null,
  });
  return { result, ex: explain({ result, lot, data: ILIGAN_LOT_FIXTURE, library: lib, access }) };
}

const text = (e: Explanation) =>
  [e.why, e.evidence, e.benefits, e.tradeoffs, e.unknowns, e.check_locally].flat().map((l) => l.text).join("\n");

test("every option for the demo lot has all six fields filled and a confidence badge", () => {
  const { result, ex } = run(known);
  assert.equal(ex.length, result.options.length);
  assert.ok(ex.length >= 3);
  for (const e of ex) {
    for (const f of ["why", "evidence", "benefits", "unknowns", "check_locally"] as const) {
      assert.ok(e[f].length > 0, `${e.option_key}.${f} is empty`);
      for (const l of e[f]) assert.ok(l.text.trim().length > 0 && l.code.length > 0);
    }
    assert.ok(["high", "medium", "low"].includes(e.confidence.level));
  }
  assert.deepEqual(ex.map((e) => e.option_key), result.options.map((o) => o.key));
});

test("option A says it is the baseline; the others name the components where they beat A", () => {
  const { result, ex } = run(known);
  assert.equal(ex[0].why[0].code, "why.yours");
  for (const e of ex.slice(1)) {
    const opt = result.options.find((o) => o.key === e.option_key)!;
    const a = result.options[0];
    const beats = (["W", "H", "S", "E", "B", "I", "M", "L"] as const).filter(
      (k) => opt.scores[k] !== null && a.scores[k] !== null && (opt.scores[k] as number) - (a.scores[k] as number) >= 1,
    );
    if (beats.length === 0) assert.equal(e.why[0].code, "why.none");
    else {
      assert.ok(e.why.length >= 1 && e.why.length <= 2, "at most the top 2 components");
      for (const w of e.why) assert.ok(w.code === "why.scores" || beats.includes(w.code.slice(4) as never));
    }
    // benefits list exactly the improving components, each with a signed whole-number delta
    const listed = e.benefits.filter((b) => b.code.startsWith("benefit.") && b.code.length === 9).map((b) => b.code.slice(8));
    assert.deepEqual(listed.sort(), [...beats].sort());
    for (const b of e.benefits) if (/^benefit\.[A-Z]$/.test(b.code)) assert.match(b.text, /\+\d+ points/);
  }
});

test('changing an input to "I don\'t know" lowers confidence', () => {
  const order = { low: 0, medium: 1, high: 2 } as const;
  const a = run(known).ex;
  const b = run(unknown).ex;
  const sum = (ex: Explanation[]) => ex.reduce((s, e) => s + order[e.confidence.level], 0);
  assert.ok(sum(b) < sum(a), "unknown details must lower confidence overall");
  for (const e of b) {
    assert.equal(e.confidence.level, "low");
    assert.ok(e.confidence.reasons.includes("unknown-inputs"));
    assert.ok(e.unknowns.some((u) => u.code === "unknown.land-type"));
    assert.ok(e.unknowns.some((u) => u.code === "unknown.water"));
    assert.ok(e.unknowns.some((u) => u.code === "unknown.soil"));
  }
  // exactly one unknown input is Medium at best, never High
  const one = run({ ...known, soil: "unknown" }).ex;
  for (const e of one) assert.notEqual(e.confidence.level, "high");
});

test("the typical-calendar (assumed) months count as a farmer-estimate input", () => {
  const { ex } = run(known, [{ crop_id: "lowland-rice", seasons: [] }]);
  assert.ok(ex[0].unknowns.some((u) => u.code === "unknown.calendar"));
  assert.ok(ex[0].confidence.reasons.some((r) => r === "one-unknown-input" || r === "unknown-inputs"));
  assert.ok(ex[0].why[0].text.includes("assumed"));
});

test("a live lot without elevation gets the grid-cell and sea-level unknowns", () => {
  const { ex } = run(known);
  for (const e of ex) {
    assert.ok(e.unknowns.some((u) => u.code === "unknown.grid-cell"));
    assert.ok(e.unknowns.some((u) => u.code === "unknown.elevation"));
  }
});

test("without a destination market access is reported as not scored; with one, transport cost is excluded and travel is cited", () => {
  const off = run(known).ex;
  assert.ok(off[0].unknowns.some((u) => u.code === "unknown.no-destination"));

  const dest: Destination = { id: "d1", name: "Town market", type: "market", point: [124.3, 8.28], mode: "motorcycle", load_kg_per_trip: null, fare_one_way: null };
  const travel: Travel[] = [{ destination_id: "d1", distance_km: 10, minutes: 40, source: "estimate", route_profile: null }];
  const access = marketAccess({ crops: lib.crops, destinations: [dest], travel });
  const { ex } = run(known, crops("lowland-rice"), access);
  assert.ok(ex[0].unknowns.some((u) => u.code === "unknown.transport-cost"));
  assert.ok(ex[0].check_locally.some((c) => c.code === "check.travel-confirm"), "rough estimate must ask the farmer to confirm");
  assert.ok(ex[0].evidence.some((e) => e.code === "evidence.travel" && e.text.includes("rough estimate")));
});

test("check-locally is crop specific and always ends with the technician line (rule 6)", () => {
  const { ex } = run(known, crops("lowland-rice", "mungbean"));
  const withMung = ex.find((e) => e.check_locally.some((c) => c.code === "check.waterlogging.mungbean"));
  assert.ok(withMung, "mungbean has low waterlogging tolerance in the fixture");
  for (const e of ex) {
    const last = e.check_locally[e.check_locally.length - 1];
    assert.equal(last.code, "check.technician");
    assert.match(last.text, /does not replace/);
  }
});

test("texts never use the word AI, and every number in a why line comes from the engine output", () => {
  const { result, ex } = run(known);
  for (const e of ex) assert.doesNotMatch(text(e), /\bAI\b/);
  // the water sentence for an option quotes exactly the option's and A's typical-year WSI, rounded
  for (const e of ex) {
    const w = e.why.find((l) => l.code === "why.W");
    if (!w) continue;
    const opt = result.options.find((o) => o.key === e.option_key)!;
    const a = result.options[0];
    assert.ok(w.text.includes(`${Math.round((a.metrics.wsi_mean.p50 as number) * 100)}% to ${Math.round((opt.metrics.wsi_mean.p50 as number) * 100)}%`), w.text);
  }
});

test("the ranking flipping between a dry and a wet year gives low confidence", () => {
  const { result } = run(known);
  // Build a result where B beats A on the total in a dry year but loses to A in a
  // wet year: same scores except water fit, so only the rain scenario decides.
  const flipped = structuredClone(result);
  flipped.options[1].scores = { ...flipped.options[0].scores };
  flipped.options[0].water_fit_range = { p20: 50, p50: 60, p80: 90 };
  flipped.options[1].water_fit_range = { p20: 80, p50: 70, p80: 60 };
  const ex = explain({ result: flipped, lot: { details: known }, data: ILIGAN_LOT_FIXTURE, library: lib });
  for (const e of [ex[0], ex[1]]) {
    assert.equal(e.confidence.level, "low");
    assert.ok(e.confidence.reasons.includes("ranking-flips-dry-wet"));
  }
});

test("a water-fit swap that doesn't change which option scores higher overall is not a flip", () => {
  const { result } = run(known, [{ crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] }]);
  // B's other scores keep it above A in both years, even though A has the better wet-year water fit.
  const steady = structuredClone(result);
  steady.options[1].scores = { ...steady.options[0].scores, S: (steady.options[0].scores.S as number) + 40 };
  steady.options[0].water_fit_range = { p20: 50, p50: 60, p80: 70 };
  steady.options[1].water_fit_range = { p20: 60, p50: 60, p80: 60 };
  const b = explain({ result: steady, lot: { details: known }, data: ILIGAN_LOT_FIXTURE, library: lib })[1];
  assert.ok(!b.confidence.reasons.includes("ranking-flips-dry-wet"), b.confidence.reasons.join(", "));
});

test("a missing water fit range is reported and keeps confidence below High", () => {
  const { result } = run(known);
  const gap = structuredClone(result);
  gap.options[1].water_fit_range = { p20: null, p50: 60, p80: null };
  const b = explain({ result: gap, lot: { details: known }, data: ILIGAN_LOT_FIXTURE, library: lib })[1];
  assert.ok(b.confidence.reasons.includes("dry-wet-not-checked"));
  assert.notEqual(b.confidence.level, "high");
});

test("soil feel counts as an unknown input only when paddy rice is in the comparison", () => {
  const cornOnly = [{ crop_id: "corn", seasons: [{ plant_month: 5, harvest_month: 8 }] }];
  const { result, ex } = run({ ...known, soil: "unknown" }, cornOnly);
  for (const e of ex) {
    const opt = result.options.find((o) => o.key === e.option_key)!;
    const rice = [opt, result.options[0]].some((o) => o.slots.some((s) => s.crop_id === "lowland-rice"));
    assert.equal(e.unknowns.some((u) => u.code === "unknown.soil"), rice, e.option_key);
    assert.equal(e.confidence.reasons.includes("one-unknown-input"), rice, e.option_key);
  }
});

test("evidence names each data source with its period and the crops.json citations actually used", () => {
  const { ex } = run(known, crops("lowland-rice", "mungbean"));
  for (const e of ex) {
    const rain = e.evidence.find((l) => l.code === "evidence.data.rain");
    assert.ok(rain && rain.text.includes("NASA POWER PRECTOTCORR") && rain.text.includes("2001-2024"), rain?.text ?? "no rain line");
    assert.ok(e.evidence.some((l) => l.code.startsWith("evidence.crop.kc.") && l.text.includes("FAO-56")), e.option_key);
    assert.ok(!e.evidence.some((l) => l.code === "evidence.power"), "the general line is only a fallback");
  }
  const withMung = ex.find((e) => e.evidence.some((l) => l.code.startsWith("evidence.crop.n_fixing.")));
  assert.ok(withMung?.evidence.find((l) => l.code.startsWith("evidence.crop.n_fixing."))?.text.includes("Mungbean"));
  // Without provenance the general NASA POWER line is used.
  const { result } = run(known);
  const { provenance: _drop, ...noProv } = ILIGAN_LOT_FIXTURE;
  const bare = explain({ result, lot: { details: known }, data: noProv, library: lib });
  assert.ok(bare[0].evidence.some((l) => l.code === "evidence.power"));
});

test("each destination gets one road question naming its harvest months and its name", () => {
  const dest: Destination = { id: "d1", name: "Town market", type: "market", point: [124.3, 8.28], mode: "motorcycle", load_kg_per_trip: null, fare_one_way: null };
  const travel: Travel[] = [{ destination_id: "d1", distance_km: 10, minutes: 40, source: "farmer", route_profile: null }];
  const access = marketAccess({ crops: lib.crops, destinations: [dest], travel });
  const { result } = run(known, crops("lowland-rice"), access);
  const ex = explain({ result, lot: { details: known }, data: ILIGAN_LOT_FIXTURE, library: lib, access, destinations: [dest] });
  for (const e of ex) {
    const roads = e.check_locally.filter((c) => c.code.startsWith("check.road."));
    assert.equal(roads.length, 1, e.option_key);
    const opt = result.options.find((o) => o.key === e.option_key)!;
    for (const s of opt.slots) assert.ok(roads[0].text.includes(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][s.harvest_month - 1]), roads[0].text);
    assert.match(roads[0].text, /^You harvest in .+\. Is the road to Town market passable then\?$/);
    assert.equal(e.check_locally[e.check_locally.length - 1].code, "check.technician");
  }
});

test("component labels are the farmer-facing words from the spec", () => {
  const { ex } = run(known);
  const all = ex.flatMap((e) => [...e.benefits, ...e.tradeoffs, ...e.why]).map((l) => l.text).join("\n");
  assert.doesNotMatch(all, /\b(Water fit|Climate safety|Soil building|Erosion protection|Pest break)\b/);
  assert.match(all, /Fits your rain|Builds soil|Breaks pest cycles/);
});

test("missing crop-library values are listed once per crop and keep confidence below High", () => {
  const { result, ex } = run(known);
  const gapCrops = new Set(result.gaps.filter((g) => g.code === "crop-field-missing").map((g) => (g as { crop_id: string }).crop_id));
  assert.ok(gapCrops.size > 0, "the fixture library lacks market/labor/cover values");
  for (const e of ex) {
    const opt = result.options.find((o) => o.key === e.option_key)!;
    const shown = opt.slots.filter((s) => gapCrops.has(s.crop_id)).map((s) => s.crop_id);
    const lines = e.unknowns.filter((u) => u.code.startsWith("unknown.crop-fields."));
    assert.equal(lines.length, new Set(shown).size);
    if (shown.length > 0) {
      assert.ok(e.confidence.reasons.includes("crop-data-missing"));
      assert.notEqual(e.confidence.level, "high");
    }
  }
});

test("deterministic and does not change its input", () => {
  const { result } = run(known);
  const before = JSON.stringify(result);
  const input = { result, lot: { details: known }, data: ILIGAN_LOT_FIXTURE, library: lib };
  assert.deepEqual(explain(input), explain(input));
  assert.equal(JSON.stringify(result), before);
});
