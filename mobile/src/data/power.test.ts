/// <reference types="node" />
import { readFileSync } from 'node:fs';
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
  readFileSync(new URL('./__fixtures__/power-monthly-8.2N-124.2E-2001-2025.json', import.meta.url), 'utf8'),
);

const EXPECTED = {
  p20: [71.176, 47.224, 36.828, 49.56, 136.09, 236.46, 229.772, 177.568, 204.3, 190.774, 124.86, 111.104],
  p50: [136.4, 103.04, 90.83, 78.6, 199.33, 266.1, 275.9, 220.41, 276.9, 263.81, 186.9, 190.96],
  p80: [256.184, 174.776, 136.524, 136.5, 274.97, 330.3, 339.822, 260.462, 317.46, 338.024, 235.56, 260.772],
  tmax: [25.6054, 26.4212, 27.6096, 28.7516, 27.6972, 26.2458, 25.583, 25.6544, 25.6232, 25.8254, 26.161, 26.0442],
  tmin: [18.7234, 18.058, 18.6112, 19.6788, 20.7692, 20.4686, 20.0538, 19.9912, 19.9968, 20.0834, 19.851, 19.3358],
  wet: [0.9056, 0.8524, 0.7908, 0.7452, 0.7692, 0.8528, 0.924, 0.9404, 0.9556, 0.9656, 0.9544, 0.9276],
  // Sea-level ET0 (SRTM elevation not wired yet, #9), via pipeline/et0.py.
  et0: [84.675016, 89.063888, 116.642424, 125.402616, 118.506769, 103.209947, 101.998979, 105.299228, 100.60643, 101.364242, 92.367528, 88.053175],
  et0Annual: 1227.190244,
  rh: [88.7036, 85.9576, 82.4188, 79.0956, 83.3096, 86.6984, 88.2836, 88.15, 88.594, 88.5832, 87.7888, 88.0808],
  ws: [1.9888, 2.064, 1.8144, 1.5304, 1.336, 1.4312, 1.7516, 1.8084, 1.704, 1.6204, 1.494, 1.6832],
  rs: [15.0852, 17.3904, 19.9692, 21.342, 19.6912, 18.2908, 18.0108, 18.6916, 18.494, 18.0932, 16.94, 15.6032],
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
  assert.equal(p.p50[0], 31); // 1 mm/day x 31
  assert.equal(p.p50[1], 28.5); // Feb: [28 (2023), 29 (2024)]
  near(p.p20[1], 28.2, 1e-9, 'Feb p20');
});

test('annual key YYYY13 is skipped', () => {
  const d = parsePowerMonthly(synth(), '2026-11-14');
  for (const arr of [d.monthly.precip_mm.p50, d.monthly.tmax_c, d.monthly.rootzone_wetness]) {
    arr.forEach((v) => assert.ok((v as number) < 1000, 'a 99999 annual value leaked in'));
  }
  assert.equal(d.period, '2023-2024');
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
  assert.equal(d.monthly.precip_mm.p50[6], 31); // July: only 2024 left, 1 mm/day x 31
  assert.equal(d.monthly.precip_mm.p50[4], null); // May: both years missing
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

test('tmax/tmin are T2M +/- T2M_RANGE/2, not the hottest-day T2M_MAX', () => {
  const d = parsePowerMonthly(synth(), 'x');
  assert.equal(d.monthly.tmax_c[0], 31); // 27 + 8/2
  assert.equal(d.monthly.tmin_c[0], 23); // 27 - 8/2
  assert.notEqual(d.monthly.tmax_c[0], 33); // the monthly T2M_MAX (hottest day) is not used
});

test('a response missing a parameter or with the wrong shape throws PowerParseError', () => {
  assert.throws(() => parsePowerMonthly(synth({ omit: 'RH2M' }), 'x'), PowerParseError);
  assert.throws(() => parsePowerMonthly({}, 'x'), PowerParseError);
  assert.throws(() => parsePowerMonthly(null, 'x'), PowerParseError);
});

test('provenance and caveats are filled; daily-only metrics are null for live lots', () => {
  const d = parsePowerMonthly(synth({ elev: 742 }), '2026-11-14');
  const fields = d.provenance.map((p) => p.field);
  for (const f of ['precip_mm', 'et0_mm', 'tmax_c', 'tmin_c', 'rootzone_wetness', 'rh2m_pct', 'ws2m_ms', 'solar_mj_m2_day']) {
    assert.ok(fields.includes(`monthly.${f}`), `provenance for ${f}`);
  }
  for (const p of d.provenance) {
    assert.ok(p.source.includes('NASA POWER'));
    assert.equal(p.retrieved, '2026-11-14');
    assert.equal(p.period, '2023-2024');
    assert.ok(p.native_res.includes('0.5'));
  }
  assert.ok(d.caveats.some((c) => c.includes('same climate numbers')));
  assert.ok(d.caveats.some((c) => c.includes('742 m')));
  assert.equal(d.elevation_m, null); // SRTM elevation arrives with #9
  assert.ok(d.caveats.some((c) => c.includes('sea level')));
  assert.equal(d.kind, 'live');
  assert.equal(d.trends, null);
  assert.equal(d.monthly.heat_days_gt35, null);
  assert.equal(d.monthly.heavy_rain_days_gt50mm, null);
});

// ---------------------------------------------------------------------------
// Real fixture
// ---------------------------------------------------------------------------

test('real NASA POWER response (Iligan point, 2001 to 2025) matches independently computed values', () => {
  const d = parsePowerMonthly(fixture, '2026-11-14');
  assert.equal(d.period, '2001-2025');
  assert.deepEqual([d.lat, d.lon], [8.2, 124.2]);
  nearAll(d.monthly.precip_mm.p20, EXPECTED.p20, 1e-4, 'p20');
  nearAll(d.monthly.precip_mm.p50, EXPECTED.p50, 1e-4, 'p50');
  nearAll(d.monthly.precip_mm.p80, EXPECTED.p80, 1e-4, 'p80');
  nearAll(d.monthly.tmax_c, EXPECTED.tmax, 1e-4, 'tmax');
  nearAll(d.monthly.tmin_c, EXPECTED.tmin, 1e-4, 'tmin');
  nearAll(d.monthly.rootzone_wetness, EXPECTED.wet, 1e-4, 'wetness');
  nearAll(d.monthly.rh2m_pct as number[], EXPECTED.rh, 1e-4, 'rh');
  nearAll(d.monthly.ws2m_ms as number[], EXPECTED.ws, 1e-4, 'wind');
  nearAll(d.monthly.solar_mj_m2_day as number[], EXPECTED.rs, 1e-4, 'solar');
  nearAll(d.monthly.et0_mm, EXPECTED.et0, 1e-3, 'ET0');
  near((d.monthly.et0_mm as number[]).reduce((a, b) => a + b, 0), EXPECTED.et0Annual, 1e-2, 'annual ET0');
  // P20 <= P50 <= P80 in every month
  for (let i = 0; i < 12; i++) {
    assert.ok((d.monthly.precip_mm.p20[i] as number) <= (d.monthly.precip_mm.p50[i] as number));
    assert.ok((d.monthly.precip_mm.p50[i] as number) <= (d.monthly.precip_mm.p80[i] as number));
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
