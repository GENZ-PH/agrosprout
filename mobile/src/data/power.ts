/**
 * Live NASA POWER monthly fetch for one lot (issue #6).
 *
 * Source: NASA POWER (Prediction Of Worldwide Energy Resources), monthly point
 * API, community "AG". https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
 *
 * Pure parsing plus a small orchestration layer with an injected store and
 * fetcher, so everything is unit-testable in Node. No React Native imports
 * here: the AsyncStorage adapter lives in `lotdata-store.ts`.
 *
 * Checked against the daily endpoint (Iligan point, 2001 to 2024, 2026-11-14):
 *  - monthly `T2M`, `T2M_RANGE`, `RH2M` are means of the daily values;
 *  - monthly `T2M_MAX` is the HOTTEST day of the month (and `T2M_MIN` the
 *    coldest), not the mean daily max/min. So mean Tmax/Tmin are taken as
 *    `T2M +/- T2M_RANGE / 2` (about 0.5 C off the true daily means there).
 *    `T2M_MAX` is not requested as a field of its own anymore;
 *  - monthly `PRECTOTCORR` is mm/day, so it is multiplied by the days in that
 *    month of that year (29 for February in a leap year);
 *  - the key `YYYY13` is the annual value and is skipped; `-999` is missing.
 */

import type { DataStatus, LotData, MonthlySeries, Provenance } from '../types';
import { lotDataKey } from '../types';
import { fetchWithTimeout } from '../net/fetch';
import { DAYS_IN_MONTH, monthlyEt0, solarToMJ } from './et0';
import { fetchSrtm, roundForSrtm, SRTM_ACQUIRED, SRTM_CITATION, type SrtmFetcher, type SrtmResult } from './srtm';
import { applyDaily, isDailyRetryable, markDailyTried, needsDaily, type DailyFetcher } from './power-daily';

export { lotDataKey };

type Months12 = MonthlySeries;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/monthly/point';
/** First and last year requested. 2025 was complete with no missing values (checked 2026-11-14). */
export const POWER_START = 2001;
export const POWER_END = 2025;
export const POWER_PARAMS = [
  'T2M',
  'T2M_RANGE',
  'PRECTOTCORR',
  'GWETROOT',
  'RH2M',
  'WS2M',
  'ALLSKY_SFC_SW_DWN',
] as const;
/**
 * Native resolutions, for provenance text (NASA POWER docs, read 2026-11-14:
 * power.larc.nasa.gov/docs/methodology/data/sources_meteorology and sources_fluxes).
 * Meteorology (rain, temperature, humidity, wind, soil wetness) is MERRA-2 on a 1/2 x 5/8 degree grid;
 * solar radiation is CERES SYN1deg on a 1 x 1 degree grid.
 */
const NATIVE_RES = '0.5° × 0.625° grid cell';
const NATIVE_RES_SOLAR = '1° × 1° grid cell';
const NATIVE_RES_ET0 = `${NATIVE_RES}; solar radiation ${NATIVE_RES_SOLAR}`;

// ---------------------------------------------------------------------------
// Types: the shared contract lives in `../types` (issue #4, frozen)
// ---------------------------------------------------------------------------

export class PowerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PowerParseError';
  }
}

export class PowerHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`NASA POWER request failed (${status})`);
    this.name = 'PowerHttpError';
    this.status = status;
  }
}

interface PowerResponse {
  geometry: { coordinates: [number, number, number] };
  properties: { parameter: Record<string, Record<string, number>> };
  parameters?: Record<string, { units?: string }>;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/** Round to 0.1 degree so the exact location is never sent (POWER cells are ~0.5 degrees wide). */
export function roundForPower(v: number): number {
  return Math.round(v * 10) / 10;
}

export function powerUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: POWER_PARAMS.join(','),
    community: 'AG',
    longitude: String(roundForPower(lon)),
    latitude: String(roundForPower(lat)),
    start: String(POWER_START),
    end: String(POWER_END),
    format: 'JSON',
  });
  return `${POWER_BASE}?${q.toString()}`;
}

/** Plain network fetch with a timeout (shared helper). Throws `PowerHttpError` for non-2xx responses. */
export async function fetchPowerMonthly(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetchWithTimeout(powerUrl(lat, lon), { signal });
  if (!res.ok) throw new PowerHttpError(res.status);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month1: number): number {
  return month1 === 2 && isLeap(year) ? 29 : DAYS_IN_MONTH[month1 - 1];
}

/** Linear-interpolated percentile (p in 0..1) of the values; `null` for an empty list. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

interface Row {
  year: number;
  month: number; // 1..12
  v: number;
}

/** Rows for one parameter. Skips the `YYYY13` annual key and `-999` / non-numeric values. */
function rows(series: Record<string, number>): Row[] {
  const out: Row[] = [];
  for (const [key, v] of Object.entries(series)) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    if (!Number.isInteger(year) || month < 1 || month > 12) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v === -999) continue;
    out.push({ year, month, v });
  }
  return out;
}

function perMonth(rs: Row[], f: (values: number[]) => number | null): Months12 {
  return Array.from({ length: 12 }, (_, i) => f(rs.filter((r) => r.month === i + 1).map((r) => r.v)));
}

function validate(json: unknown): PowerResponse {
  const j = json as Partial<PowerResponse> | null;
  const coords = j?.geometry?.coordinates;
  const param = j?.properties?.parameter;
  if (!Array.isArray(coords) || coords.length < 3 || !param || typeof param !== 'object') {
    throw new PowerParseError('Unexpected NASA POWER response shape');
  }
  for (const name of POWER_PARAMS) {
    if (!param[name] || typeof param[name] !== 'object') {
      throw new PowerParseError(`NASA POWER response is missing ${name}`);
    }
  }
  return j as PowerResponse;
}

/** Turn a NASA POWER monthly response into 12-month climatology for one lot. */
export function parsePowerMonthly(json: unknown, retrieved: string, lotId = ''): LotData {
  const r = validate(json);
  const [lon, lat, elev] = r.geometry.coordinates;
  const p = r.properties.parameter;

  // Rainfall: mm/day times the days in that month of that year, then percentiles across years.
  const precipRows = rows(p.PRECTOTCORR).map((x) => ({ ...x, v: x.v * daysInMonth(x.year, x.month) }));
  const precip = {
    p20: perMonth(precipRows, (v) => percentile(v, 0.2)),
    p50: perMonth(precipRows, (v) => percentile(v, 0.5)),
    p80: perMonth(precipRows, (v) => percentile(v, 0.8)),
  };

  const t2m = perMonth(rows(p.T2M), mean);
  const range = perMonth(rows(p.T2M_RANGE), mean);
  const tmax = t2m.map((t, i) => (t === null || range[i] === null ? null : t + (range[i] as number) / 2));
  const tmin = t2m.map((t, i) => (t === null || range[i] === null ? null : t - (range[i] as number) / 2));
  const rh = perMonth(rows(p.RH2M), mean);
  const wind = perMonth(rows(p.WS2M), mean);
  const wetness = perMonth(rows(p.GWETROOT), mean);

  // Solar radiation: read the unit from the response and convert to MJ m-2 day-1.
  const solarUnit = r.parameters?.ALLSKY_SFC_SW_DWN?.units ?? 'MJ/m^2/day';
  const rs = perMonth(rows(p.ALLSKY_SFC_SW_DWN), mean).map((v) =>
    v === null ? null : solarToMJ(v, solarUnit),
  );

  const caveats = [
    'Climate values describe a NASA POWER grid cell of roughly 50 km, not your exact field. Nearby lots in the same cell share the same climate numbers.',
    `NASA reports this cell's average elevation as about ${Math.round(elev)} m. The values describe that average height, so a field at a different elevation will differ, mainly in temperature.`,
  ];

  let et0: Months12;
  try {
    const e = monthlyEt0({
      tmaxC: tmax,
      tminC: tmin,
      rhMeanPct: rh,
      windMs2m: wind,
      rsMjM2Day: rs,
      latDeg: lat,
      elevM: null,
    });
    et0 = e.et0MmMonth;
    for (const w of e.warnings) caveats.push(`Evapotranspiration: ${w}`);
  } catch (err) {
    if (!(err instanceof RangeError)) throw err;
    et0 = Array<number | null>(12).fill(null);
    caveats.push(`Evapotranspiration not computed: ${err.message}`);
  }

  const years = [...new Set(precipRows.map((x) => x.year))].sort((a, b) => a - b);
  const period = years.length ? `${years[0]}-${years[years.length - 1]}` : `${POWER_START}-${POWER_END}`;
  const src = (field: string, source: string, note?: string, nativeRes: string = NATIVE_RES): Provenance => ({
    field,
    source,
    native_res: nativeRes,
    period,
    retrieved,
    ...(note ? { note } : {}),
  });

  return {
    id: lotId,
    name: null,
    kind: 'live',
    lat: roundForPower(lat),
    lon: roundForPower(lon),
    // SRTM elevation is added by `applySrtm` when the elevation service answers; until then
    // ET0 uses sea level (contract) and says so.
    elevation_m: null,
    slope_pct: null,
    srtm_point: null,
    cell_elevation_m: Number.isFinite(elev) ? elev : null,
    period,
    monthly: {
      precip_mm: precip,
      et0_mm: et0,
      tmax_c: tmax,
      tmin_c: tmin,
      rootzone_wetness: wetness,
      rh2m_pct: rh,
      ws2m_ms: wind,
      solar_mj_m2_day: rs,
      heat_days_gt35: null,
      heavy_rain_days_gt50mm: null,
      smap_rootzone_m3m3: null,
    },
    trends: null,
    provenance: [
      src('monthly.precip_mm', 'NASA POWER PRECTOTCORR', 'mm/day times days in the month, percentiles across years (linear interpolation)'),
      src(
        'monthly.et0_mm',
        'FAO-56 Penman-Monteith from NASA POWER T2M, T2M_RANGE, RH2M, WS2M, ALLSKY_SFC_SW_DWN',
        'monthly means, Eq. 6; sea-level pressure assumed until the SRTM elevation is available',
        NATIVE_RES_ET0,
      ),
      src('monthly.tmax_c', 'NASA POWER T2M + T2M_RANGE/2', 'approximation of the mean daily maximum'),
      src('monthly.tmin_c', 'NASA POWER T2M - T2M_RANGE/2', 'approximation of the mean daily minimum'),
      src('monthly.rootzone_wetness', 'NASA POWER GWETROOT', '0 = dry, 1 = saturated'),
      src('monthly.rh2m_pct', 'NASA POWER RH2M'),
      src('monthly.ws2m_ms', 'NASA POWER WS2M'),
      src('monthly.solar_mj_m2_day', 'NASA POWER ALLSKY_SFC_SW_DWN', 'converted to MJ m-2 day-1', NATIVE_RES_SOLAR),
    ],
    caveats,
  };
}

// ---------------------------------------------------------------------------
// NASA SRTM: field elevation and slope (#9, #57)
// ---------------------------------------------------------------------------

const SEA_LEVEL_NOTE = 'sea-level pressure assumed until the SRTM elevation is available';

/**
 * Adds the field's SRTM elevation and slope to live lot data and recomputes ET0 with the
 * air pressure at that elevation (FAO-56 Eq. 7). Temperature is NOT corrected: there is no
 * local lapse-rate source yet (#112 A1), so a caveat compares the field and cell heights instead.
 */
export function applySrtm(data: LotData, srtm: SrtmResult): LotData {
  const m = data.monthly;
  let et0 = m.et0_mm;
  // The field-vs-cell line below replaces POWER's general cell-height note.
  const caveats = data.caveats.filter(
    (c) => !c.startsWith('Evapotranspiration:') && !c.startsWith('Field elevation') && !(srtm.elevation_m !== null && c.startsWith("NASA reports this cell's average elevation")),
  );
  if (srtm.elevation_m !== null && m.rh2m_pct && m.ws2m_ms && m.solar_mj_m2_day) {
    try {
      const e = monthlyEt0({
        tmaxC: m.tmax_c,
        tminC: m.tmin_c,
        rhMeanPct: m.rh2m_pct,
        windMs2m: m.ws2m_ms,
        rsMjM2Day: m.solar_mj_m2_day,
        latDeg: data.lat,
        elevM: srtm.elevation_m,
      });
      et0 = e.et0MmMonth;
      for (const w of e.warnings) caveats.push(`Evapotranspiration: ${w}`);
    } catch (err) {
      if (!(err instanceof RangeError)) throw err;
    }
  }
  const cell = data.cell_elevation_m;
  if (srtm.elevation_m !== null && typeof cell === 'number') {
    caveats.push(
      `Field elevation from NASA SRTM: about ${Math.round(srtm.elevation_m)} m. The climate numbers are for the NASA POWER cell average of about ${Math.round(cell)} m, so temperatures here can differ from the field, and are not adjusted.`,
    );
  }
  caveats.push(...srtm.caveats);
  const provenance = data.provenance
    .filter((p) => !p.field.startsWith('elevation_m') && !p.field.startsWith('slope_pct'))
    .map((p) => (p.field === 'monthly.et0_mm' && srtm.elevation_m !== null && p.note ? { ...p, note: p.note.replace(SEA_LEVEL_NOTE, 'air pressure from the SRTM field elevation (FAO-56 Eq. 7)') } : p));
  const srtmProv = (field: string, note: string): Provenance => ({
    field,
    source: SRTM_CITATION,
    native_res: '1 arc-second (about 30 m)',
    period: SRTM_ACQUIRED,
    retrieved: data.provenance[0]?.retrieved ?? '',
    note,
  });
  if (srtm.elevation_m !== null) provenance.push(srtmProv('elevation_m', 'lot centre rounded to 0.001 degree (about 110 m) before sending'));
  if (srtm.slope_pct !== null) provenance.push(srtmProv('slope_pct', 'Horn (1981) slope on a 3 x 3 grid 30 m apart, whole percent; a rough terrain class'));
  return {
    ...data,
    elevation_m: srtm.elevation_m,
    slope_pct: srtm.slope_pct,
    srtm_point: [srtm.lat, srtm.lon],
    monthly: { ...m, et0_mm: et0 },
    provenance,
    caveats,
  };
}

/** True when stored live data has no SRTM answer for this lot centre yet. */
export function needsSrtm(data: LotData, lat: number, lon: number): boolean {
  const p = data.srtm_point;
  return !p || p[0] !== roundForSrtm(lat) || p[1] !== roundForSrtm(lon);
}

/** Best effort: SRTM trouble never blocks the climate data. */
async function withSrtm(data: LotData, lat: number, lon: number, fetcher: SrtmFetcher | undefined, signal?: AbortSignal): Promise<LotData> {
  if (!fetcher || !needsSrtm(data, lat, lon)) return data;
  try {
    return applySrtm(data, await fetchSrtm(lat, lon, fetcher, signal));
  } catch {
    return data;
  }
}

/**
 * Best effort: NASA POWER daily data (heat, heavy-rain and frost days, trends), once per rounded
 * point. Offline or server trouble leaves the data as is (tried again later); a bad answer or a
 * client error is marked as tried so it is not downloaded again for this point.
 */
async function withDaily(data: LotData, fetcher: DailyFetcher | undefined, retrieved: string, signal?: AbortSignal): Promise<LotData> {
  if (!fetcher || !needsDaily(data)) return data;
  try {
    return applyDaily(data, await fetcher(data.lat, data.lon, signal), retrieved);
  } catch (err) {
    return isDailyRetryable(err) ? data : markDailyTried(data);
  }
}

// ---------------------------------------------------------------------------
// Orchestration: store, refetch rule, pending/error states
// ---------------------------------------------------------------------------

/** Minimal key-value store. The AsyncStorage adapter is in `lotdata-store.ts`. */
export interface LotDataStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export type PowerFetcher = (lat: number, lon: number, signal?: AbortSignal) => Promise<unknown>;

export type LotDataStatus = DataStatus;

export interface EnsureResult {
  status: LotDataStatus;
  /** Latest data we have, possibly stale when `status` is not `ready`. */
  data: LotData | null;
  /** True when a network request was made. */
  fetched: boolean;
  error?: string;
}

/** Live climate data saved under `key`, or `null` when there is none or it is unreadable. */
export async function readStored(store: Pick<LotDataStore, 'get'>, key: string): Promise<LotData | null> {
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as LotData;
    return d && d.kind === 'live' && typeof d.lat === 'number' && d.monthly ? d : null;
  } catch {
    return null;
  }
}

/** Network and server-side trouble that should retry later, not mark the lot as broken. */
function isRetryable(err: unknown): boolean {
  if (err instanceof PowerParseError) return false;
  if (err instanceof PowerHttpError) return err.status === 429 || err.status >= 500;
  return true; // fetch rejected (offline, DNS, timeout, abort)
}

/**
 * Make sure a lot has climate data on the device.
 *
 * - Already stored for the same rounded query point: no network request.
 * - Rounded point changed (or `force`): fetch again. The refetch rule is on the
 *   rounded point, because that is the only thing that changes what POWER returns.
 * - Offline or server trouble: status `pending`, keep whatever we had.
 * - Bad response or a client error (e.g. 422): status `error`.
 */
export async function ensureLotData(args: {
  lotId: string;
  lat: number;
  lon: number;
  store: LotDataStore;
  fetcher?: PowerFetcher;
  /** NASA SRTM elevation fetcher; omitted = no elevation request (tests, or no network). */
  srtmFetcher?: SrtmFetcher;
  /**
   * NASA POWER daily fetcher (`fetchPowerDaily`); omitted = no daily request. Runs after the
   * monthly data (and SRTM) is saved, so it never holds back or loses the monthly data.
   */
  dailyFetcher?: DailyFetcher;
  now?: () => Date;
  force?: boolean;
  signal?: AbortSignal;
}): Promise<EnsureResult> {
  const { lotId, lat, lon, store, force = false, signal } = args;
  const fetcher = args.fetcher ?? fetchPowerMonthly;
  const now = args.now ?? (() => new Date());
  const today = () => now().toISOString().slice(0, 10);
  const key = lotDataKey(lotId);
  const want = { lat: roundForPower(lat), lon: roundForPower(lon) };

  const stored = await readStored(store, key);
  if (stored && !force && stored.lat === want.lat && stored.lon === want.lon) {
    // Climate is current; fill in the field elevation and the daily extremes if missing.
    const withElev = await withSrtm(stored, lat, lon, args.srtmFetcher, signal);
    if (withElev !== stored) await store.set(key, JSON.stringify(withElev));
    const data = await withDaily(withElev, args.dailyFetcher, today(), signal);
    if (data !== withElev) await store.set(key, JSON.stringify(data));
    return { status: 'ready', data, fetched: data !== stored };
  }

  try {
    const json = await fetcher(want.lat, want.lon, signal);
    const parsed = parsePowerMonthly(json, today(), lotId);
    const monthly = await withSrtm(parsed, lat, lon, args.srtmFetcher, signal);
    await store.set(key, JSON.stringify(monthly));
    const data = await withDaily(monthly, args.dailyFetcher, today(), signal);
    if (data !== monthly) await store.set(key, JSON.stringify(data));
    return { status: 'ready', data, fetched: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: isRetryable(err) ? 'pending' : 'error',
      data: stored,
      fetched: true,
      error: message,
    };
  }
}
