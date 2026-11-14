/// <reference types="node" />
// Planting-window scan (#33, docs/07 §3b).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CropSeason, LotCrop, LotData, LotDetails } from "../types";
import { CROP_LIBRARY_FIXTURE } from "./__fixtures__/crops.fixture";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import { TURNAROUND_DAYS, WINDOW_MARGIN_POINTS } from "./params";
import { plantingWindow, type PlantingWindowInput } from "./plantingWindow";
import { monthStartDay } from "./season";

const lib = CROP_LIBRARY_FIXTURE;
const lowland: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const iligan = { monthly: ILIGAN_LOT_FIXTURE.monthly };
const season = (p: number, h: number): CropSeason => ({ plant_month: p, harvest_month: h });
const lc = (crop_id: string, ...seasons: CropSeason[]): LotCrop => ({ crop_id, seasons });
const flat = (v: number) => Array.from({ length: 12 }, () => v);

/** Synthetic lot climate for unit tests (not real data). */
function climate(o: { rain?: number[]; tmax?: number | null; wet?: number } = {}): Pick<LotData, "monthly"> {
  const rain = o.rain ?? flat(1000);
  return {
    monthly: {
      precip_mm: { p20: rain, p50: rain, p80: rain },
      et0_mm: flat(100),
      tmax_c: o.tmax === null ? Array<number | null>(12).fill(null) : flat(o.tmax ?? 31),
      tmin_c: flat(23),
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

const hotMonths = (months: number[], tmax: number) => {
  const c = climate();
  months.forEach((m) => (c.monthly.tmax_c[m - 1] = tmax));
  return c;
};

const scan = (crops: LotCrop[], data: Pick<LotData, "monthly"> = iligan, details: LotDetails = lowland) =>
  plantingWindow({ lot: { crops, details }, data, library: lib } satisfies PlantingWindowInput);

/** Occupied [start, start+len) on the 365-day circle, for a planting month and season length. */
const span = (month: number, days: number) => ({ start: monthStartDay(month) + 14, len: days });
function overlapsWithGap(a: { start: number; len: number }, b: { start: number; len: number }, gap: number): boolean {
  const mod = (n: number) => ((n % 365) + 365) % 365;
  return mod(b.start - a.start) < a.len + gap || mod(a.start - b.start) < b.len + gap;
}

test("real Iligan lot: corn and mungbean get a better month that beats the margin or removes a stress month", () => {
  const r = scan([lc("corn", season(2, 5)), lc("mungbean", season(3, 5))]);
  const corn = r.seasons.find((s) => s.crop_id === "corn");
  assert.ok(corn);
  assert.equal(corn.status, "better");
  assert.ok(corn.better && corn.delta !== null);
  assert.ok(
    corn.delta >= WINDOW_MARGIN_POINTS || corn.better.stress_months.length < corn.yours.stress_months.length,
  );
  assert.ok(corn.drivers.length > 0);
  assert.ok(Math.abs(corn.shift_months as number) <= 6);
});

test('returns "already good" with no better month when no month beats the farmer\'s by the margin', () => {
  // Same rain and temperature every month: moving the season changes nothing.
  const r = scan([lc("lowland-rice", season(6, 10))], climate());
  assert.equal(r.seasons.length, 1);
  assert.equal(r.seasons[0].status, "already-good");
  assert.equal(r.seasons[0].better, null);
  assert.equal(r.seasons[0].delta, null);
  assert.equal(r.seasons[0].shift_months, null);
  assert.deepEqual(r.seasons[0].drivers, []);
});

test("a dry-season planting moves to the wet months on a lot with only that crop", () => {
  const rain = [20, 20, 20, 20, 20, 300, 300, 300, 300, 20, 20, 20];
  const r = scan([lc("mungbean", season(12, 2))], climate({ rain }));
  const s = r.seasons[0];
  assert.equal(s.status, "better");
  assert.ok([5, 6, 7, 8, 9].includes((s.better as { plant_month: number }).plant_month), `got ${s.better?.plant_month}`);
});

test("never proposes a shift that collides with another crop on the same lot", () => {
  // Wet months are 6-9, which is where the rice sits. Mungbean (dry December planting) would love
  // to move there, but the rice is in the field.
  const rain = [20, 20, 20, 20, 20, 300, 300, 300, 300, 20, 20, 20];
  const crops = [lc("lowland-rice", season(6, 10)), lc("mungbean", season(12, 2))];
  const r = scan(crops, climate({ rain }));
  const rice = span(6, 112);
  for (const s of r.seasons.filter((x) => x.crop_id === "mungbean")) {
    if (s.better) {
      assert.ok(
        !overlapsWithGap(span(s.better.plant_month, 65), rice, TURNAROUND_DAYS),
        `better month ${s.better.plant_month} collides with the rice`,
      );
    }
  }
});

test("property: on the real fixture no better month ever collides with another season", () => {
  const mixes: LotCrop[][] = [
    [lc("lowland-rice", season(6, 10), season(11, 3))],
    [lc("lowland-rice", season(6, 10)), lc("mungbean", season(12, 2))],
    [lc("corn", season(5, 8), season(11, 2)), lc("mungbean", season(9, 11))],
  ];
  const days: Record<string, number> = { "lowland-rice": 112, corn: 95, mungbean: 65 };
  for (const crops of mixes) {
    const r = scan(crops);
    const planted = crops.flatMap((c) => c.seasons.map((s, i) => ({ id: c.crop_id, i, month: s.plant_month })));
    for (const s of r.seasons) {
      if (!s.better) continue;
      for (const o of planted) {
        if (o.id === s.crop_id && o.i === s.season_index) continue;
        const mine = span(s.better.plant_month, days[s.crop_id]);
        const other = span(o.month, days[o.id]);
        assert.ok(!overlapsWithGap(mine, other, TURNAROUND_DAYS), `${s.crop_id}#${s.season_index} to ${s.better.plant_month} hits ${o.id}`);
      }
    }
  }
});

test("rice planted twice a year: each season is scanned on its own without colliding with the other", () => {
  const r = scan([lc("lowland-rice", season(6, 10), season(11, 3))]);
  assert.deepEqual(r.seasons.map((s) => s.season_index), [0, 1]);
  assert.ok(r.seasons.every((s) => s.crop_id === "lowland-rice"));
  const [a, b] = r.seasons;
  if (a.better) assert.ok(!overlapsWithGap(span(a.better.plant_month, 112), span(11, 112), TURNAROUND_DAYS));
  if (b.better) assert.ok(!overlapsWithGap(span(b.better.plant_month, 112), span(6, 112), TURNAROUND_DAYS));
});

test("crops the farmer already intercropped may keep overlapping after a shift", () => {
  const rain = [20, 20, 20, 20, 20, 300, 300, 300, 300, 20, 20, 20];
  // Corn (Dec) and mungbean (Dec) overlap in the farmer's own calendar, so mungbean may move onto
  // the corn's months; here corn is also free to move, so the pair can both land in the wet months.
  const r = scan([lc("corn", season(12, 3)), lc("mungbean", season(12, 2))], climate({ rain }));
  const m = r.seasons.find((s) => s.crop_id === "mungbean");
  assert.ok(m?.better, "mungbean should find a better month");
});

test("confidence is low when lot details are unknown, and the unknown is listed", () => {
  const unknown: LotDetails = { land_type: "unknown", water: "unknown", soil: "unknown" };
  const r = scan([lc("corn", season(2, 5))], iligan, unknown);
  assert.equal(r.seasons[0].confidence, "low");
  assert.ok(r.seasons[0].unknowns.includes("lot-details-unknown"));
  const known = scan([lc("lowland-rice", season(6, 10))], climate());
  assert.equal(known.seasons[0].confidence, "medium");
  assert.deepEqual(known.seasons[0].unknowns, []);
});

test("missing temperature data gives status unknown, never a guess", () => {
  const r = scan([lc("corn", season(2, 5))], climate({ tmax: null }));
  assert.equal(r.seasons[0].status, "unknown");
  assert.equal(r.seasons[0].better, null);
  assert.ok(r.seasons[0].unknowns.includes("fit-not-computable"));
  assert.equal(r.seasons[0].confidence, "low");
});

test("crops without months and unknown crops are reported as gaps, not scanned", () => {
  const r = scan([lc("corn"), lc("no-such-crop", season(1, 4))]);
  assert.equal(r.seasons.length, 0);
  assert.deepEqual(r.gaps, [
    { code: "no-months", crop_id: "corn" },
    { code: "unknown-crop", crop_id: "no-such-crop" },
  ]);
});

test("the scan is deterministic and does not change its input", () => {
  const crops = [lc("corn", season(2, 5)), lc("mungbean", season(3, 5))];
  const before = JSON.stringify(crops);
  assert.deepEqual(scan(crops), scan(crops));
  assert.equal(JSON.stringify(crops), before);
});

test("a gain below the margin is not shown: a small improvement still reads \"already good\"", () => {
  // Rice (112 days) planted 6 June: only June's 17 field days are above the optimum (mean 36 C vs 35 C),
  // so moving it removes about 15% of the risk days, which is about 7.6 Fit points (< 10).
  const r = scan([lc("lowland-rice", season(6, 10))], hotMonths([6], 49));
  const s = r.seasons[0];
  assert.equal(s.yours.heat_months.length, 1);
  assert.equal(s.status, "already-good");
  assert.equal(s.better, null);
});

test("months that fail the crop's temperature range are never offered", () => {
  // June to September means 41.5 C, above mungbean's 40 C maximum, while that is also the only wet spell.
  const rain = [20, 20, 20, 20, 20, 300, 300, 300, 300, 20, 20, 20];
  const c = hotMonths([6, 7, 8, 9], 60);
  c.monthly.precip_mm = { p20: rain, p50: rain, p80: rain };
  const r = scan([lc("mungbean", season(12, 2))], c);
  const better = r.seasons[0].better;
  if (better) assert.ok(![4, 5, 6, 7, 8, 9].includes(better.plant_month), `offered hot month ${better.plant_month}`);
});
