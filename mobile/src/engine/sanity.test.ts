/// <reference types="node" />
// docs/07 §7 sanity checks that a test can answer, on the Iligan test lot (#32).
// The checks that need someone who knows the area (are these numbers right for
// Iligan?) get their numbers from `npm run sanity` (scripts/sanity-report.ts).
// §7 checks already covered by other test files:
//   - a shifted month never collides with another crop: plantingWindow.test.ts
//   - a farmer-entered travel time always wins: access.test.ts
//   - a perishable crop gets a lower M than a storable one: access.test.ts
//   - P20 lowers W more for rice than for a legume in the same months: rotations.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LotDetails, Priorities } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { rotations } from "./rotations";
import { cropSeasonDays } from "./season";
import { waterBalance } from "./waterBalance";

const lib = CROP_LIBRARY_FIXTURE;
const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const monthly = ILIGAN_LOT_FIXTURE.monthly;

test("§7: every coefficient in params.ts has a source or an assumption label", () => {
  const lines = readFileSync(join(process.cwd(), "src", "engine", "params.ts"), "utf8").split(/\r?\n/);
  const LABEL = /\bSource:|assumption|team (spec|decision)|\bdefinition\b/i;
  const found: string[] = [];
  const unlabeled: string[] = [];
  let comment = "";
  lines.forEach((line, i) => {
    const name = /^export const (\w+)/.exec(line)?.[1];
    if (!name) return;
    found.push(name);
    const above: string[] = [];
    for (let j = i - 1; j >= 0 && /^\s*(\/\/|\/\*|\*)/.test(lines[j]); j--) above.unshift(lines[j]);
    // Exports on consecutive lines share the comment above the first one.
    if (above.length > 0) comment = above.join("\n");
    else if (!/^export const /.test(lines[i - 1] ?? "")) comment = "";
    if (!LABEL.test(comment)) unlabeled.push(name);
  });
  assert.ok(found.length > 30, `found only ${found.length} exports: is the parser still matching params.ts?`);
  assert.deepEqual(unlabeled, []);
});

test("§7: rice-rice-bare shows a stress window, and its worst month is one of the driest", () => {
  const rice = lib.crops.find((c) => c.id === "lowland-rice");
  const seasonDays = rice && cropSeasonDays(rice).days;
  assert.ok(rice && seasonDays && rice.typical_calendar.length === 2);
  const seasons = rice.typical_calendar.map(({ plant_month }) => {
    const o = waterBalance({
      crop: rice,
      plantMonth: plant_month,
      seasonDays,
      monthly,
      details: lowland,
      riceDetail: lib.rice_extra_detail,
      scenario: "p50",
    });
    assert.ok(o.ok);
    return o.result;
  });
  for (const s of seasons) assert.ok(s.stress_months.length > 0, `rice planted in month ${s.plant_month}`);

  // Driest = lowest typical-year rain minus ET0.
  const surplus = monthly.precip_mm.p50.map((p, i) => {
    const et0 = monthly.et0_mm[i];
    assert.ok(p !== null && et0 !== null);
    return p - et0;
  });
  const driest = surplus
    .map((v, i) => ({ month: i + 1, v }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 3)
    .map((x) => x.month);
  const share = (x: { deficit_mm: number; need_mm: number }) => (x.need_mm > 0 ? x.deficit_mm / x.need_mm : 0);
  const worst = seasons.flatMap((s) => s.months).reduce((a, b) => (share(b) > share(a) ? b : a));
  assert.ok(driest.includes(worst.month), `worst month ${worst.month}, driest ${driest}`);

  // The season that runs through the driest months is the more stressed one.
  const [first, second] = seasons;
  const inDriest = (s: typeof first) => s.months.some((x) => x.crop_days > 0 && driest.includes(x.month));
  const [dry, wet] = inDriest(first) ? [first, second] : [second, first];
  assert.ok(inDriest(dry) && !inDriest(wet));
  assert.ok(dry.wsi > wet.wsi, `dry-months season WSI ${dry.wsi} vs ${wet.wsi}`);
});

test("§7: raising a priority moves the balanced option (D) toward it on the Iligan lot", () => {
  const balanced = (priorities: Priorities) => {
    const r = rotations({
      lot: { crops: [{ crop_id: "lowland-rice", seasons: [] }], details: lowland },
      data: { monthly },
      library: lib,
      priorities,
    });
    const d = r.options.find((o) => o.key === "D");
    assert.ok(d && d.scores.W !== null && d.scores.S !== null);
    return { W: d.scores.W, S: d.scores.S };
  };
  const waterFirst = balanced({ water: 100, soil: 0, income: 50, labor: 50 });
  const soilFirst = balanced({ water: 0, soil: 100, income: 50, labor: 50 });
  assert.ok(waterFirst.W > soilFirst.W, `W: water first ${waterFirst.W}, soil first ${soilFirst.W}`);
  assert.ok(soilFirst.S > waterFirst.S, `S: soil first ${soilFirst.S}, water first ${waterFirst.S}`);
});
