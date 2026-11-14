/// <reference types="node" />
// Rotation options and component scores (#26, docs/07 §3-4 and §7 checks).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CropLibrary, LotCrop, LotData, LotDetails, Priorities } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { EROSION_SLOPE_FACTOR, MAX_CROPS_PER_ROTATION, MAX_NEW_CROPS, TURNAROUND_DAYS } from "./params";
import { rotations, tooSimilar, type RotationsInput } from "./rotations";
import { COMPONENT_KEYS, priorityWeights, rusleS, totalScore, type ComponentScores, type RotationSlot } from "./scores";
import { monthStartDay } from "./season";

const lib = CROP_LIBRARY_FIXTURE;
const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50, forage: 50 };
const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const flat = (v: number) => Array.from({ length: 12 }, () => v);

/** Synthetic lot climate for unit tests (not real data). */
function climate(o: { rain?: number; tmax?: number; tmin?: number; wet?: number } = {}): Pick<LotData, "monthly"> {
  const rain = o.rain ?? 1000;
  return {
    monthly: {
      precip_mm: { p20: flat(rain), p50: flat(rain), p80: flat(rain) },
      et0_mm: flat(100),
      tmax_c: flat(o.tmax ?? 31),
      tmin_c: flat(o.tmin ?? 23),
      rootzone_wetness: flat(o.wet ?? 0.5),
      rh2m_pct: null,
      ws2m_ms: null,
      solar_mj_m2_day: null,
      heat_days_gt35: null,
      heavy_rain_days_gt50mm: null,
      smap_rootzone_m3m3: null,
    },
  };
}

const iligan = { monthly: ILIGAN_LOT_FIXTURE.monthly };
const crops = (...ids: string[]): LotCrop[] => ids.map((crop_id) => ({ crop_id, seasons: [] }));
const run = (o: Partial<RotationsInput> = {}) =>
  rotations({
    lot: { crops: crops("lowland-rice"), details: lowland },
    data: iligan,
    library: lib,
    priorities: EQUAL,
    ...o,
  });

/** Slot occupancy as [start, end) day intervals on the circular year. */
function slotDays(s: RotationSlot): [number, number] {
  const start = monthStartDay(s.plant_month) + 14;
  return [start, start + Math.round(s.season_days)];
}

// --- Acceptance (#26) on the real Iligan fixture ---------------------------

test("demo lot: A (your crops) plus at least 2 alternatives, each with component scores and a total", () => {
  const r = run();
  assert.equal(r.options[0].key, "A");
  assert.equal(r.options[0].kind, "yours");
  assert.ok(r.options.length >= 3, `got ${r.options.map((o) => o.key)}`);
  for (const o of r.options) {
    assert.ok(o.total !== null && o.total >= 0 && o.total <= 100, o.key);
    for (const k of ["W", "H", "S", "E", "B"] as const) {
      const s = o.scores[k];
      assert.ok(s !== null && s >= 0 && s <= 100, `${o.key}.${k} = ${s}`);
    }
  }
});

test("stage 1: A uses the typical calendar, labeled assumed", () => {
  const a = run().options[0];
  const rice = lib.crops.find((c) => c.id === "lowland-rice")!;
  assert.equal(a.assumed_calendar, true);
  assert.deepEqual(
    a.slots.map((s) => s.plant_month).sort((x, y) => x - y),
    rice.typical_calendar.map((c) => c.plant_month).sort((x, y) => x - y),
  );
  assert.ok(a.slots.every((s) => s.origin === "typical-calendar"));
});

test("stage 2: A uses the farmer's own months", () => {
  const r = run({
    lot: { crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 7, harvest_month: 11 }] }], details: lowland },
  });
  const a = r.options[0];
  assert.equal(a.assumed_calendar, false);
  assert.deepEqual(a.slots.map((s) => [s.plant_month, s.origin]), [[7, "farmer"]]);
});

test("every pair of options differs by a crop or by a shift of more than one month", () => {
  const { options } = run();
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      assert.equal(tooSimilar(options[i].slots, options[j].slots), false, `${options[i].key} vs ${options[j].key}`);
    }
  }
});

test("alternatives: 1-3 crops, at most 2 new crops, keep a farmer crop, never overlap", () => {
  for (const o of run().options.slice(1)) {
    assert.ok(o.slots.length >= 1 && o.slots.length <= MAX_CROPS_PER_ROTATION, o.key);
    assert.ok(o.new_crop_ids.length <= MAX_NEW_CROPS, o.key);
    assert.equal(o.keeps_your_crop, true, o.key);
    assert.ok(o.slots.some((s) => s.crop_id === "lowland-rice"), o.key);
    const iv = o.slots.map(slotDays).sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < iv.length; k++) {
      const next = k + 1 < iv.length ? iv[k + 1][0] : iv[0][0] + 365;
      assert.ok(iv[k][1] + TURNAROUND_DAYS <= next, `${o.key}: turnaround after slot ${k}`);
    }
  }
});

test("alternatives use only planting months that pass the hard filters", () => {
  const r = run();
  for (const o of r.options.slice(1)) {
    for (const s of o.slots) assert.ok(r.feasible_start_months[s.crop_id].includes(s.plant_month), `${s.crop_id}@${s.plant_month}`);
  }
  // Iligan root-zone wetness is >= 0.9 from Jul to Jan, so the waterlogging
  // filter keeps the low-tolerance crops (corn, mungbean) to Feb-Apr plantings.
  for (const m of r.feasible_start_months["mungbean"]) assert.ok(m >= 2 && m <= 4, `mungbean@${m}`);
});

test("output is deterministic", () => {
  assert.deepEqual(run(), run());
});

test("top_total marks the option with the highest total", () => {
  const { options } = run();
  const best = Math.max(...options.map((o) => o.total ?? -1));
  for (const o of options) assert.equal(o.top_total, o.total === best, o.key);
});

// --- Hard filters (docs/07 §3 step 2) --------------------------------------

test("too hot for a crop: none of its months pass", () => {
  const r = run({ data: climate({ tmax: 44, tmin: 34 }) }); // mean 39 > rice max 38
  assert.deepEqual(r.feasible_start_months["lowland-rice"], []);
});

test("very wet months reject low-tolerance crops but not rice", () => {
  const r = run({ data: climate({ wet: 0.95 }) });
  assert.deepEqual(r.feasible_start_months["mungbean"], []);
  assert.deepEqual(r.feasible_start_months["corn"], []);
  assert.equal(r.feasible_start_months["lowland-rice"].length, 12);
});

test("A always shows, even when no alternative passes the filters (no rain)", () => {
  const r = run({ data: climate({ rain: 0 }) });
  assert.equal(r.candidates_scored, 0);
  assert.deepEqual(r.options.map((o) => o.key), ["A"]);
  assert.equal(r.options[0].scores.W, 0);
});

// --- Priorities (docs/07 §7: ranking moves in the expected direction) ------

test("changing priorities changes the ranking in the expected direction", () => {
  const water: ComponentScores = { W: 90, H: 90, S: 20, E: 40, B: 0, I: null, M: null, L: null, F: null };
  const soil: ComponentScores = { W: 50, H: 80, S: 60, E: 90, B: 100, I: null, M: null, L: null, F: null };
  const avail = new Set(COMPONENT_KEYS.filter((k) => water[k] !== null));
  const w = (p: Priorities) => priorityWeights(p, avail).weights;
  const waterFirst = w({ water: 100, soil: 20, income: 50, labor: 50 });
  const soilFirst = w({ water: 20, soil: 100, income: 50, labor: 50 });
  assert.ok(totalScore(water, waterFirst)! > totalScore(soil, waterFirst)!);
  assert.ok(totalScore(soil, soilFirst)! > totalScore(water, soilFirst)!);
});

test("on the demo lot, B tops the alternatives on water, and C beats D on soil", () => {
  // B is picked first, so it is the best water candidate distinct from A. C is
  // the best soil candidate distinct from A and B, so it beats D (also distinct
  // from both) but not necessarily B: on this lot B is also the best for soil.
  const { options } = run();
  const [b, c, d] = ["B", "C", "D"].map((k) => options.find((o) => o.key === k)!);
  const waterOnly = priorityWeights({ water: 100, soil: 0, income: 0, labor: 0, forage: 0 }, new Set(COMPONENT_KEYS)).weights;
  const soilOnly = priorityWeights({ water: 0, soil: 100, income: 0, labor: 0, forage: 0 }, new Set(COMPONENT_KEYS)).weights;
  for (const o of [c, d]) assert.ok(totalScore(b.scores, waterOnly)! >= totalScore(o.scores, waterOnly)!, o.key);
  assert.ok(totalScore(c.scores, soilOnly)! >= totalScore(d.scores, soilOnly)!);
});

test("weights: all sliders at 0 counts as equal; weights sum to 1", () => {
  const avail = new Set(COMPONENT_KEYS);
  const zero = priorityWeights({ water: 0, soil: 0, income: 0, labor: 0, forage: 0 }, avail).weights;
  const equal = priorityWeights(EQUAL, avail).weights;
  for (const k of COMPONENT_KEYS) assert.ok(Math.abs(zero[k] - equal[k]) < 1e-12, k);
  const sum = COMPONENT_KEYS.reduce((a, k) => a + equal[k], 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  // save water -> W, H; build soil -> S, E, B; extra income -> I, M; less work -> L, M.
  assert.ok(equal.M > equal.I && equal.M > equal.L);
});

// --- Left-out components ----------------------------------------------------

test("no destination: M is left out and the weights renormalize", () => {
  const r = run();
  assert.ok(r.components_left_out.includes("M"));
  assert.equal(r.weights.M, 0);
  for (const o of r.options) assert.equal(o.scores.M, null);
});

test("with market access scores (#27): M is the mean over the rotation's crops", () => {
  const access = { "lowland-rice": 80, corn: 60, mungbean: 40 };
  const r = run({ marketAccess: access });
  assert.ok(!r.components_left_out.includes("M"));
  assert.ok(r.weights.M > 0);
  assert.ok(!r.priorities_not_scored.includes("income"));
  for (const o of r.options) {
    const mean = o.slots.reduce((a, s) => a + access[s.crop_id as keyof typeof access], 0) / o.slots.length;
    assert.ok(Math.abs(o.scores.M! - mean) < 1e-9, o.key);
  }
});

test("crops.json without market/labor levels: I and L are left out, never guessed", () => {
  const r = run();
  assert.ok(r.components_left_out.includes("I") && r.components_left_out.includes("L"));
  assert.deepEqual(r.priorities_not_scored, ["income", "labor"]);
  assert.ok(r.gaps.some((g) => g.code === "crop-field-missing" && g.field === "market"));
});

test("with market and labor levels: I and L use the 30/60/90 scale", () => {
  const filled: CropLibrary = {
    ...lib,
    crops: lib.crops.map((c) => ({ ...c, market: "high" as const, labor: "high" as const })),
  };
  const r = run({ library: filled });
  assert.deepEqual(r.priorities_not_scored, []);
  for (const o of r.options) {
    assert.equal(o.scores.I, 90, o.key);
    assert.equal(o.scores.L, 30, o.key);
  }
});

test("unknown crop id: reported as a gap and left out of A", () => {
  const r = run({ lot: { crops: crops("lowland-rice", "durian"), details: lowland } });
  assert.ok(r.gaps.some((g) => g.code === "unknown-crop" && g.crop_id === "durian"));
  assert.ok(r.options[0].slots.every((s) => s.crop_id === "lowland-rice"));
});

// --- Component scores ---------------------------------------------------------

/** Score the farmer's own months as option A (no filters). */
const yours = (seasons: [string, number, number][], data: RotationsInput["data"] = iligan, details = lowland) =>
  run({
    lot: {
      crops: seasons.map(([crop_id, plant_month, harvest_month]) => ({
        crop_id,
        seasons: [{ plant_month, harvest_month }],
      })),
      details,
    },
    data,
  }).options[0];

test("P20 lowers W more for rice than for a legume in the same months (docs/07 §7)", () => {
  const rice = yours([["lowland-rice", 6, 10]]);
  const mung = yours([["mungbean", 6, 8]]);
  const drop = (o: typeof rice) => o.water_fit_range.p50! - o.water_fit_range.p20!;
  assert.ok(drop(rice) > drop(mung), `rice ${drop(rice)} vs mungbean ${drop(mung)}`);
});

test("pest break: rice after rice scores 0, rice then mungbean scores 100", () => {
  assert.equal(yours([["lowland-rice", 6, 10], ["lowland-rice", 11, 3]]).scores.B, 0);
  assert.equal(yours([["lowland-rice", 6, 10], ["mungbean", 11, 1]]).scores.B, 100);
});

test("soil building: a legume after rice beats rice alone; bare days fall", () => {
  const alone = yours([["lowland-rice", 6, 10]]);
  const withLegume = yours([["lowland-rice", 6, 10], ["mungbean", 11, 1]]);
  assert.ok(withLegume.scores.S! > alone.scores.S!);
  assert.ok(withLegume.metrics.bare_days < alone.metrics.bare_days);
  assert.ok(withLegume.metrics.legume_days > 0);
});

test("erosion protection: the same bare months cost more on a sloping lot", () => {
  const sloping: LotDetails = { ...lowland, land_type: "sloping" };
  const flatLot = yours([["corn", 6, 9]]);
  const slope = yours([["corn", 6, 9]], iligan, sloping);
  assert.ok(slope.scores.E! < flatLot.scores.E!);
  assert.equal(flatLot.metrics.rain_weight, "p50-rain");
});

test("climate risk: a low-tolerance crop in very wet months lowers H; overlapping crops count once for bare days", () => {
  const wet = climate({ wet: 0.95 });
  assert.ok(yours([["mungbean", 6, 8]], wet).scores.H! < 100);
  assert.equal(yours([["lowland-rice", 6, 10]], wet).scores.H, 100);
  const inter = yours([["lowland-rice", 6, 10], ["mungbean", 6, 8]]);
  const alone = yours([["lowland-rice", 6, 10]]);
  assert.equal(inter.metrics.bare_days, alone.metrics.bare_days);
});

// --- De-duplication rule -------------------------------------------------------

const s = (crop_id: string, plant_month: number): RotationSlot => ({
  crop_id,
  plant_month,
  harvest_month: plant_month,
  season_days: 100,
  origin: "engine",
});

test("tooSimilar: same crops within one month are duplicates; a crop or a 2-month shift makes them distinct", () => {
  assert.equal(tooSimilar([s("rice", 6)], [s("rice", 7)]), true);
  assert.equal(tooSimilar([s("rice", 6)], [s("rice", 8)]), false);
  assert.equal(tooSimilar([s("rice", 6)], [s("corn", 6)]), false);
  assert.equal(tooSimilar([s("rice", 6), s("mung", 2)], [s("rice", 6)]), false);
  assert.equal(tooSimilar([s("rice", 12)], [s("rice", 1)]), true); // wraps the year
  // Matches slots of the same crop in the best order.
  assert.equal(tooSimilar([s("rice", 1), s("rice", 6)], [s("rice", 6), s("rice", 12)]), true);
});

// --- NASA SRTM slope in erosion protection (RUSLE S) ---------------------------

test("RUSLE S (McCool et al. 1987): about 1 at the 9 % unit plot, steeper slopes higher, flat near 0.03", () => {
  assert.ok(Math.abs(rusleS(9) - 1) < 0.01, `S(9) = ${rusleS(9)}`);
  assert.ok(Math.abs(rusleS(0) - 0.03) < 1e-9);
  // Hand check: 20 % slope, sin(atan(0.2)) = 0.19612, 16.8 x 0.19612 - 0.5 = 2.795
  assert.ok(Math.abs(rusleS(20) - 2.795) < 0.001, `S(20) = ${rusleS(20)}`);
  // Hand check: 5 % slope, sin(atan(0.05)) = 0.04994, 10.8 x 0.04994 + 0.03 = 0.569
  assert.ok(Math.abs(rusleS(5) - 0.569) < 0.001, `S(5) = ${rusleS(5)}`);
  assert.ok(rusleS(3) < rusleS(8) && rusleS(8) < rusleS(12));
});

test("erosion uses the SRTM slope when known; land type stays the fallback and is kept for lowland paddies", () => {
  const upland: LotDetails = { ...lowland, land_type: "unknown" };
  const withSlope = (pct: number | null, details: LotDetails) => yours([["corn", 6, 9]], { ...iligan, slope_pct: pct }, details);
  const steep = withSlope(20, upland);
  const gentle = withSlope(2, upland);
  const none = withSlope(null, upland);
  assert.equal(steep.metrics.erosion_slope.source, "srtm");
  assert.equal(steep.metrics.erosion_slope.slope_pct, 20);
  assert.ok(steep.scores.E! < none.scores.E! && none.scores.E! < gentle.scores.E!);
  assert.equal(none.metrics.erosion_slope.source, "land-type");
  assert.equal(none.metrics.erosion_slope.factor, EROSION_SLOPE_FACTOR.unknown);
  // A bunded lowland paddy keeps the land-type factor even with a steep SRTM cell.
  const paddy = withSlope(20, lowland);
  assert.equal(paddy.metrics.erosion_slope.source, "land-type");
  assert.equal(paddy.metrics.erosion_slope.factor, EROSION_SLOPE_FACTOR.lowland);
  // E = 100 x (1 - S x bare-rain share), clamped to 0-100.
  const share = steep.metrics.bare_rain_share!;
  assert.ok(Math.abs(steep.scores.E! - Math.max(0, 100 * (1 - rusleS(20) * share))) < 1e-9);
});

// --- Feeds your animals (F, crops.json forage_residue) --------------------------

test("F = share of crop days on crops whose residue is commonly fed to livestock", () => {
  // Rice and mungbean residue are both cited as fed in the library: F = 100.
  assert.equal(yours([["lowland-rice", 6, 10], ["mungbean", 11, 1]]).scores.F, 100);
  // With mungbean marked "no" (test data, not a claim), F = rice days / all crop days.
  const noMung: CropLibrary = { ...lib, crops: lib.crops.map((c) => (c.id === "mungbean" ? { ...c, forage_residue: false } : c)) };
  const r = run({
    library: noMung,
    lot: { crops: [{ crop_id: "lowland-rice", seasons: [{ plant_month: 6, harvest_month: 10 }] }, { crop_id: "mungbean", seasons: [{ plant_month: 11, harvest_month: 1 }] }], details: lowland },
  }).options[0];
  const share = r.metrics.forage_days / r.metrics.crop_days;
  assert.ok(share > 0 && share < 1);
  assert.ok(Math.abs(r.scores.F! - 100 * share) < 1e-9);
});

test("F: a crop with no forage value gets no credit and is reported; no forage data at all leaves F out", () => {
  const unknownMung: CropLibrary = { ...lib, crops: lib.crops.map((c) => (c.id === "mungbean" ? { ...c, forage_residue: null } : c)) };
  const r = run({ library: unknownMung, lot: { crops: crops("lowland-rice", "mungbean"), details: lowland } });
  assert.ok(r.gaps.some((g) => g.code === "crop-field-missing" && g.crop_id === "mungbean" && g.field === "forage_residue"));
  const none: CropLibrary = { ...lib, crops: lib.crops.map((c) => ({ ...c, forage_residue: null })) };
  const n = run({ library: none });
  assert.ok(n.components_left_out.includes("F"));
  assert.ok(n.priorities_not_scored.includes("forage"));
  assert.ok(!n.gaps.some((g) => g.code === "crop-field-missing" && g.field === "forage_residue"), "no per-crop gap when the library has no forage data at all");
  for (const o of n.options) assert.equal(o.scores.F, null);
});

test("a saved farm without the forage priority counts it as the default (50)", () => {
  const avail = new Set(COMPONENT_KEYS);
  const old = priorityWeights({ water: 50, soil: 50, income: 50, labor: 50 }, avail).weights;
  const now = priorityWeights(EQUAL, avail).weights;
  for (const k of COMPONENT_KEYS) assert.ok(Math.abs(old[k] - now[k]) < 1e-12, k);
  assert.ok(now.F > 0);
  // "Feed animals" alone weighs only F.
  const only = priorityWeights({ water: 0, soil: 0, income: 0, labor: 0, forage: 100 }, avail).weights;
  assert.equal(only.F, 1);
});
