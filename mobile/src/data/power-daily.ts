/**
 * Live NASA POWER DAILY data for one lot: heat-stress days, heavy-rain days, frost days and
 * long-term trends, the values the bundled demo farms get from `pipeline/build_demo.py`.
 *
 * Source: NASA POWER daily point API, community "AG".
 * https://power.larc.nasa.gov/docs/services/api/temporal/daily/ (read 2026-11-14: dates are
 * YYYYMMDD, at most 20 parameters per point request, Local Solar Time by default).
 * Checked on 2026-11-14 for 8.2 N 124.2 E, 2001-2025: HTTP 200, about 456 KB of JSON,
 * `access-control-allow-origin: *` (so the web build can call it directly), fill value -999.
 *
 * The aggregation is a line-by-line port of `pipeline/aggregate.py` (monthly_stat, annual,
 * per_calendar_month, sen_slope, mann_kendall_p, trend_per_decade) and of the trend block of
 * `pipeline/build_demo.py`, so live lots and demo farms get the same numbers from the same days.
 *
 * No React Native imports, and no import from `./power` (that module imports this one).
 */

import type { LotData, LotTrends, MonthlySeries, Provenance } from '../types';
import { fetchWithTimeout } from '../net/fetch';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const POWER_DAILY_BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';
/** Same years as the monthly request and the demo pipeline. */
export const DAILY_START = 2001;
export const DAILY_END = 2025;
export const DAILY_PARAMS = ['T2M_MAX', 'T2M_MIN', 'PRECTOTCORR'] as const;
/** The answer is a few hundred KB (456 KB for 2001-2025), so allow much longer than the default 15 s. */
export const DAILY_TIMEOUT_MS = 90_000;

/** A year-month with more than this share of missing days is missing (pipeline/aggregate.py). */
export const MAX_MISSING_SHARE = 0.1;
/** Heat-stress day: daily Tmax above 35 °C (issue #8, same as pipeline/aggregate.py HEAT_DAY_TMAX_C). */
export const HEAT_DAY_TMAX_C = 35;
/** Heavy-rain day: daily rain above 50 mm (issue #8, same as pipeline/aggregate.py HEAVY_RAIN_DAY_MM). */
export const HEAVY_RAIN_DAY_MM = 50;
/**
 * Frost day: daily minimum temperature below 0 °C. ETCCDI climate-extremes index FD, "Annual
 * count of days when TN (daily minimum temperature) < 0oC" (Karl et al. 1999; Peterson et al.
 * 2001, WMO), https://etccdi.pacificclimate.org/list_27_indices.shtml (read 2026-11-14).
 * The test is strictly below 0 °C, as in the index.
 */
export const FROST_DAY_TMIN_C = 0;
export const TREND_METHOD = "Sen's slope / Mann-Kendall";

const NATIVE_RES = '0.5° × 0.625° grid cell';
const MISSING = -999;

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/** Same 0.1 degree rounding as `roundForPower` in power.ts (rule 8: never the exact location). */
function round01(v: number): number {
  return Math.round(v * 10) / 10;
}

export function powerDailyUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: DAILY_PARAMS.join(','),
    community: 'AG',
    longitude: String(round01(lon)),
    latitude: String(round01(lat)),
    start: `${DAILY_START}0101`,
    end: `${DAILY_END}1231`,
    format: 'JSON',
  });
  return `${POWER_DAILY_BASE}?${q.toString()}`;
}

export type DailyFetcher = (lat: number, lon: number, signal?: AbortSignal) => Promise<unknown>;

export class DailyHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`NASA POWER daily request failed (${status})`);
    this.name = 'DailyHttpError';
    this.status = status;
  }
}

export class DailyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyParseError';
  }
}

/** Network fetch of the daily series with a long timeout. Throws `DailyHttpError` for non-2xx. */
export async function fetchPowerDaily(lat: number, lon: number, signal?: AbortSignal): Promise<unknown> {
  const res = await fetchWithTimeout(powerDailyUrl(lat, lon), { signal }, DAILY_TIMEOUT_MS);
  if (!res.ok) throw new DailyHttpError(res.status);
  return await res.json();
}

/** Trouble worth trying again later (offline, timeout, 429, 5xx), as opposed to a bad answer. */
export function isDailyRetryable(err: unknown): boolean {
  if (err instanceof DailyParseError) return false;
  if (err instanceof DailyHttpError) return err.status === 429 || err.status >= 500;
  return true;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** "YYYYMMDD" -> value, `null` = missing. */
export type Daily = Map<string, number | null>;
/** year * 100 + month -> value, `null` = missing. Insertion order is chronological. */
export type YearMonthly = Map<number, number | null>;

export interface DailySeries {
  T2M_MAX: Daily;
  T2M_MIN: Daily;
  PRECTOTCORR: Daily;
}

/** The three daily series, -999 and non-numbers turned into `null` (pipeline fetch_power.daily_series). */
export function dailySeries(json: unknown): DailySeries {
  const param = (json as { properties?: { parameter?: Record<string, unknown> } } | null)?.properties?.parameter;
  if (!param || typeof param !== 'object') throw new DailyParseError('Unexpected NASA POWER daily response shape');
  const out: Partial<DailySeries> = {};
  for (const name of DAILY_PARAMS) {
    const days = param[name];
    if (!days || typeof days !== 'object') throw new DailyParseError(`NASA POWER daily response is missing ${name}`);
    const m: Daily = new Map();
    for (const [k, v] of Object.entries(days as Record<string, unknown>)) {
      if (!/^\d{8}$/.test(k)) continue;
      m.set(k, typeof v === 'number' && Number.isFinite(v) && v !== MISSING ? v : null);
    }
    if (m.size === 0) throw new DailyParseError(`NASA POWER daily ${name} has no days`);
    out[name] = m;
  }
  return out as DailySeries;
}

// ---------------------------------------------------------------------------
// Aggregation (port of pipeline/aggregate.py)
// ---------------------------------------------------------------------------

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function byYearMonth(daily: Daily): Map<number, (number | null)[]> {
  const groups = new Map<number, (number | null)[]>();
  for (const key of [...daily.keys()].sort()) {
    const ym = Number(key.slice(0, 4)) * 100 + Number(key.slice(4, 6));
    let g = groups.get(ym);
    if (!g) groups.set(ym, (g = []));
    g.push(daily.get(key) ?? null);
  }
  return groups;
}

export type MonthlyHow = 'mean' | 'sum' | 'gt' | 'lt';

/**
 * year-month -> mean, sum (scaled to the full month), or count of days above (`gt`) or below
 * (`lt`) `limit`, scaled to the full month. Too many missing days -> `null`.
 */
export function monthlyStat(daily: Daily, how: MonthlyHow, limit = 0): YearMonthly {
  const out: YearMonthly = new Map();
  for (const [ym, values] of byYearMonth(daily)) {
    const y = Math.floor(ym / 100);
    const days = daysIn(y, ym % 100);
    const ok = values.filter((v): v is number => v !== null);
    if (values.length < days || (days - ok.length) / days > MAX_MISSING_SHARE) {
      out.set(ym, null);
    } else if (how === 'mean') {
      out.set(ym, sum(ok) / ok.length);
    } else if (how === 'sum') {
      out.set(ym, (sum(ok) * days) / ok.length);
    } else {
      const n = ok.filter((v) => (how === 'gt' ? v > limit : v < limit)).length;
      out.set(ym, (n * days) / ok.length);
    }
  }
  return out;
}

function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Linear-interpolated percentile (p in 0..1), the same rule as power.ts and aggregate.py. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function mean(values: readonly number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

/** Reduce the values of each calendar month across years -> 12 values (index 0 = January). */
export function perCalendarMonth(monthly: YearMonthly, reduce: (v: number[]) => number | null): MonthlySeries {
  return Array.from({ length: 12 }, (_, i) => {
    const vals: number[] = [];
    for (const [ym, v] of monthly) if (ym % 100 === i + 1 && v !== null) vals.push(v);
    return reduce(vals);
  });
}

/** year -> sum or mean over the 12 months; years with any missing month are left out. */
export function annual(monthly: YearMonthly, how: 'sum' | 'mean'): Map<number, number> {
  const years = new Map<number, (number | null)[]>();
  for (const [ym, v] of monthly) {
    const y = Math.floor(ym / 100);
    let g = years.get(y);
    if (!g) years.set(y, (g = []));
    g.push(v);
  }
  const out = new Map<number, number>();
  for (const [y, vals] of years) {
    if (vals.length === 12 && vals.every((v) => v !== null)) {
      const s = sum(vals as number[]);
      out.set(y, how === 'sum' ? s : s / 12);
    }
  }
  return out;
}

/** Sen's slope: the median of all pairwise slopes. `null` with fewer than 2 points. */
export function senSlope(xs: readonly number[], ys: readonly number[]): number | null {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  return percentile(slopes, 0.5);
}

/**
 * Complementary error function, Numerical Recipes in C (2nd ed., 1992) §6.2 `erfcc`
 * (Chebyshev fit, fractional error below 1.2e-7 everywhere). Python uses `math.erfc`;
 * the p-values are kept to 4 decimals, far above this error.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/**
 * Two-sided p-value of the Mann-Kendall trend test (normal approximation, tie-corrected).
 * Needs at least 10 values for the approximation, otherwise `null`.
 */
export function mannKendallP(ys: readonly number[]): number | null {
  const n = ys.length;
  if (n < 10) return null;
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += Math.sign(ys[j] - ys[i]);
  const counts = new Map<number, number>();
  for (const y of ys) counts.set(y, (counts.get(y) ?? 0) + 1);
  let ties = 0;
  for (const t of counts.values()) ties += t * (t - 1) * (2 * t + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - ties) / 18;
  if (variance <= 0) return null;
  const z = s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(variance);
  return erfc(Math.abs(z) / Math.SQRT2);
}

/** [Sen's slope per decade, Mann-Kendall p-value] for a year -> value series. */
export function trendPerDecade(byYear: Map<number, number>): [number | null, number | null] {
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const ys = years.map((y) => byYear.get(y) as number);
  const slope = senSlope(years, ys);
  return [slope === null ? null : slope * 10, mannKendallP(ys)];
}

// ---------------------------------------------------------------------------
// Extremes and trends for one lot
// ---------------------------------------------------------------------------

/** Round like the demo pipeline's `round(v, digits)`. */
function rnd(v: number, digits: number): number {
  return Number(v.toFixed(digits));
}

function rndSeries(s: MonthlySeries, digits = 2): MonthlySeries {
  return s.map((v) => (v === null ? null : rnd(v, digits)));
}

export interface DailyExtremes {
  /** First and last year in the daily answer, e.g. "2001-2025". */
  period: string;
  heat_days_gt35: MonthlySeries;
  heavy_rain_days_gt50mm: MonthlySeries;
  frost_days_lt0: MonthlySeries;
  trends: LotTrends;
}

/**
 * Days per month and trends from the daily series. `et0Mm` is the lot's 12-month ET0
 * (mm per month); it only decides the dry-season deficit, exactly as in build_demo.py.
 */
export function computeDailyExtremes(json: unknown, et0Mm: MonthlySeries): DailyExtremes {
  const d = dailySeries(json);
  const precip = monthlyStat(d.PRECTOTCORR, 'sum');
  const tmaxM = monthlyStat(d.T2M_MAX, 'mean');
  const heat = monthlyStat(d.T2M_MAX, 'gt', HEAT_DAY_TMAX_C);
  const heavy = monthlyStat(d.PRECTOTCORR, 'gt', HEAVY_RAIN_DAY_MM);
  const frost = monthlyStat(d.T2M_MIN, 'lt', FROST_DAY_TMIN_C);
  const p50 = perCalendarMonth(precip, (v) => percentile(v, 0.5));

  const years = [...new Set([...precip.keys()].map((ym) => Math.floor(ym / 100)))].sort((a, b) => a - b);

  // Dry-season deficit per year = sum over the months where the typical year's rain is below
  // ET0 of (ET0 - rain that year, if positive). Years missing one of those months are left out.
  const dryMonths: number[] = [];
  for (let m = 0; m < 12; m++) {
    const e = et0Mm[m];
    const r = p50[m];
    if (e !== null && e !== undefined && r !== null && r < e) dryMonths.push(m);
  }
  const deficits = new Map<number, number>();
  for (const y of years) {
    const vals = dryMonths.map((m) => precip.get(y * 100 + m + 1) ?? null);
    if (dryMonths.length && vals.every((v) => v !== null)) {
      let total = 0;
      dryMonths.forEach((m, i) => (total += Math.max(0, (et0Mm[m] as number) - (vals[i] as number))));
      deficits.set(y, total);
    }
  }
  const [precSlope, precP] = trendPerDecade(annual(precip, 'sum'));
  const [defSlope, defP] = trendPerDecade(deficits);
  const [tmaxSlope, tmaxP] = trendPerDecade(annual(tmaxM, 'mean'));
  const p_values: Record<string, number> = {};
  const pv: [string, number | null][] = [
    ['annual_precip_mm_per_decade', precP],
    ['dry_season_deficit_mm_per_decade', defP],
    ['tmax_c_per_decade', tmaxP],
  ];
  for (const [k, v] of pv) if (v !== null) p_values[k] = rnd(v, 4);

  const clim = (m: YearMonthly) => rndSeries(perCalendarMonth(m, mean));
  return {
    period: years.length ? `${years[0]}-${years[years.length - 1]}` : `${DAILY_START}-${DAILY_END}`,
    heat_days_gt35: clim(heat),
    heavy_rain_days_gt50mm: clim(heavy),
    frost_days_lt0: clim(frost),
    trends: {
      annual_precip_mm_per_decade: precSlope === null ? null : rnd(precSlope, 1),
      dry_season_deficit_mm_per_decade: defSlope === null ? null : rnd(defSlope, 1),
      tmax_c_per_decade: tmaxSlope === null ? null : rnd(tmaxSlope, 2),
      method: TREND_METHOD,
      p_values,
    },
  };
}

const DAILY_FIELDS = ['monthly.heat_days_gt35', 'monthly.heavy_rain_days_gt50mm', 'monthly.frost_days_lt0', 'trends'];

/** Adds the daily-based values to live lot data and marks this rounded point as done. */
export function applyDaily(data: LotData, json: unknown, retrieved: string): LotData {
  const x = computeDailyExtremes(json, data.monthly.et0_mm);
  const prov = (field: string, source: string, note: string): Provenance => ({
    field,
    source,
    native_res: NATIVE_RES,
    period: x.period,
    retrieved,
    note,
  });
  return {
    ...data,
    daily_point: [data.lat, data.lon],
    monthly: {
      ...data.monthly,
      heat_days_gt35: x.heat_days_gt35,
      heavy_rain_days_gt50mm: x.heavy_rain_days_gt50mm,
      frost_days_lt0: x.frost_days_lt0,
    },
    trends: x.trends,
    provenance: [
      ...data.provenance.filter((p) => !DAILY_FIELDS.includes(p.field)),
      prov('monthly.heat_days_gt35', 'NASA POWER daily T2M_MAX', 'mean days per month above 35 °C'),
      prov('monthly.heavy_rain_days_gt50mm', 'NASA POWER daily PRECTOTCORR', 'mean days per month above 50 mm'),
      prov(
        'monthly.frost_days_lt0',
        'NASA POWER daily T2M_MIN',
        'mean days per month with a daily minimum air temperature (2 m) below 0 °C; ETCCDI frost-day index FD',
      ),
      prov(
        'trends',
        'NASA POWER daily',
        `${TREND_METHOD}; per decade; dry-season deficit = ET0 minus rain in the months where the typical year is short of rain; ET0 from this lot's NASA POWER monthly data`,
      ),
    ],
  };
}

/**
 * Marks the point as tried without values, after an answer that will not get better by asking
 * again (bad response, 4xx). The card then keeps saying the values are not loaded.
 */
export function markDailyTried(data: LotData): LotData {
  return { ...data, daily_point: [data.lat, data.lon] };
}

/** True when stored live data has no daily answer for its rounded point yet. */
export function needsDaily(data: LotData): boolean {
  const p = data.daily_point;
  return !p || p[0] !== data.lat || p[1] !== data.lon;
}
