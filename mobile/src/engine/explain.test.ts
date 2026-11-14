/// <reference types="node" />
// Explanations and confidence (#28, docs/07 §5).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Destination, LotCrop, LotDetails, Priorities, Travel } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { marketAccess, type MarketAccessResult } from "./access";
import {
  explain,
  formatMinutes,
  formatMonths,
  listJoin,
  shortCitation,
  TECHNICIAN_LINE,
  type ConfidenceLevel,
  type ExplainResult,
  type OptionExplanation,
} from "./explain";
import { WHY_TOP_COMPONENTS } from "./params";
import { rotations, type RotationOption, type RotationsResult } from "./rotations";
import { COMPONENT_KEYS } from "./scores";

const lib = CROP_LIBRARY_FIXTURE;
const data = ILIGAN_LOT_FIXTURE;
const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50 };
const KNOWN: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };
const typical = (...ids: string[]): LotCrop[] => ids.map((crop_id) => ({ crop_id, seasons: [] }));
/** The farmer's own rice months (same months as the fixture's typical calendar). */
const FARMER_RICE: LotCrop[] = [
  {
    crop_id: "lowland-rice",
    seasons: [
      { plant_month: 6, harvest_month: 10 },
      { plant_month: 11, harvest_month: 3 },
    ],
  },
];

interface RunOpts {
  crops?: LotCrop[];
  details?: LotDetails;
  priorities?: Priorities;
  access?: MarketAccessResult | null;
  destinations?: Destination[];
}

function run(o: RunOpts = {}): { result: RotationsResult; out: ExplainResult } {
  const lot = { crops: o.crops ?? typical("lowland-rice"), details: o.details ?? KNOWN };
  const result = rotations({
    lot,
    data,
    library: lib,
    priorities: o.priorities ?? EQUAL,
    marketAccess: o.access?.scores ?? null,
  });
  const out = explain({ result, lot, data, library: lib, access: o.access ?? null, destinations: o.destinations });
  return { result, out };
}

const opt = (r: RotationsResult, key: string) => r.options.find((o) => o.key === key) as RotationOption;
const exp = (r: ExplainResult, key: string) => r.options.find((o) => o.key === key) as OptionExplanation;
const allText = (e: OptionExplanation) => [
  ...e.why,
  ...e.evidence.map((x) => x.text),
  ...e.benefits.map((x) => x.text),
  ...e.tradeoffs.map((x) => x.text),
  ...e.unknowns,
  ...e.check_locally,
  ...e.confidence.reasons,
];

function market(minutes: number, source: Travel["source"]): { destinations: Destination[]; access: MarketAccessResult } {
  const destinations: Destination[] = [
    { id: "d1", name: "Iligan market", type: "market", point: [124.24, 8.23], mode: "jeepney", load_kg_per_trip: null, fare_one_way: null },
  ];
  const travel: Travel[] = [{ destination_id: "d1", distance_km: 20, minutes, source, route_profile: null }];
  return { destinations, access: marketAccess({ crops: lib.crops, destinations, travel }) };
}

// --- Acceptance (#28) ---------------------------------------------------------

test("demo lot: every option has all six fields filled", () => {
  const { result, out } = run();
  assert.deepEqual(
    out.options.map((o) => o.key),
    result.options.map((o) => o.key),
  );
  assert.ok(out.options.length >= 3);
  for (const e of out.options) {
    assert.ok(e.why.length > 0, `${e.key} why`);
    assert.ok(e.evidence.length > 0, `${e.key} evidence`);
    assert.ok(e.benefits.length > 0, `${e.key} benefits`);
    assert.ok(e.unknowns.length > 0, `${e.key} unknowns`);
    assert.ok(e.check_locally.length > 0, `${e.key} check locally`);
    assert.ok(["high", "medium", "low"].includes(e.confidence.level), `${e.key} confidence`);
    assert.ok(e.confidence.reasons.length > 0, `${e.key} confidence reasons`);
    for (const line of allText(e)) assert.ok(line.trim().length > 0, `${e.key}: empty line`);
  }
});

test("changing an input to \"I don't know\" lowers confidence", () => {
  const base = run({ crops: FARMER_RICE }).out;
  for (const e of base.options) {
    assert.equal(e.confidence.level, "high", `${e.key}: ${e.confidence.reasons.join(" | ")}`);
    assert.deepEqual(e.confidence.weak_inputs, []);
  }
  const oneUnknown = run({ crops: FARMER_RICE, details: { ...KNOWN, land_type: "unknown" } }).out;
  const twoUnknown = run({ crops: FARMER_RICE, details: { ...KNOWN, land_type: "unknown", water: "unknown" } }).out;
  for (const e of base.options) {
    const one = exp(oneUnknown, e.key);
    assert.ok(RANK[one.confidence.level] < RANK[e.confidence.level], `${e.key}: ${one.confidence.level}`);
    assert.ok(one.confidence.weak_inputs.includes("land-type"));
    assert.ok(one.confidence.reasons.some((r) => r.includes("land type")));
    assert.equal(exp(twoUnknown, e.key).confidence.level, "low", e.key);
  }
});

test("months not given count as a weak input: the typical calendar is assumed", () => {
  const assumed = run().out;
  const given = run({ crops: FARMER_RICE }).out;
  for (const e of assumed.options) {
    assert.ok(e.confidence.weak_inputs.includes("planting-months"), e.key);
    assert.ok(e.unknowns.some((u) => u.includes("(assumed)")), e.key);
    assert.ok(RANK[e.confidence.level] < RANK[exp(given, e.key).confidence.level], e.key);
  }
  assert.ok(exp(assumed, "A").check_locally.some((c) => c.includes("usual planting months")));
  for (const e of given.options) assert.ok(!e.unknowns.some((u) => u.includes("(assumed)")), e.key);
});

test("soil type counts only when ponded rice is in the comparison", () => {
  const corn: LotCrop[] = [{ crop_id: "corn", seasons: [{ plant_month: 5, harvest_month: 8 }] }];
  const { result, out } = run({ crops: corn, details: { ...KNOWN, soil: "unknown" } });
  for (const o of result.options) {
    const hasRice = o.slots.some((s) => s.crop_id === "lowland-rice");
    assert.equal(exp(out, o.key).confidence.weak_inputs.includes("soil"), hasRice, o.key);
  }
  const rice = run({ crops: FARMER_RICE, details: { ...KNOWN, soil: "unknown" } }).out;
  for (const e of rice.options) assert.ok(e.confidence.weak_inputs.includes("soil"), e.key);
});

// --- Confidence: dry vs wet year (docs/07 §5) ------------------------------------

/** Two options with equal scores except the water fit range. */
function flipCase(a: [number, number], b: [number, number]): ExplainResult {
  const { result } = run({ crops: FARMER_RICE });
  const scores = { W: 50, H: 50, S: 50, E: 50, B: 50, I: null, M: null, L: null };
  const A = { ...opt(result, "A"), scores, water_fit_range: { p20: a[0], p50: 50, p80: a[1] }, total: 50, missing_scores: [] };
  const B = { ...opt(result, "B"), scores, water_fit_range: { p20: b[0], p50: 50, p80: b[1] }, total: 50, missing_scores: [] };
  const fake: RotationsResult = { ...result, options: [A, B] };
  return explain({ result: fake, lot: { crops: FARMER_RICE, details: KNOWN }, data, library: lib });
}

test("a ranking that flips between a dry (P20) and a wet (P80) year is Low", () => {
  const flip = flipCase([60, 40], [40, 60]);
  for (const key of ["A", "B"]) {
    const c = exp(flip, key).confidence;
    assert.equal(c.ranking_flips, true, key);
    assert.equal(c.level, "low", key);
  }
  assert.ok(exp(flip, "B").confidence.reasons[0].includes("In a dry year this option scores below your crops"));
  assert.ok(exp(flip, "A").confidence.reasons[0].includes("B"));

  const steady = flipCase([60, 50], [40, 45]);
  for (const key of ["A", "B"]) {
    assert.equal(exp(steady, key).confidence.ranking_flips, false, key);
    assert.equal(exp(steady, key).confidence.level, "high", key);
  }
});

test("missing water fit range: the flip check is reported as not done, never High", () => {
  const { result } = run({ crops: FARMER_RICE });
  const B = { ...opt(result, "B"), water_fit_range: { p20: null, p50: 50, p80: null } };
  const fake: RotationsResult = { ...result, options: [opt(result, "A"), B] };
  const e = exp(explain({ result: fake, lot: { crops: FARMER_RICE, details: KNOWN }, data, library: lib }), "B");
  assert.equal(e.confidence.ranking_flips, null);
  assert.equal(e.confidence.level, "medium");
  assert.ok(e.confidence.reasons.some((r) => r.includes("could not be done")));
});

// --- Numbers come from the engine (CLAUDE.md rule 3) ------------------------

test("benefits and trade-offs are the rounded score differences against A", () => {
  const { result, out } = run();
  const a = opt(result, "A");
  for (const o of result.options.filter((x) => x.key !== "A")) {
    const e = exp(out, o.key);
    for (const k of COMPONENT_KEYS) {
      const x = o.scores[k];
      const y = a.scores[k];
      const d = x === null || y === null ? 0 : Math.round(x) - Math.round(y);
      const ben = e.benefits.find((b) => b.component === k);
      const off = e.tradeoffs.find((b) => b.component === k);
      if (d >= 1) assert.equal(ben?.delta, d, `${o.key}.${k}`);
      else assert.equal(ben, undefined, `${o.key}.${k}`);
      if (d <= -1) assert.equal(off?.delta, d, `${o.key}.${k}`);
      else assert.equal(off, undefined, `${o.key}.${k}`);
    }
    const bare = [...e.benefits, ...e.tradeoffs].find((b) => b.label === "Bare months");
    if (bare) assert.deepEqual([bare.from, bare.to], [a.metrics.bare_months.length, o.metrics.bare_months.length]);
  }
});

test("water driver: the % of water needs covered and the period come from the engine and provenance", () => {
  const { result, out } = run();
  const a = opt(result, "A");
  const b = opt(result, "B");
  const line = exp(out, "B").why.find((w) => w.startsWith("Rain covers about"));
  assert.ok(line, exp(out, "B").why.join(" | "));
  const [x, y] = [...line.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
  assert.equal(x, Math.round(100 * (1 - (b.metrics.wsi_mean.p50 as number))));
  assert.equal(y, Math.round(100 * (1 - (a.metrics.wsi_mean.p50 as number))));
  const period = data.provenance.find((p) => p.field === "monthly.precip_mm")?.period as string;
  assert.ok(line.includes(`NASA POWER rainfall, ${period}`));
});

test("why: what changes, then at most the top components, led by the option's focus", () => {
  const { result, out } = run();
  for (const e of out.options.filter((x) => x.key !== "A")) {
    assert.ok(e.why.length <= 1 + WHY_TOP_COMPONENTS, e.key);
    assert.ok(e.why[0].includes("Plants "), e.why[0]);
  }
  const b = opt(result, "B");
  const a = opt(result, "A");
  if ((b.scores.W as number) - (a.scores.W as number) >= 1) assert.ok(exp(out, "B").why[1].startsWith("Rain covers"));
  assert.ok(exp(out, "B").why[0].startsWith("Adds mungbean."), exp(out, "B").why[0]);
  assert.ok(exp(out, "A").why[0].startsWith("These are your crops"));
});

test("evidence lists the rain source with its period and the crop references actually used", () => {
  const { out } = run();
  for (const e of out.options) {
    const rain = e.evidence.find((x) => x.topic === "Rainfall");
    assert.equal(rain?.source, "NASA POWER PRECTOTCORR");
    assert.equal(rain?.period, "2001-2024");
    assert.ok(e.evidence.some((x) => x.topic === "Crop water use" && x.source.includes("FAO-56")), e.key);
  }
  const b = exp(out, "B");
  const n = b.evidence.find((x) => x.topic === "Adds nitrogen");
  assert.deepEqual(n?.crop_ids, ["mungbean"]);
  // Usual-month references only for crops that use the typical calendar (rice in A).
  assert.ok(!b.evidence.some((x) => x.topic === "Usual planting months" && x.crop_ids.includes("mungbean")));
});

test("market access driver: how long the crop keeps and the travel time with its label", () => {
  const destinations: Destination[] = [
    { id: "s1", name: "Barangay warehouse", type: "storage", point: [124.2, 8.2], mode: "walk", load_kg_per_trip: null, fare_one_way: null },
  ];
  const travel: Travel[] = [{ destination_id: "s1", distance_km: 1, minutes: 20, source: "estimate", route_profile: null }];
  const access = marketAccess({ crops: lib.crops, destinations, travel });
  const { result } = run({ crops: FARMER_RICE, access, destinations });
  const A = opt(result, "A");
  // B equal to A except market access, so M is the only component it wins on.
  const B = { ...opt(result, "B"), scores: { ...A.scores, M: 100 }, metrics: A.metrics, water_fit_range: A.water_fit_range };
  const fake: RotationsResult = { ...result, options: [{ ...A, scores: { ...A.scores, M: 40 } }, B] };
  const e = exp(explain({ result: fake, lot: { crops: FARMER_RICE, details: KNOWN }, data, library: lib, access, destinations }), "B");
  assert.equal(e.why.length, 2, e.why.join(" | "));
  assert.equal(e.why[1], "Mungbean keeps for months, so it can be stored at Barangay warehouse (20 min, rough estimate) and sold when prices are better.");
  assert.deepEqual(e.benefits.find((b) => b.component === "M")?.delta, 60);
});

// --- Unknowns and check locally ------------------------------------------------

test("no destination yet: market access is not scored and the farmer is asked to add a place", () => {
  const { out } = run();
  for (const e of out.options) {
    assert.ok(e.unknowns.some((u) => u.startsWith("Market access is not scored yet")), e.key);
    assert.ok(!e.unknowns.includes("Transport cost is not included."), e.key);
  }
});

test("travel: rough estimate asks to confirm, transport cost not included, road question per harvest", () => {
  const { destinations, access } = market(100, "estimate");
  const { out } = run({ crops: FARMER_RICE, access, destinations });
  for (const e of out.options) {
    assert.ok(e.unknowns.includes("Transport cost is not included."), e.key);
    assert.ok(e.unknowns.some((u) => u.includes("Iligan market is a rough estimate (1 h 40 min)")), e.key);
    assert.ok(e.check_locally.some((c) => /^You harvest in .+: is the road to Iligan market passable then\?$/.test(c)), e.key);
    assert.ok(e.evidence.some((x) => x.text === "Travel time: rough estimate"), e.key);
    assert.ok(e.confidence.weak_inputs.includes("travel-time"), e.key);
  }
  const mine = run({ crops: FARMER_RICE, ...market(100, "farmer") }).out;
  for (const e of mine.options) {
    assert.ok(!e.unknowns.some((u) => u.includes("rough estimate")), e.key);
    assert.ok(!e.confidence.weak_inputs.includes("travel-time"), e.key);
  }
});

test("check locally: drainage after rice, seed and pests for new crops, and the technician line last", () => {
  const { out } = run();
  const b = exp(out, "B");
  assert.ok(b.check_locally.includes("Mungbean doesn't tolerate waterlogging: does the field drain well after lowland rice?"));
  assert.ok(b.check_locally.some((c) => c.startsWith("Can you get good mungbean seed nearby")));
  assert.ok(b.check_locally.some((c) => c.startsWith("Which mungbean pests and diseases")));
  for (const e of out.options) assert.equal(e.check_locally[e.check_locally.length - 1], TECHNICIAN_LINE, e.key);
  // A has no new crops, so no seed question.
  assert.ok(!exp(out, "A").check_locally.some((c) => c.includes("seed")));
});

test("unknowns: \"I don't know\" answers say what was assumed; lot caveats are passed through", () => {
  const { out } = run({ details: { land_type: "unknown", water: "unknown", soil: "unknown" } });
  const a = exp(out, "A");
  assert.ok(a.unknowns.includes("Water source not given, so no irrigation was assumed."));
  assert.ok(a.unknowns.some((u) => u.startsWith("Land type not given")));
  assert.ok(a.unknowns.includes("Soil type not given, so rice water loss uses an average soil."));
  for (const c of data.caveats) assert.ok(a.unknowns.includes(c));
  assert.ok(!a.evidence.some((x) => x.topic === "Your lot details"));
});

// --- Rules -------------------------------------------------------------------

test("no text says \"AI\" (CLAUDE.md rule 1) and every option keeps the support-not-replace line (rule 6)", () => {
  const { out } = run({ ...market(100, "estimate") });
  for (const e of out.options) {
    for (const line of allText(e)) assert.doesNotMatch(line, /\bAI\b/, line);
    assert.ok(e.check_locally.includes(TECHNICIAN_LINE));
  }
});

test("deterministic: the same input gives the same explanation", () => {
  assert.deepEqual(run().out, run().out);
});

test("explain needs option A", () => {
  const { result } = run();
  const fake: RotationsResult = { ...result, options: result.options.filter((o) => o.key !== "A") };
  assert.throws(() => explain({ result: fake, lot: { crops: [], details: KNOWN }, data, library: lib }), /option A/);
});

// --- Formatting -----------------------------------------------------------------

test("formatting helpers", () => {
  assert.equal(formatMonths([2, 3, 4]), "Feb–Apr");
  assert.equal(formatMonths([12, 1, 2]), "Dec–Feb");
  assert.equal(formatMonths([1, 3]), "Jan and Mar");
  assert.equal(formatMonths([11, 12, 1, 5]), "May and Nov–Jan");
  assert.equal(formatMonths([]), "none");
  assert.equal(formatMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "all year");
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(60), "1 h");
  assert.equal(formatMinutes(70), "1 h 10 min");
  assert.equal(formatMinutes(59.6), "1 h");
  assert.equal(listJoin(["a"]), "a");
  assert.equal(listJoin(["a", "b", "c"]), "a, b and c");
  assert.equal(shortCitation("Allen et al. 1998, FAO-56 Table 12 (single Kc for non-stressed crops)"), "Allen et al. 1998, FAO-56 Table 12");
  assert.equal(shortCitation("DA HVCDP, Mungbean Production Guide: harvest 60-70 days"), "DA HVCDP, Mungbean Production Guide");
});
