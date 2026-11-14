/// <reference types="node" />
// Soil Health Index 3-year trajectory (#43, docs/07 §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CropLibrary, LotDetails, Priorities } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { SHI_GAIN_PER_YEAR, SHI_LOSS_PER_YEAR, SHI_START, SHI_YEARS } from "./params";
import { rotations } from "./rotations";
import { soilHealth, soilHealthTrajectory, type SoilHealthTrajectory } from "./soilHealth";

const EQUAL: Priorities = { water: 50, soil: 50, income: 50, labor: 50 };
const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const end = (t: SoilHealthTrajectory | null) => (t as SoilHealthTrajectory).points[SHI_YEARS].value;

/** The farmer's own months on the Iligan test lot, scored as option A. */
function run(seasons: [string, number, number][], library: Pick<CropLibrary, "crops" | "rice_extra_detail"> = CROP_LIBRARY_FIXTURE) {
  return rotations({
    lot: {
      crops: seasons.map(([crop_id, plant_month, harvest_month]) => ({ crop_id, seasons: [{ plant_month, harvest_month }] })),
      details: lowland,
    },
    data: { monthly: ILIGAN_LOT_FIXTURE.monthly },
    library,
    priorities: EQUAL,
  });
}
const RICE_RICE_BARE: [string, number, number][] = [
  ["lowland-rice", 6, 10],
  ["lowland-rice", 11, 3],
];

test("the formula: start at SHI_START, then + α·S/100 − β·(1 − E/100) each year", () => {
  const t = soilHealthTrajectory({ S: 60, E: 80 }) as SoilHealthTrajectory;
  const gain = (SHI_GAIN_PER_YEAR * 60) / 100;
  const loss = SHI_LOSS_PER_YEAR * 0.2;
  assert.ok(near(t.gain_per_year, gain));
  assert.ok(near(t.loss_per_year, loss));
  assert.ok(near(t.change_per_year, gain - loss));
  assert.equal(t.points.length, SHI_YEARS + 1);
  t.points.forEach((p, y) => {
    assert.equal(p.year, y);
    assert.ok(near(p.value, SHI_START + y * (gain - loss)), `year ${y}: ${p.value}`);
  });
  assert.ok(near(t.change, SHI_YEARS * (gain - loss)));
});

test("the index stays within 0-100 over more years than the view shows", () => {
  const up = soilHealthTrajectory({ S: 100, E: 100 }, 20) as SoilHealthTrajectory;
  const down = soilHealthTrajectory({ S: 0, E: 0 }, 20) as SoilHealthTrajectory;
  assert.equal(up.points[20].value, 100);
  assert.equal(down.points[20].value, 0);
  assert.equal(up.change, 100 - SHI_START);
  assert.equal(down.change, -SHI_START);
  for (const p of [...up.points, ...down.points]) assert.ok(p.value >= 0 && p.value <= 100);
});

test("within the 3-year view the limits never flatten a line, even at the extremes", () => {
  for (const [S, E] of [[100, 100], [0, 0], [100, 0], [0, 100]]) {
    const t = soilHealthTrajectory({ S, E }) as SoilHealthTrajectory;
    assert.ok(near(t.change, SHI_YEARS * t.change_per_year), `S ${S} E ${E}`);
  }
});

test("more soil building raises the line; less erosion protection lowers it", () => {
  const base = end(soilHealthTrajectory({ S: 40, E: 70 }));
  assert.ok(end(soilHealthTrajectory({ S: 50, E: 70 })) > base);
  assert.ok(end(soilHealthTrajectory({ S: 40, E: 60 })) < base);
});

test("a missing S or E gives no line (never guessed), and no comparison with A", () => {
  assert.equal(soilHealthTrajectory({ S: null, E: 80 }), null);
  assert.equal(soilHealthTrajectory({ S: 60, E: null }), null);
  const r = soilHealth([
    { key: "A", scores: { W: 50, H: 50, S: 20, E: 90, B: 0, I: null, M: null, L: null, F: null } },
    { key: "B", scores: { W: 50, H: 50, S: null, E: 90, B: 0, I: null, M: null, L: null, F: null } },
  ]);
  assert.equal(r.options[1].trajectory, null);
  assert.equal(r.options[1].vs_yours, null);
  const noA = soilHealth([
    { key: "A", scores: { W: 50, H: 50, S: null, E: 90, B: 0, I: null, M: null, L: null, F: null } },
    { key: "B", scores: { W: 50, H: 50, S: 30, E: 90, B: 0, I: null, M: null, L: null, F: null } },
  ]);
  assert.notEqual(noA.options[1].trajectory, null);
  assert.equal(noA.options[1].vs_yours, null);
});

test("vs_yours is the last-year gap to option A; A itself has none", () => {
  const r = soilHealth(run(RICE_RICE_BARE).options);
  const a = r.options.find((o) => o.option_key === "A");
  assert.equal(a?.vs_yours, null);
  for (const o of r.options.filter((x) => x.option_key !== "A")) {
    assert.ok(near(o.vs_yours as number, end(o.trajectory) - end(a?.trajectory ?? null)));
  }
  assert.deepEqual(
    r.options.map((o) => o.option_key),
    run(RICE_RICE_BARE).options.map((o) => o.key),
  );
});

test("acceptance: legume options trend up relative to rice-rice-bare on the Iligan test lot", () => {
  const res = run(RICE_RICE_BARE);
  const shi = soilHealth(res.options);
  const a = shi.options[0];
  assert.equal(a.option_key, "A");
  const legume = res.options.filter((o) => o.key !== "A" && o.metrics.legume_days > 0);
  assert.ok(legume.length > 0, "at least one alternative has a legume");
  for (const o of legume) {
    const row = shi.options.find((x) => x.option_key === o.key);
    assert.ok((row?.vs_yours as number) > 0, `${o.key} vs A: ${row?.vs_yours}`);
    assert.ok((row?.trajectory?.change_per_year as number) > (a.trajectory?.change_per_year as number));
  }
});

test("acceptance: a cover crop after rice trends up relative to rice-rice-bare, and cover credit is what lifts it", () => {
  // The fixture's crops.json draft has no cover_value yet, so a high-cover corn is set here for the test only.
  const withCover = (v: "high" | null) => ({
    ...CROP_LIBRARY_FIXTURE,
    crops: CROP_LIBRARY_FIXTURE.crops.map((c) => (c.id === "corn" ? { ...c, cover_value: v } : c)),
  });
  const riceCorn: [string, number, number][] = [
    ["lowland-rice", 6, 10],
    ["corn", 11, 2],
  ];
  const lib = withCover("high");
  const ricerice = end(soilHealth(run(RICE_RICE_BARE, lib).options).options[0].trajectory);
  const cover = end(soilHealth(run(riceCorn, lib).options).options[0].trajectory);
  const noCover = end(soilHealth(run(riceCorn, withCover(null)).options).options[0].trajectory);
  assert.ok(cover > ricerice, `cover ${cover} vs rice-rice-bare ${ricerice}`);
  assert.ok(cover > noCover, `cover ${cover} vs same rotation without cover credit ${noCover}`);
});

test("label says 'relative indicator from this model'; the ⓘ text says it is not a lab test and shows no % or nutrient claim", () => {
  const r = soilHealth([]);
  assert.match(r.label.text, /relative indicator from this model/);
  assert.ok(r.info.some((l) => /not a lab test/.test(l.text)));
  for (const l of [r.label, ...r.info]) {
    assert.doesNotMatch(l.text, /%/);
    assert.doesNotMatch(l.text, /\b(more|less|increase|improve)s?\b[^.]*\b(nitrogen|carbon)\b/i);
  }
  assert.deepEqual(
    r.info.map((l) => l.code),
    ["shi.how", "shi.compare", "shi.not-a-test"],
  );
  assert.equal(r.start, SHI_START);
  assert.equal(r.years, SHI_YEARS);
});
