/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  POWER_END,
  POWER_START,
  PowerHttpError,
  PowerParseError,
  daysInMonth,
  ensureLotData,
  lotDataKey,
  parsePowerMonthly,
  percentile,
  powerUrl,
  roundForPower,
  type LotDataStore,
} from './power';

/**
 * Fixture: a real NASA POWER monthly response for 8.2N 124.2E, 2001 to 2025,
 * saved from the live API on 2026-11-14.
 *
 * The expected numbers below were computed separately in plain Python (own
 * percentile and calendar code), and the ET0 values with `pipeline/et0.py`,
 * not with the TypeScript under test.
 */
const fixture: unknown = JSON.parse(
  readFileSync(path.join(__dirname, '__fixtures__', 'power-monthly-8.2N-124.2E-2001-2025.json'), 'utf8'),
);

const EXPECTED = {
  p20: [71.176, 47.224, 36.828, 49.56, 136.09, 236.46, 229.772, 177.568, 204.3, 190.774, 124.86, 111.104],
  p50: [136.4, 103.04, 90.83, 78.6, 199.33, 266.1, 275.9, 220.41, 276.9, 263.81, 186.9, 190.96],
  p80: [256.184, 174.776, 136.524, 136.5, 274.97, 330.3, 339.822, 260.462, 317.46, 338.024, 235.56, 260.772],
  mean: [154.7768, 108.5952, 95.0212, 105.384, 205.6044, 290.208, 282.4844, 227.1804, 257.748, 272.0188, 186.816, 185.9256],
  tmax: [25.6054, 26.4212, 27.6096, 28.7516, 27.6972, 26.2458, 25.583, 25.6544, 25.6232, 25.8254, 26.161, 26.0442],
  tmin: [18.7234, 18.058, 18.6112, 19.6788, 20.7692, 20.4686, 20.0538, 19.9912, 19.9968, 20.0834, 19.851, 19.3358],
  hot: [27.8612, 28.7036, 30.1892, 31.454, 31.1008, 29.1492, 28.332, 28.2864, 28.2136, 28.412, 28.2296, 28.184],
  wet: [0.9056, 0.8524, 0.7908, 0.7452, 0.7692, 0.8528, 0.924, 0.9404, 0.9556, 0.9656, 0.9544, 0.9276],
  et0: [87.024841, 91.371653, 119.436812, 128.182515, 121.441936, 106.025706, 104.901841, 108.302247, 103.519563, 104.289938, 94.962219, 90.487529],
  et0Annual: 1259.9468,
};

function near(actual: number | null, expected: number, tol: number, label: string) {
  assert.notEqual(actual, null, `${label}: got null`);
  assert.ok(
    Math.abs((actual as number) - expected) <= tol,
    `${label}: got ${actual}, expected ${expected} +/- ${tol}`,
  );
}

function nearAll(actual: (number | null)[], expected: number[], tol: number, label: string) {
  assert.equal(actual.length, 12, `${label}: length`);
  expected.forEach((e, i) => near(actual[i], e, tol, `${label}[${i}]`));
}

// ---------------------------------------------------------------------------
// Synthetic responses for the rules in issue #6
// ---------------------------------------------------------------------------

interface SynthOpts {
  years?: number[];
  solarUnit?: string;
  solar?: number;
  /** Override values: parameter name, then YYYYMM key. */
  set?: Record<string, Record<string, number>>;
  omit?: string;
  elev?: number;
}

function synth(o: SynthOpts = {}): unknown {
  const years = o.years ?? [2023, 2024];
  const base: Record<string, number> = {
    T2M: 27,
    T2M_RANGE: 8,
    T2M_MAX: 33, // hottest day, deliberately different from T2M + T2M_RANGE/2 = 31
    PRECTOTCORR: 1,
    GWETROOT: 0.8,
    RH2M: 80,
    WS2M: 1.5,
    ALLSKY_SFC_SW_DWN: o.solar ?? 18,
  };
  const parameter: Record<string, Record<string, number>> = {};
  for (const [name, v] of Object.entries(base)) {
    if (name === o.omit) continue;
    parameter[name] = {};
    for (const y of years) {
      for (let m = 1; m <= 12; m++) parameter[name][`${y}${String(m).padStart(2, '0')}`] = v;
      parameter[name][`${y}13`] = 99999; // annual key, must be skipped
    }
  }
  for (const [name, kv] of Object.entries(o.set ?? {})) Object.assign(parameter[name], kv);
  return {
    geometry: { coordinates: [124.2, 8.2, o.elev ?? 100] },
    properties: { parameter },
    parameters: { ALLSKY_SFC_SW_DWN: { units: o.solarUnit ?? 'MJ/m^2/day' } },
  };
}

test('roundForPower and powerUrl: point rounded to 0.1 degrees, period and parameters set', () => {
  assert.equal(roundForPower(8.23), 8.2);
  assert.equal(roundForPower(124.26), 124.3);
  const u = new URL(powerUrl(8.23, 124.26));
  assert.equal(u.searchParams.get('latitude'), '8.2');
  assert.equal(u.searchParams.get('longitude'), '124.3');
  assert.equal(u.searchParams.get('start'), String(POWER_START));
  assert.equal(u.searchParams.get('end'), String(POWER_END));
  assert.equal(u.searchParams.get('community'), 'AG');
  const params = (u.searchParams.get('parameters') ?? '').split(',');
  for (const p of ['T2M', 'T2M_RANGE', 'PRECTOTCORR', 'RH2M', 'WS2M', 'ALLSKY_SFC_SW_DWN', 'GWETROOT']) {
    assert.ok(params.includes(p), `parameters should include ${p}`);
  }
});

test('percentile: linear interpolation, empty gives null', () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([4, 1, 3, 2], 0.5), 2.5);
  near(percentile([1, 2, 3, 4, 5], 0.2), 1.8, 1e-12, 'p20');
  assert.equal(percentile([7], 0.8), 7);
});

test('daysInMonth: February has 29 days in leap years only', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
  assert.equal(daysInMonth(2100, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
});

test('rainfall is mm/day times days in that month of that year (leap February)', () => {
  const d = parsePowerMonthly(synth({ years: [2023, 2024] }), '2026-11-14');
  const p = d.monthly.precip_mm;
  assert.equal(p.mean[0], 31); // 1 mm/day x 31
  assert.equal(p.p50[1], 28.5); // Feb: [28 (2023), 29 (2024)]
  assert.equal(p.mean[1], 28.5);
  near(p.p20[1], 28.2, 1e-9, 'Feb p20');
});

test('annual key YYYY13 is skipped', () => {
  const d = parsePowerMonthly(synth(), '2026-11-14');
  for (const arr of [d.monthly.precip_mm.mean, d.monthly.tmax_c, d.monthly.rootzone_wetness]) {
    arr.forEach((v) => assert.ok((v as number) < 1000, 'a 99999 annual value leaked in'));
  }
  assert.equal(d.years_used, 2);
});

test('-999 is treated as missing: that year is ignored, an all-missing month is null', () => {
  const d = parsePowerMonthly(
    synth({
      set: {
        PRECTOTCORR: { '202307': -999, '202405': -999, '202305': -999 },
        T2M: Object.fromEntries([2023, 2024].map((y) => [`${y}06`, -999])),
      },
    }),
    '2026-11-14',
  );
  assert.equal(d.monthly.precip_mm.mean[6], 31); // July: only 2024 left, 1 mm/day x 31
  assert.equal(d.monthly.precip_mm.mean[4], null); // May: both years missing
  assert.equal(d.monthly.precip_mm.p50[4], null);
  assert.equal(d.monthly.tmax_c[5], null); // June T2M missing in every year
  assert.equal(d.monthly.et0_mm[5], null); // so ET0 cannot be computed for June
  assert.notEqual(d.monthly.et0_mm[4], null); // May ET0 does not need rainfall
  assert.ok(d.caveats.some((c) => c.includes('Month 6')));
  // No value anywhere is the number -999
  assert.ok(!JSON.stringify(d.monthly).includes('-999'));
});

test('solar radiation unit is read from the response and converted to MJ m-2 day-1', () => {
  const mj = parsePowerMonthly(synth({ solar: 18, solarUnit: 'MJ/m^2/day' }), 'x');
  const kwh = parsePowerMonthly(synth({ solar: 5, solarUnit: 'kW-hr/m^2/day' }), 'x'); // 5 kWh = 18 MJ
  nearAll(kwh.monthly.et0_mm, mj.monthly.et0_mm as number[], 1e-9, 'ET0');
  assert.throws(() => parsePowerMonthly(synth({ solarUnit: 'cal/cm^2/day' }), 'x'), RangeError);
});

test('tmax/tmin are T2M +/- T2M_RANGE/2; hottest day is kept separately', () => {
  const d = parsePowerMonthly(synth(), 'x');
  assert.equal(d.monthly.tmax_c[0], 31); // 27 + 8/2
  assert.equal(d.monthly.tmin_c[0], 23); // 27 - 8/2
  assert.equal(d.monthly.hottest_day_c[0], 33); // the T2M_MAX value, labelled as hottest day
});

test('a response missing a parameter or with the wrong shape throws PowerParseError', () => {
  assert.throws(() => parsePowerMonthly(synth({ omit: 'RH2M' }), 'x'), PowerParseError);
  assert.throws(() => parsePowerMonthly({}, 'x'), PowerParseError);
  assert.throws(() => parsePowerMonthly(null, 'x'), PowerParseError);
});

test('provenance and caveats are filled; daily-only metrics are null for live lots', () => {
  const d = parsePowerMonthly(synth({ elev: 742 }), '2026-11-14');
  const fields = d.provenance.map((p) => p.field);
  for (const f of ['precip_mm', 'et0_mm', 'tmax_c', 'tmin_c', 'hottest_day_c', 'rootzone_wetness']) {
    assert.ok(fields.includes(f), `provenance for ${f}`);
  }
  for (const p of d.provenance) {
    assert.ok(p.source.includes('NASA POWER'));
    assert.equal(p.retrieved, '2026-11-14');
    assert.equal(p.period, '2023-2024');
    assert.ok(p.native_res.includes('0.5'));
  }
  assert.ok(d.caveats.some((c) => c.includes('same climate numbers')));
  assert.ok(d.caveats.some((c) => c.includes('742 m')));
  assert.equal(d.monthly.heat_days_gt35, null);
  assert.equal(d.monthly.heavy_rain_days_gt50mm, null);
});

// ---------------------------------------------------------------------------
// Real fixture
// ---------------------------------------------------------------------------

test('real NASA POWER response (Iligan point, 2001 to 2025) matches independently computed values', () => {
  const d = parsePowerMonthly(fixture, '2026-11-14');
  assert.equal(d.period, '2001-2025');
  assert.equal(d.years_used, 25);
  assert.deepEqual(d.source_point, { lat: 8.2, lon: 124.2 });
  near(d.cell_elevation_m, 741.88, 1e-9, 'cell elevation');
  nearAll(d.monthly.precip_mm.p20, EXPECTED.p20, 1e-4, 'p20');
  nearAll(d.monthly.precip_mm.p50, EXPECTED.p50, 1e-4, 'p50');
  nearAll(d.monthly.precip_mm.p80, EXPECTED.p80, 1e-4, 'p80');
  nearAll(d.monthly.precip_mm.mean, EXPECTED.mean, 1e-4, 'mean');
  nearAll(d.monthly.tmax_c, EXPECTED.tmax, 1e-4, 'tmax');
  nearAll(d.monthly.tmin_c, EXPECTED.tmin, 1e-4, 'tmin');
  nearAll(d.monthly.hottest_day_c, EXPECTED.hot, 1e-4, 'hottest day');
  nearAll(d.monthly.rootzone_wetness, EXPECTED.wet, 1e-4, 'wetness');
  nearAll(d.monthly.et0_mm, EXPECTED.et0, 1e-3, 'ET0');
  near((d.monthly.et0_mm as number[]).reduce((a, b) => a + b, 0), EXPECTED.et0Annual, 1e-2, 'annual ET0');
  // P20 <= P50 <= P80 in every month, and mean Tmax is below the hottest day
  for (let i = 0; i < 12; i++) {
    assert.ok((d.monthly.precip_mm.p20[i] as number) <= (d.monthly.precip_mm.p50[i] as number));
    assert.ok((d.monthly.precip_mm.p50[i] as number) <= (d.monthly.precip_mm.p80[i] as number));
    assert.ok((d.monthly.tmax_c[i] as number) < (d.monthly.hottest_day_c[i] as number));
  }
});

// ---------------------------------------------------------------------------
// ensureLotData: store, refetch rule, pending and error states
// ---------------------------------------------------------------------------

function memoryStore(initial: Record<string, string> = {}): LotDataStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      data.set(k, v);
    },
  };
}

const fixedNow = () => new Date('2026-11-14T10:00:00Z');

test('ensureLotData: first call fetches with the rounded point and stores the result', async () => {
  const store = memoryStore();
  const calls: [number, number][] = [];
  const r = await ensureLotData({
    lotId: 'lot-1',
    lat: 8.2349,
    lon: 124.2412,
    store,
    now: fixedNow,
    fetcher: async (lat, lon) => {
      calls.push([lat, lon]);
      return fixture;
    },
  });
  assert.equal(r.status, 'ready');
  assert.equal(r.fetched, true);
  assert.deepEqual(calls, [[8.2, 124.2]]); // the exact location is never sent
  assert.ok(store.data.has(lotDataKey('lot-1')));
  assert.equal(lotDataKey('lot-1'), 'lotdata:lot-1');
  assert.equal(r.data?.provenance[0].retrieved, '2026-11-14');
});

test('ensureLotData: same rounded point means no network request (works offline)', async () => {
  const store = memoryStore();
  await ensureLotData({ lotId: 'a', lat: 8.2, lon: 124.2, store, fetcher: async () => fixture });
  let called = 0;
  const r = await ensureLotData({
    lotId: 'a',
    lat: 8.24, // still rounds to 8.2
    lon: 124.16, // still rounds to 124.2
    store,
    fetcher: async () => {
      called++;
      throw new TypeError('Network request failed');
    },
  });
  assert.equal(called, 0);
  assert.equal(r.status, 'ready');
  assert.equal(r.fetched, false);
});

test('ensureLotData: a change in the rounded point refetches; force refetches', async () => {
  const store = memoryStore();
  await ensureLotData({ lotId: 'a', lat: 8.2, lon: 124.2, store, fetcher: async () => fixture });
  let called = 0;
  const f = async () => {
    called++;
    return fixture;
  };
  await ensureLotData({ lotId: 'a', lat: 8.26, lon: 124.2, store, fetcher: f }); // rounds to 8.3
  assert.equal(called, 1);
  await ensureLotData({ lotId: 'a', lat: 8.26, lon: 124.2, store, fetcher: f, force: true });
  assert.equal(called, 2);
});

test('ensureLotData: offline gives pending and keeps the stale data', async () => {
  const store = memoryStore();
  const first = await ensureLotData({ lotId: 'a', lat: 8.2, lon: 124.2, store, fetcher: async () => fixture });
  const r = await ensureLotData({
    lotId: 'a',
    lat: 8.2,
    lon: 124.2,
    store,
    force: true,
    fetcher: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.equal(r.status, 'pending');
  assert.deepEqual(r.data, first.data);
  assert.ok(r.error?.includes('Network'));
});

test('ensureLotData: offline with nothing stored gives pending and no data', async () => {
  const r = await ensureLotData({
    lotId: 'new',
    lat: 8.2,
    lon: 124.2,
    store: memoryStore(),
    fetcher: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.equal(r.status, 'pending');
  assert.equal(r.data, null);
});

test('ensureLotData: server trouble retries later, client errors and bad data are errors', async () => {
  const run = (fetcher: () => Promise<unknown>) =>
    ensureLotData({ lotId: 'x', lat: 8.2, lon: 124.2, store: memoryStore(), fetcher });
  assert.equal(
    (await run(async () => {
      throw new PowerHttpError(503);
    })).status,
    'pending',
  );
  assert.equal(
    (await run(async () => {
      throw new PowerHttpError(429);
    })).status,
    'pending',
  );
  assert.equal(
    (await run(async () => {
      throw new PowerHttpError(422);
    })).status,
    'error',
  );
  assert.equal((await run(async () => ({ nope: true }))).status, 'error');
});

test('ensureLotData: unreadable stored data is ignored and refetched', async () => {
  const store = memoryStore({ [lotDataKey('a')]: '{not json' });
  const r = await ensureLotData({ lotId: 'a', lat: 8.2, lon: 124.2, store, fetcher: async () => fixture });
  assert.equal(r.status, 'ready');
  assert.equal(r.fetched, true);
});
