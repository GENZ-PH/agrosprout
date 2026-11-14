/// <reference types="node" />
// mobile/assets/data/crops.json (#11) follows the `Crop` contract in types.ts
// and rule 3: every value names its source, and a value with no source is null
// and listed in that crop's `unverified`. Also runs the engine on every crop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cropFit } from "../engine/cropFit";
import { rotations } from "../engine/rotations";
import { CROP_LIBRARY_FIXTURE } from "../engine/__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "../engine/__fixtures__/iligan-lot.fixture";
import type { Crop, CropLibrary, LotDetails, Priorities } from "../types";

// Read from disk: Node's test runner can't import JSON without import attributes.
const lib = JSON.parse(readFileSync(join(process.cwd(), "assets", "data", "crops.json"), "utf8")) as CropLibrary;

/** Crop fields that hold a value, so each needs a source or must be null and unverified. */
const VALUE_FIELDS = [
  "local_name",
  "family",
  "season_days",
  "stages_days",
  "kc",
  "root_depth_m",
  "p_depletion",
  "temp_c",
  "drought_tolerance",
  "waterlogging_tolerance",
  "n_fixing",
  "labor",
  "market",
  "cover_value",
  "perishability",
  "storable_if_dried",
  "yield_t_per_ha",
  "typical_calendar",
] as const satisfies readonly (keyof Crop)[];

const LEVEL_FIELDS = [
  "drought_tolerance",
  "waterlogging_tolerance",
  "labor",
  "market",
  "cover_value",
  "perishability",
] as const satisfies readonly (keyof Crop)[];

/** Field names a crop's sources cover ("root_depth_m, p_depletion" covers both). */
const cited = (c: Crop) => new Set(c.sources.flatMap((s) => s.field_or_fields.split(/[,\s]+/).filter(Boolean)));
const isMonth = (m: unknown) => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 12;
const positive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;

test("the library has 8 to 12 crops with unique ids", () => {
  assert.ok(lib.crops.length >= 8 && lib.crops.length <= 12, `${lib.crops.length} crops`);
  const ids = lib.crops.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids}`);
  assert.ok(ids.every((id) => /^[a-z][a-z-]*$/.test(id)), `ids should be kebab-case: ${ids}`);
});

test("library-wide values carry their citation", () => {
  assert.ok(positive(lib.rice_extra_mm));
  assert.ok(lib.rice_extra_detail?.citation && lib.rice_extra_detail.url.startsWith("https://"));
  const taw = lib.taw_mm_per_m;
  for (const k of ["sandy", "loamy", "clayey"] as const) {
    assert.ok(positive(taw[k].min) && taw[k].min <= taw[k].max, `taw ${k}`);
  }
  assert.ok(taw.citation && taw.url.startsWith("https://"));
});

for (const c of lib.crops) {
  test(`${c.id}: matches the Crop contract`, () => {
    assert.ok(c.name.trim() && c.family.trim() && c.notes.trim());
    assert.ok(c.local_name === null || c.local_name.trim().length > 0);
    assert.ok(c.season_days === null || positive(c.season_days));
    if (c.stages_days !== null) assert.ok(c.stages_days.length === 4 && c.stages_days.every(positive));
    if (c.kc !== null) assert.ok(c.kc.length === 3 && c.kc.every((k) => positive(k) && k <= 2), `kc ${c.kc}`);
    if (c.root_depth_m !== null) {
      const [lo, hi] = c.root_depth_m;
      assert.ok(c.root_depth_m.length === 2 && positive(lo) && lo <= hi, `root depth ${c.root_depth_m}`);
    }
    assert.ok(c.p_depletion === null || (c.p_depletion > 0 && c.p_depletion < 1));
    if (c.temp_c !== null) {
      const t = c.temp_c;
      assert.ok(t.min <= t.opt_low && t.opt_low <= t.opt_high && t.opt_high <= t.max, `temp ${JSON.stringify(t)}`);
    }
    for (const f of LEVEL_FIELDS) assert.ok(c[f] === null || ["low", "medium", "high"].includes(c[f]), `${f} = ${c[f]}`);
    for (const f of ["n_fixing", "storable_if_dried"] as const) assert.ok(c[f] === null || typeof c[f] === "boolean", f);
    assert.ok(c.yield_t_per_ha === null || positive(c.yield_t_per_ha));
    assert.ok(Array.isArray(c.typical_calendar));
    for (const s of c.typical_calendar) assert.ok(isMonth(s.plant_month) && isMonth(s.harvest_month), JSON.stringify(s));
  });

  test(`${c.id}: every value has a source, or is null and listed as unverified (rule 3)`, () => {
    const covered = cited(c);
    for (const f of VALUE_FIELDS) {
      const v = c[f];
      if (v === null) assert.ok(c.unverified.includes(f), `${f} is null but not listed in unverified`);
      else if (!(Array.isArray(v) && v.length === 0)) assert.ok(covered.has(f), `${f} has a value but no source`);
    }
    for (const f of c.unverified) {
      assert.ok((VALUE_FIELDS as readonly string[]).includes(f), `unverified lists unknown field ${f}`);
      // An unknown calendar is an empty list in the contract; every other unverified value is null.
      const v = c[f as (typeof VALUE_FIELDS)[number]];
      assert.ok(v === null || (f === "typical_calendar" && Array.isArray(v) && v.length === 0), `${f} is unverified but has a value`);
    }
    assert.ok(c.sources.length > 0);
    for (const s of c.sources) {
      assert.ok(s.field_or_fields.trim() && s.citation.trim(), JSON.stringify(s));
      assert.ok(s.url === undefined || /^https?:\/\/\S+$/.test(s.url), `not a web link: ${s.url}`);
    }
  });
}

test("the engine test fixture still matches the library (all fields but sources)", () => {
  for (const f of CROP_LIBRARY_FIXTURE.crops) {
    const c = lib.crops.find((x) => x.id === f.id);
    assert.ok(c, `fixture crop ${f.id} is not in the library`);
    const { sources: _a, ...fixtureValues } = f;
    const { sources: _b, ...libraryValues } = c;
    assert.deepEqual(libraryValues, fixtureValues, f.id);
  }
  assert.equal(lib.rice_extra_mm, CROP_LIBRARY_FIXTURE.rice_extra_mm);
});

// The engine on the real Iligan lot climate, with every crop in the library.
const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50 };

test("the engine gives a fit for every crop, including those with missing values", () => {
  for (const crop of lib.crops) {
    const fit = cropFit({
      crop,
      lotCrop: { crop_id: crop.id, seasons: [] },
      details: lowland,
      data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
      library: lib,
    });
    assert.equal(fit.crop_id, crop.id);
    assert.ok(["good", "watch", "poor", "unknown"].includes(fit.level), `${crop.id}: ${fit.level}`);
  }
});

// The engine only suggests crops it can model: Kc, stage lengths and a temperature range.
const modelled = (c: Crop) => c.kc !== null && c.stages_days !== null && c.temp_c !== null;

test("the engine ranks rotations with the full library", () => {
  const r = rotations({
    lot: { crops: [{ crop_id: "lowland-rice", seasons: [] }], details: lowland },
    data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
    library: lib,
    priorities: EQUAL,
  });
  assert.equal(r.options[0].key, "A");
  assert.ok(r.options.length >= 3, `options ${r.options.map((o) => o.key)}`);
  const suggested = Object.keys(r.feasible_start_months).sort();
  assert.deepEqual(suggested, lib.crops.filter(modelled).map((c) => c.id).sort());
  assert.ok(suggested.length >= 8, `only ${suggested.length} crops can be suggested`);
});
