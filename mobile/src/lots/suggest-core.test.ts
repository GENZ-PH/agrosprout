/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { cropFit, type FitLevel } from "../engine/cropFit";
import { cropSeasonDays, harvestMonthOf } from "../engine/season";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { CropLibrary, LotDetails } from "../types";
import { goodMonthsText, lotSuggestions, noCropFits, safeLotTop, topCropReason, topCrops, type CropSuggestion, type LotSuggestions } from "./suggest-core";
import { fitReasonText } from "../components/recommendations-core";
import { monthShort } from "./months-core";

// Read from disk: Node's test runner can't import JSON without import attributes (same as crops.test.ts).
const CROP_LIBRARY = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "crops.json"), "utf8")) as CropLibrary;

const UNKNOWN: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown" };
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

test("rates every library crop on this lot, in library order", () => {
  const { crops } = lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  assert.deepEqual(
    crops.map((c) => c.crop_id),
    CROP_LIBRARY.crops.map((c) => c.id),
  );
});

test("good months = planting months where the engine's crop fit is Good for one season of the crop's length", () => {
  const { crops } = lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  for (const crop of CROP_LIBRARY.crops) {
    const days = cropSeasonDays(crop).days;
    const expected =
      days === null
        ? []
        : MONTHS.filter(
            (m) =>
              cropFit({
                crop,
                lotCrop: { crop_id: crop.id, seasons: [{ plant_month: m, harvest_month: harvestMonthOf(m, days) }] },
                details: UNKNOWN,
                data: ILIGAN_LOT_FIXTURE,
                library: CROP_LIBRARY,
              }).level === "good",
          );
    assert.deepEqual(crops.find((c) => c.crop_id === crop.id)?.good_months, expected, crop.id);
  }
});

test("a crop's level is its best month: good, then watch, then poor; unknown only when no month can be rated", () => {
  const { crops } = lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  const rank: Record<FitLevel, number> = { good: 0, watch: 1, poor: 2, unknown: 3 };
  for (const crop of CROP_LIBRARY.crops) {
    const days = cropSeasonDays(crop).days;
    const s = crops.find((c) => c.crop_id === crop.id)!;
    if (days === null) {
      assert.equal(s.level, "unknown", crop.id);
      continue;
    }
    const best = MONTHS.map(
      (m) =>
        cropFit({
          crop,
          lotCrop: { crop_id: crop.id, seasons: [{ plant_month: m, harvest_month: harvestMonthOf(m, days) }] },
          details: UNKNOWN,
          data: ILIGAN_LOT_FIXTURE,
          library: CROP_LIBRARY,
        }).level,
    ).reduce((a, b) => (rank[b] < rank[a] ? b : a));
    assert.equal(s.level, best, crop.id);
  }
});

/** The engine's crop fit for one season of the crop planted in each month, the way the S2 scan does it. */
function monthFits(cropId: string, details: LotDetails = UNKNOWN) {
  const crop = CROP_LIBRARY.crops.find((c) => c.id === cropId)!;
  const days = cropSeasonDays(crop).days!;
  return MONTHS.map((m) =>
    cropFit({
      crop,
      lotCrop: { crop_id: crop.id, seasons: [{ plant_month: m, harvest_month: harvestMonthOf(m, days) }] },
      details,
      data: ILIGAN_LOT_FIXTURE,
      library: CROP_LIBRARY,
    }),
  );
}

test("best months are the months at the crop's best level, with that first month's reasons", () => {
  const { crops } = lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  let sawReasons = false;
  for (const s of crops) {
    if (s.level === "unknown") {
      assert.deepEqual([s.best_months, s.reasons], [[], []], s.crop_id);
      continue;
    }
    const fits = monthFits(s.crop_id);
    const best = MONTHS.filter((_, i) => fits[i].level === s.level);
    assert.deepEqual(s.best_months, best, s.crop_id);
    const expected = s.level === "good" ? [] : fits[best[0] - 1].reasons;
    assert.deepEqual(s.reasons, expected, s.crop_id);
    if (s.level !== "good") {
      assert.ok(s.reasons.length > 0, `${s.crop_id}: a Watch out or Poor crop says why`);
      sawReasons = true;
    }
  }
  assert.ok(sawReasons, "the fixture lot has a crop that is not a Good fit in any month, or this test proves nothing");
});

const RANK: Record<FitLevel, number> = { good: 0, watch: 1, poor: 2, unknown: 3 };
/** Negative when a ranks above b: level, then more best months, then library order. */
const compare = (order: string[]) => (a: CropSuggestion, b: CropSuggestion) =>
  RANK[a.level] - RANK[b.level] || b.best_months.length - a.best_months.length || order.indexOf(a.crop_id) - order.indexOf(b.crop_id);

test("top crops: 3 by default, never unknown or Poor fit, sorted by level then month count then library order", () => {
  for (const water of ["unknown", "rain", "full"] as const) {
    const s = lotSuggestions({ ...UNKNOWN, water }, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
    const top = topCrops(s);
    const order = CROP_LIBRARY.crops.map((c) => c.id);
    const cmp = compare(order);
    assert.ok(top.length <= 3 && top.length > 0, water);
    assert.ok(top.every((c) => c.level === "good" || c.level === "watch"), water);
    for (let i = 1; i < top.length; i++) assert.ok(cmp(top[i - 1], top[i]) < 0, `${water}: ${top[i - 1].crop_id} before ${top[i].crop_id}`);
    const left = s.crops.filter((c) => (c.level === "good" || c.level === "watch") && !top.includes(c));
    if (top.length === 3) for (const c of left) assert.ok(cmp(top[2], c) < 0, `${water}: ${c.crop_id} would rank above the 3rd`);
    else assert.deepEqual(left, [], `${water}: fewer than 3 only when every rated crop is in`);
    const listable = s.crops.filter((c) => c.level === "good" || c.level === "watch").length;
    assert.equal(topCrops(s, 5).length, Math.min(5, listable), `${water}: n is still a parameter`);
  }
});

test("fewer than 3 rated crops returns all of them, and a crop with no season length never appears", () => {
  const [rice, corn] = ["lowland-rice", "corn"].map((id) => CROP_LIBRARY.crops.find((c) => c.id === id)!);
  const noLength = { ...rice, id: "no-length", season_days: null, stages_days: null };
  const lib: CropLibrary = { ...CROP_LIBRARY, crops: [noLength, rice, corn] };
  const top = topCrops(lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, lib));
  assert.deepEqual(top.map((c) => c.crop_id).sort(), ["corn", "lowland-rice"]);
  assert.equal(topCrops(lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, lib), 1).length, 1);
});

test("a crop with no season length is unknown", () => {
  const rice = CROP_LIBRARY.crops.find((c) => c.id === "lowland-rice")!;
  const noLength = { ...rice, id: "no-length", season_days: null, stages_days: null };
  const lib: CropLibrary = { ...CROP_LIBRARY, crops: [noLength] };
  const s = lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, lib);
  assert.deepEqual(s.crops, [{ crop_id: "no-length", level: "unknown", good_months: [], best_months: [], reasons: [] }]);
  assert.deepEqual(topCrops(s), []);
});

test("the farmer's lot details change the ratings (full irrigation removes rain shortage)", () => {
  const rainOnly = lotSuggestions({ ...UNKNOWN, water: "rain" }, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  const irrigated = lotSuggestions({ ...UNKNOWN, water: "full" }, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  const good = (x: typeof rainOnly) => x.crops.filter((c) => c.good_months.length > 0).length;
  assert.ok(good(irrigated) >= good(rainOnly));
  assert.notDeepEqual(irrigated.crops, rainOnly.crops);
});

test("good months read as short ranges, wrapping over the new year", () => {
  assert.equal(goodMonthsText([]), "");
  assert.equal(goodMonthsText([4]), "Apr");
  assert.equal(goodMonthsText([2, 3]), "Feb–Mar");
  assert.equal(goodMonthsText([4, 5, 6, 7, 8, 9, 10, 11]), "Apr–Nov");
  assert.equal(goodMonthsText([2, 3, 4, 9]), "Feb–Apr, Sep");
  assert.equal(goodMonthsText([1, 2, 11, 12]), "Nov–Feb");
  assert.equal(goodMonthsText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "any month");
});

test("a Watch out or Poor reason names its month when the crop has more than one best month", () => {
  const { crops } = lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY);
  let checked = 0;
  for (const s of crops) {
    if (s.level === "good" || s.level === "unknown") {
      assert.equal(topCropReason(s), null, s.crop_id);
      continue;
    }
    const text = fitReasonText(s.reasons[0]);
    const expected = s.best_months.length > 1 ? `If planted in ${monthShort(s.best_months[0])}: ${text}` : text;
    assert.equal(topCropReason(s), expected, s.crop_id);
    checked++;
  }
  assert.ok(checked > 0);
  const one: CropSuggestion = { crop_id: "x", level: "watch", good_months: [], best_months: [4], reasons: crops.find((c) => c.reasons.length)!.reasons };
  assert.equal(topCropReason(one), fitReasonText(one.reasons[0]), "one best month: the row already says which");
});

/** The Iligan lot with every month changed, e.g. frozen or rainless. */
const climate = (change: (m: typeof ILIGAN_LOT_FIXTURE.monthly) => Partial<typeof ILIGAN_LOT_FIXTURE.monthly>) => ({
  ...ILIGAN_LOT_FIXTURE,
  monthly: { ...ILIGAN_LOT_FIXTURE.monthly, ...change(ILIGAN_LOT_FIXTURE.monthly) },
});
const FROZEN = climate(() => ({ tmax_c: Array(12).fill(-15), tmin_c: Array(12).fill(-25) }));
const RAINLESS = climate(() => ({ precip_mm: { p20: Array(12).fill(0), p50: Array(12).fill(0), p80: Array(12).fill(0) } }));

test("Poor fit is never a top crop: a frozen lot has no top crops, and says it is too cold", () => {
  const s = lotSuggestions(UNKNOWN, FROZEN, CROP_LIBRARY);
  assert.ok(s.crops.some((c) => c.level === "poor"), "the frozen lot rates crops Poor, or this test proves nothing");
  assert.deepEqual(topCrops(s), []);
  assert.deepEqual(noCropFits(s), { why: "too cold" });
});

test("a rain-fed lot with no rain: no crop grows well, mostly too dry", () => {
  const s = lotSuggestions({ ...UNKNOWN, water: "rain" }, RAINLESS, CROP_LIBRARY);
  assert.deepEqual(topCrops(s), []);
  assert.deepEqual(noCropFits(s), { why: "too dry" });
});

const sug = (level: CropSuggestion["level"], code?: string): CropSuggestion => ({
  crop_id: `${level}-${code ?? "none"}`,
  level,
  good_months: [],
  best_months: level === "unknown" ? [] : [1],
  reasons: code ? [{ code, level: level === "good" ? "watch" : level, months: [1], value: null, limit: null } as CropSuggestion["reasons"][number]] : [],
});
const sugs = (...crops: CropSuggestion[]): LotSuggestions => ({ crops });

test("noCropFits: the trouble is named only when more than half of the rated crops share it", () => {
  assert.deepEqual(noCropFits(sugs(sug("poor", "water"), sug("poor", "dry-year"), sug("poor", "too-cold"))), { why: "too dry" });
  assert.deepEqual(noCropFits(sugs(sug("poor", "too-hot"), sug("poor", "warm"), sug("unknown"))), { why: "too hot" });
  assert.deepEqual(noCropFits(sugs(sug("poor", "waterlogging"))), { why: "too wet" });
  assert.deepEqual(noCropFits(sugs(sug("poor", "water"), sug("poor", "too-cold"))), { why: null }, "half is not most");
  assert.deepEqual(noCropFits(sugs(sug("poor", "missing-climate"))), { why: null });
});

/** A crop rated on temperature only: its water use could not be checked (e.g. no Kc in crops.json). */
const partial = (level: "watch" | "poor", code: string): CropSuggestion => {
  const c = sug(level, code);
  return { ...c, crop_id: `partial-${code}`, reasons: [...c.reasons, { code: "no-crop-data", level: "unknown", months: [], value: null, limit: null }] };
};

test("a crop rated without its water check is never a top crop, and doesn't count for 'none grow well'", () => {
  // Sesbania on the Sahara probe: Watch out for cool January, but its water use is not in crops.json.
  const s = sugs(partial("watch", "cool"), sug("poor", "water"), sug("poor", "water"));
  assert.deepEqual(topCrops(s), []);
  assert.deepEqual(noCropFits(s), { why: "too dry" });
  assert.deepEqual(topCrops(sugs(sug("watch", "cool"), partial("watch", "warm"))).map((c) => c.crop_id), ["watch-cool"]);
  assert.equal(noCropFits(sugs(partial("poor", "too-cold"))), null, "only partly rated crops: nothing to say");
});

test("noCropFits is null when any crop fits, or when no crop can be rated", () => {
  assert.equal(noCropFits(lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY)), null);
  assert.equal(noCropFits(sugs(sug("watch", "cool"), sug("poor", "too-cold"))), null);
  assert.equal(noCropFits(sugs(sug("unknown"), sug("unknown"))), null, "no crop data is not 'nothing grows'");
  assert.equal(noCropFits(sugs()), null);
});

test("bad saved data gives no top crops instead of a crash", () => {
  const broken = { monthly: { ...ILIGAN_LOT_FIXTURE.monthly, tmax_c: undefined } } as unknown as typeof ILIGAN_LOT_FIXTURE;
  assert.throws(() => lotSuggestions(UNKNOWN, broken, CROP_LIBRARY), "the engine throws on it, or this test proves nothing");
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(safeLotTop(UNKNOWN, broken, CROP_LIBRARY), { top: [], noFit: null });
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(safeLotTop(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY), {
    top: topCrops(lotSuggestions(UNKNOWN, ILIGAN_LOT_FIXTURE, CROP_LIBRARY)),
    noFit: null,
  });
  assert.deepEqual(safeLotTop(UNKNOWN, FROZEN, CROP_LIBRARY), { top: [], noFit: { why: "too cold" } });
});
