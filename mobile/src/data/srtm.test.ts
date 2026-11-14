/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applySrtm, ensureLotData, needsSrtm, parsePowerMonthly, type LotDataStore } from './power';
import { elevationAndSlope, fetchSrtm, gridPoints, hornSlopePct, parseHeights, roundForSrtm, srtmUrl } from './srtm';

// Expected values from pipeline/fetch_srtm.py (grid_points, horn_slope_pct), not from the code under test.
const Z = [36, 35, 35, 36, 35, 34, 35, 34, 33];
const ok = (z: (number | null)[]) => ({ status: 'OK', results: z.map((elevation) => ({ elevation })) });

test('roundForSrtm keeps 3 decimals (about 110 m)', () => {
  assert.equal(roundForSrtm(8.004567), 8.005);
  assert.equal(roundForSrtm(123.80012), 123.8);
});

test('gridPoints matches the pipeline (north row first, west to east)', () => {
  const g = gridPoints(8.0, 123.8);
  assert.equal(g.length, 9);
  assert.deepEqual(g[0], [8.000271, 123.799728]);
  assert.deepEqual(g[4], [8.0, 123.8]);
  assert.deepEqual(g[8], [7.999729, 123.800272]);
});

test('hornSlopePct matches the pipeline and needs all 9 heights', () => {
  assert.ok(Math.abs((hornSlopePct(Z) as number) - 3.5843021946010944) < 1e-9);
  assert.equal(hornSlopePct([...Z.slice(0, 8), null]), null);
  assert.equal(hornSlopePct(Z.slice(0, 8)), null);
});

test('parseHeights rejects a bad answer', () => {
  assert.throws(() => parseHeights({ status: 'INVALID_REQUEST' }));
  assert.throws(() => parseHeights(ok([1, 2])));
  assert.deepEqual(parseHeights(ok([...Z.slice(0, 8), null])).slice(7), [34, null]);
});

test('elevationAndSlope: whole-percent slope, caveats for missing and 0 m', () => {
  assert.deepEqual(elevationAndSlope(Z, 8, 123.8), { elevation_m: 35, slope_pct: 4, lat: 8, lon: 123.8, caveats: [] });
  assert.match(elevationAndSlope(Z.map(() => 0), 8, 123.8).caveats[0], /0 m/);
  const missing = elevationAndSlope([null, ...Z.slice(1)], 8, 123.8);
  assert.equal(missing.slope_pct, null);
  assert.match(missing.caveats[0], /slope is unknown/);
});

test('srtmUrl: web goes to the same-origin proxy, native to Open Topo Data, both rounded', () => {
  assert.equal(srtmUrl(8.004567, 123.80012, true), '/api/srtm?lat=8.005&lon=123.8');
  const native = decodeURIComponent(srtmUrl(8.004567, 123.80012, false));
  assert.ok(native.startsWith('https://api.opentopodata.org/v1/srtm30m?locations=8.005271,'));
  assert.equal(native.split('|').length, 9);
});

test('fetchSrtm sends only the rounded point', async () => {
  const seen: number[][] = [];
  const r = await fetchSrtm(8.004567, 123.80012, async (la, lo) => (seen.push([la, lo]), ok(Z)));
  assert.deepEqual(seen, [[8.005, 123.8]]);
  assert.equal(r.elevation_m, 35);
});

const fixture: unknown = JSON.parse(
  readFileSync(new URL('./__fixtures__/power-monthly-8.2N-124.2E-2001-2025.json', import.meta.url), 'utf8'),
);

test('applySrtm: ET0 uses the field elevation, and a caveat compares field and cell heights', () => {
  const live = parsePowerMonthly(fixture, '2026-11-14', 'lot-1');
  assert.equal(typeof live.cell_elevation_m, 'number');
  const high = applySrtm(live, { elevation_m: 1500, slope_pct: 12, lat: 8.2, lon: 124.2, caveats: [] });
  assert.equal(high.elevation_m, 1500);
  assert.equal(high.slope_pct, 12);
  assert.deepEqual(high.srtm_point, [8.2, 124.2]);
  // Lower air pressure lowers the psychrometric constant, so ET0 rises a little (FAO-56 Eq. 7, 8).
  const sum = (a: (number | null)[]) => a.reduce((s: number, v) => s + (v ?? 0), 0);
  assert.ok(sum(high.monthly.et0_mm) > sum(live.monthly.et0_mm));
  assert.ok(!high.caveats.some((c) => /sea level/.test(c)));
  assert.ok(high.caveats.some((c) => c.startsWith('Field elevation from NASA SRTM: about 1500 m')));
  assert.ok(high.provenance.some((p) => p.field === 'elevation_m' && /SRTM/.test(p.source)));
  // Temperatures are not changed (no local lapse-rate source, #112 A1).
  assert.deepEqual(high.monthly.tmax_c, live.monthly.tmax_c);
  assert.equal(needsSrtm(high, 8.2001, 124.2001), false);
  assert.equal(needsSrtm(high, 8.21, 124.2), true);
});

function memoryStore(initial: Record<string, string> = {}): LotDataStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
}

test('ensureLotData: SRTM is added once, and SRTM trouble never blocks the climate data', async () => {
  const store = memoryStore();
  let srtmCalls = 0;
  const srtm = async () => (srtmCalls++, ok(Z));
  const r1 = await ensureLotData({ lotId: 'lot-1', lat: 8.2, lon: 124.2, store, fetcher: async () => fixture, srtmFetcher: srtm });
  assert.equal(r1.status, 'ready');
  assert.equal(r1.data?.elevation_m, 35);
  const r2 = await ensureLotData({ lotId: 'lot-1', lat: 8.2, lon: 124.2, store, fetcher: async () => fixture, srtmFetcher: srtm });
  assert.equal(r2.fetched, false);
  assert.equal(srtmCalls, 1);

  const store2 = memoryStore();
  const r3 = await ensureLotData({
    lotId: 'lot-2', lat: 8.2, lon: 124.2, store: store2, fetcher: async () => fixture,
    srtmFetcher: async () => { throw new Error('offline'); },
  });
  assert.equal(r3.status, 'ready');
  assert.equal(r3.data?.elevation_m, null);
});
