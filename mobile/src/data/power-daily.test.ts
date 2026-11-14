/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DailyHttpError,
  DailyParseError,
  annual,
  applyDaily,
  computeDailyExtremes,
  dailySeries,
  erfc,
  mannKendallP,
  monthlyStat,
  needsDaily,
  powerDailyUrl,
  senSlope,
  trendPerDecade,
  type Daily,
} from './power-daily';
import { ensureLotData, parsePowerMonthly, type LotDataStore } from './power';

/**
 * Fixtures: real NASA POWER daily responses (T2M_MAX, T2M_MIN, PRECTOTCORR, community AG),
 * saved from the live API on 2026-11-14:
 *  - 8.2 N 124.2 E, 2016-01-01 to 2025-12-31 (10 years, enough for Mann-Kendall);
 *  - 40.0 N 116.4 E, 2025 (a cold-winter point, so the frost count is not all zeros).
 *
 * Expected values were computed in Python with `pipeline/aggregate.py` (monthly_stat,
 * per_calendar_month, annual, trend_per_decade) and the dry-season deficit block of
 * `pipeline/build_demo.py`; the frost and 40 N heat counts with a plain Python loop over the
 * raw days. None of it with the TypeScript under test.
 */
const read = (f: string): unknown => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'));
const tropical = read('power-daily-8.2N-124.2E-2016-2025.json');
const cold = read('power-daily-40.0N-116.4E-2025.json');
const monthlyFixture = read('power-monthly-8.2N-124.2E-2001-2025.json');

/** Sea-level ET0 of the 8.2 N 124.2 E monthly fixture (pipeline/et0.py), as in power.test.ts. */
const ET0 = [84.675016, 89.063888, 116.642424, 125.402616, 118.506769, 103.209947, 101.998979, 105.299228, 100.60643, 101.364242, 92.367528, 88.053175];

const EXPECTED = {
  heat: [0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0, 0],
  heavy: [0.1, 0, 0, 0.1, 0, 0.1, 0.1, 0, 0, 0.4, 0.1, 0.2],
  precSlope: 233.56,
  precP: 0.5915050369949166,
  defSlope: -6.08153999999999,
  defP: 0.6534220947553175,
  tmaxSlope: 0.17198924731183496,
  tmaxP: 0.8580276569875213,
  frost40: [31, 28, 20, 0, 0, 0, 0, 0, 0, 7, 20, 31],
  heat40: [0, 0, 0, 0, 1, 11, 7, 1, 0, 0, 0, 0],
};

function near(actual: number | null | undefined, expected: number, tol: number, label: string) {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= tol, `${label}: got ${actual}, expected ${expected} +/- ${tol}`);
}

test('the URL asks for the daily point API, AG, three parameters, 2001-2025, rounded to 0.1 degree', () => {
  const u = new URL(powerDailyUrl(8.2349, 124.2468));
  assert.equal(`${u.origin}${u.pathname}`, 'https://power.larc.nasa.gov/api/temporal/daily/point');
  assert.equal(u.searchParams.get('latitude'), '8.2');
  assert.equal(u.searchParams.get('longitude'), '124.2');
  assert.equal(u.searchParams.get('community'), 'AG');
  assert.equal(u.searchParams.get('parameters'), 'T2M_MAX,T2M_MIN,PRECTOTCORR');
  assert.equal(u.searchParams.get('start'), '20010101');
  assert.equal(u.searchParams.get('end'), '20251231');
});

test('erfc matches Python math.erfc to well under the 4 decimals kept', () => {
  const ref: [number, number][] = [
    [0, 1], [0.1, 0.8875370839817152], [0.5, 0.4795001221869535], [1, 0.15729920705028516],
    [1.5, 0.033894853524689274], [2, 0.0046777349810472645], [3, 2.2090496998585438e-5], [-0.7, 1.6778011938374184],
  ];
  for (const [x, e] of ref) near(erfc(x), e, 1e-6, `erfc(${x})`);
});

test('Sen slope and Mann-Kendall match the pipeline tests', () => {
  const xs = Array.from({ length: 10 }, (_, i) => i);
  const ys = xs.map((x) => 2 * x);
  ys[4] = 100;
  near(senSlope(xs, ys), 2, 1e-12, 'sen');
  // n = 10, S = 45, var = 125, z = 44 / sqrt(125); Python: math.erfc(z / sqrt(2)).
  near(mannKendallP(xs), 8.303070332644999e-5, 1e-9, 'mk perfect');
  assert.ok((mannKendallP([1, 3, 2, 4, 3, 2, 4, 1, 3, 2]) as number) > 0.5);
  assert.equal(mannKendallP([1, 2, 3]), null);
  const [slope, p] = trendPerDecade(new Map(Array.from({ length: 12 }, (_, i) => [2000 + i, 100 + 5 * i])));
  near(slope, 50, 1e-9, 'per decade');
  assert.ok((p as number) < 0.01);
});

test('day counts: the limit itself is not counted, few missing days are scaled, many make the month missing', () => {
  const april = (f: (i: number) => number | null): Daily =>
    new Map(Array.from({ length: 30 }, (_, i) => [`202304${String(i + 1).padStart(2, '0')}`, f(i)]));
  assert.equal(monthlyStat(april((i) => (i < 3 ? 36 : 35)), 'gt', 35).get(202304), 3);
  assert.equal(monthlyStat(april((i) => (i === 0 ? -0.1 : 0)), 'lt', 0).get(202304), 1);
  assert.equal(monthlyStat(april((i) => (i < 4 ? null : 1)), 'sum').get(202304), null); // 13 % missing
  near(monthlyStat(april((i) => (i === 0 ? null : 1)), 'sum').get(202304), 30, 1e-12, 'scaled sum');
  const partial: Daily = new Map([...april(() => 1)].slice(0, 20));
  assert.equal(monthlyStat(partial, 'mean').get(202304), null);
  const m = new Map<number, number | null>(Array.from({ length: 12 }, (_, i) => [202001 + i, 1]));
  for (let i = 0; i < 11; i++) m.set(202101 + i, 1);
  assert.deepEqual([...annual(m, 'sum')], [[2020, 12]]);
});

test('real 8.2 N 124.2 E fixture: heat and heavy-rain days and trends match the Python pipeline', () => {
  const x = computeDailyExtremes(tropical, ET0);
  assert.equal(x.period, '2016-2025');
  assert.deepEqual(x.heat_days_gt35, EXPECTED.heat);
  assert.deepEqual(x.heavy_rain_days_gt50mm, EXPECTED.heavy);
  assert.deepEqual(x.frost_days_lt0, Array(12).fill(0));
  const t = x.trends;
  near(t.annual_precip_mm_per_decade, EXPECTED.precSlope, 0.05, 'precip slope');
  near(t.dry_season_deficit_mm_per_decade, EXPECTED.defSlope, 0.05, 'deficit slope');
  near(t.tmax_c_per_decade, EXPECTED.tmaxSlope, 0.005, 'tmax slope');
  near(t.p_values.annual_precip_mm_per_decade, EXPECTED.precP, 5e-5, 'precip p');
  near(t.p_values.dry_season_deficit_mm_per_decade, EXPECTED.defP, 5e-5, 'deficit p');
  near(t.p_values.tmax_c_per_decade, EXPECTED.tmaxP, 5e-5, 'tmax p');
  assert.equal(t.method, "Sen's slope / Mann-Kendall");
});

test('real 40 N fixture: frost days (Tmin < 0 °C) and heat days per month', () => {
  const x = computeDailyExtremes(cold, ET0);
  assert.deepEqual(x.frost_days_lt0, EXPECTED.frost40);
  assert.deepEqual(x.heat_days_gt35, EXPECTED.heat40);
  // One year only: no Mann-Kendall p-value (needs 10 years).
  assert.deepEqual(x.trends.p_values, {});
});

test('a bad answer is a parse error; -999 is missing', () => {
  assert.throws(() => dailySeries({}), DailyParseError);
  assert.throws(() => dailySeries({ properties: { parameter: { T2M_MAX: {}, T2M_MIN: {} } } }), DailyParseError);
  const d = dailySeries({ properties: { parameter: { T2M_MAX: { 20250101: -999 }, T2M_MIN: { 20250101: 1 }, PRECTOTCORR: { 20250101: 0 } } } });
  assert.equal(d.T2M_MAX.get('20250101'), null);
});

test('applyDaily fills the monthly fields, trends, provenance and the once-per-point marker', () => {
  const base = parsePowerMonthly(monthlyFixture, '2026-11-14', 'lot-1');
  assert.ok(needsDaily(base));
  const d = applyDaily(base, tropical, '2026-11-14');
  assert.ok(!needsDaily(d));
  assert.deepEqual(d.daily_point, [8.2, 124.2]);
  assert.deepEqual(d.monthly.heat_days_gt35, EXPECTED.heat);
  assert.ok(d.trends);
  for (const f of ['monthly.heat_days_gt35', 'monthly.heavy_rain_days_gt50mm', 'monthly.frost_days_lt0', 'trends']) {
    const p = d.provenance.filter((x) => x.field === f);
    assert.equal(p.length, 1, f);
    assert.equal(p[0].period, '2016-2025');
    assert.match(p[0].source, /^NASA POWER daily/);
  }
  // Applying again replaces, not duplicates, the entries.
  assert.equal(applyDaily(d, tropical, '2026-11-14').provenance.length, d.provenance.length);
});

function memoryStore(): LotDataStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
}

test('ensureLotData: daily is best effort, saved after the monthly data, and fetched once per point', async () => {
  const store = memoryStore();
  let dailyCalls = 0;
  const offline = async () => {
    dailyCalls++;
    throw new TypeError('Network request failed');
  };
  // Offline daily: the monthly data is still ready and saved.
  const r1 = await ensureLotData({ lotId: 'a', lat: 8.23, lon: 124.21, store, fetcher: async () => monthlyFixture, dailyFetcher: offline });
  assert.equal(r1.status, 'ready');
  assert.equal(r1.data?.monthly.heat_days_gt35, null);
  assert.ok(store.data.get('lotdata:a'));
  // Back online: the stored lot gets the daily data, at the rounded point.
  const points: [number, number][] = [];
  const r2 = await ensureLotData({ lotId: 'a', lat: 8.23, lon: 124.21, store, dailyFetcher: async (la, lo) => (points.push([la, lo]), tropical) });
  assert.deepEqual(points, [[8.2, 124.2]]);
  assert.equal(r2.fetched, true);
  assert.deepEqual(JSON.parse(store.data.get('lotdata:a')!).monthly.heat_days_gt35, EXPECTED.heat);
  // Already there: no more requests.
  const r3 = await ensureLotData({ lotId: 'a', lat: 8.23, lon: 124.21, store, dailyFetcher: offline });
  assert.equal(r3.fetched, false);
  assert.equal(dailyCalls, 1);
});

test('ensureLotData: a client error is marked as tried and not downloaded again', async () => {
  const store = memoryStore();
  let calls = 0;
  const bad = async () => {
    calls++;
    throw new DailyHttpError(422);
  };
  await ensureLotData({ lotId: 'b', lat: 8.2, lon: 124.2, store, fetcher: async () => monthlyFixture, dailyFetcher: bad });
  await ensureLotData({ lotId: 'b', lat: 8.2, lon: 124.2, store, dailyFetcher: bad });
  assert.equal(calls, 1);
  assert.equal(JSON.parse(store.data.get('lotdata:b')!).trends, null);
});
