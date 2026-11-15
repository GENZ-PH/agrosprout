// QA rules and per-calendar-month statistics for AppEEARS point results, ported line by line from
// pipeline/fetch_appeears.py (modis_samples, hls_samples, eco_samples, climatology, build_*) and
// pipeline/aggregate.py (percentile). Output shapes are supersets of NdviFile and EcostressFile in
// mobile/src/data/satellite.ts. Pure functions, no network.
import type { CsvRow } from "./csv";

export const API = "https://appeears.earthdatacloud.nasa.gov/api";

/** pipeline/fetch_appeears.py LOW_NDVI: "a simple threshold for 'little green cover'". */
export const LOW_NDVI = 0.4;

/** pipeline/fetch_appeears.py LAYERS (product ids and layer names read from AppEEARS /product on 2026-11-14). */
export const LAYERS: ReadonlyArray<readonly [string, string]> = [
  ["MOD13Q1.061", "_250m_16_days_NDVI"],
  ["MOD13Q1.061", "_250m_16_days_pixel_reliability"],
  ["MOD13Q1.061", "_250m_16_days_composite_day_of_the_year"],
  ["HLSL30_VI.020", "NDVI"],
  ["HLSS30_VI.020", "NDVI"],
  // The VI products carry no Fmask layer in AppEEARS, so Fmask comes from the reflectance products.
  ["HLSL30.020", "Fmask"],
  ["HLSS30.020", "Fmask"],
  ["ECO_L4T_ESI.002", "ESI"],
  ["ECO_L4T_ESI.002", "cloud"],
  ["ECO_L4T_ESI.002", "water"],
  ["ECO_L3T_JET.002", "ETdaily"],
  ["ECO_L3T_JET.002", "cloud"],
  ["ECO_L3T_JET.002", "water"],
];

/** HLS v2.0 Fmask bits (HLS v2.0 User Guide, Table 9): 1 cloud, 2 adjacent to cloud/shadow, 3 cloud shadow, 4 snow/ice. Water (5) is kept. */
const FMASK_DROP_BITS = [1, 2, 3, 4];
/** MOD13Q1 and HLS VI scale factor 0.0001 (AppEEARS /product/<id>, read 2026-11-14 by the pipeline). */
const VI_SCALE = 1e-4;

// ---------------------------------------------------------------- task period

/**
 * Live tasks ask for a shorter window than the pipeline (2001-01-01 to 2026-10-31) so they finish in
 * minutes: 1 January five years back to the last day of the previous month (UTC). MODIS is clipped
 * to whole calendar years inside it, as the pipeline does (2001-2025 there).
 */
export function taskPeriod(now: Date): { startDate: string; endDate: string; modisStartYear: number; modisEndYear: number } {
  const y = now.getUTCFullYear();
  const lastOfPrevMonth = new Date(Date.UTC(y, now.getUTCMonth(), 0));
  const mm = String(lastOfPrevMonth.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(lastOfPrevMonth.getUTCDate()).padStart(2, "0");
  // AppEEARS wants MM-DD-YYYY.
  return { startDate: `01-01-${y - 5}`, endDate: `${mm}-${dd}-${lastOfPrevMonth.getUTCFullYear()}`, modisStartYear: y - 5, modisEndYear: y - 1 };
}

// ---------------------------------------------------------------- parsing helpers

/** The value of the first column whose name ends with `suffix` (AppEEARS prefixes product_version_). */
function col(row: CsvRow, suffix: string): string | undefined {
  for (const k of Object.keys(row)) if (k && k.endsWith(suffix)) return row[k];
  return undefined;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const x = Number(v.trim().toLowerCase() === "nan" ? NaN : v);
  return Number.isFinite(x) ? x : null;
}

/** Point CSVs normally hold scaled values; if a raw integer slips through, apply the scale. */
function scaled(v: number | null, scale: number, limit = 1.5): number | null {
  if (v === null) return null;
  return Math.abs(v) > limit ? v * scale : v;
}

type Day = { y: number; m: number; d: number };
type Sample = { day: Day; v: number };

function isoDay(s: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
const dayKey = (d: Day) => `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
const toUtc = (d: Day) => Date.UTC(d.y, d.m - 1, d.d);
function fromUtc(ms: number): Day {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
const yday = (d: Day) => Math.round((toUtc(d) - Date.UTC(d.y, 0, 1)) / 86_400_000) + 1;

// ---------------------------------------------------------------- QA (pipeline rules)

/** MODIS: keep only pixel_reliability == 0 and NDVI in -0.2..1; month = composite day of the year. */
export function modisSamples(rows: CsvRow[], startYear: number, endYear: number): { kept: Sample[]; total: number } {
  const kept: Sample[] = [];
  let total = 0;
  for (const r of rows) {
    const start = isoDay(r["Date"] ?? "");
    if (!start || start.y < startYear || start.y > endYear) continue;
    total++;
    const ndvi = scaled(num(col(r, "_250m_16_days_NDVI")), VI_SCALE);
    const rel = num(col(r, "_250m_16_days_pixel_reliability"));
    const doy = num(col(r, "_250m_16_days_composite_day_of_the_year"));
    if (ndvi === null || rel !== 0 || !(ndvi >= -0.2 && ndvi <= 1.0)) continue;
    let day = start;
    if (doy !== null && doy >= 1 && doy <= 366) {
      // the composite window can cross a year end: a DOY smaller than the start DOY is next year
      const y = start.y + (doy < yday(start) ? 1 : 0);
      day = fromUtc(Date.UTC(y, 0, 1) + (Math.trunc(doy) - 1) * 86_400_000);
    }
    if (day.y >= startYear && day.y <= endYear) kept.push({ day, v: ndvi });
  }
  return { kept, total };
}

function fmaskOk(v: number | null | undefined): boolean {
  if (v === null || v === undefined || v < 0 || v > 255) return false;
  const m = Math.trunc(v);
  return !FMASK_DROP_BITS.some((b) => (m >> b) & 1);
}

/** HLS: join a VI CSV with its reflectance CSV (Fmask) on Date; keep clear observations with NDVI in -1..1. */
export function hlsSamples(viRows: CsvRow[], fmaskRows: CsvRow[]): { kept: Sample[]; total: number } {
  const fm = new Map<string, number | null>();
  for (const r of fmaskRows) fm.set((r["Date"] ?? "").slice(0, 10), num(col(r, "_Fmask")));
  const kept: Sample[] = [];
  let total = 0;
  for (const r of viRows) {
    const d = (r["Date"] ?? "").slice(0, 10);
    const ndvi = scaled(num(col(r, "_NDVI")), VI_SCALE);
    if (ndvi === null) continue;
    total++;
    const day = isoDay(d);
    if (!day || !fmaskOk(fm.get(d)) || !(ndvi >= -1.0 && ndvi <= 1.0)) continue;
    kept.push({ day, v: ndvi });
  }
  return { kept, total };
}

/** ECOSTRESS: keep a value only if cloud == 0, water == 0 and lo <= value <= hi. */
export function ecoSamples(rows: CsvRow[], layer: string, lo: number, hi: number): { kept: Sample[]; total: number } {
  const kept: Sample[] = [];
  let total = 0;
  for (const r of rows) {
    const v = num(col(r, "_" + layer));
    if (v === null) continue;
    total++;
    const day = isoDay(r["Date"] ?? "");
    if (!day || num(col(r, "_cloud")) !== 0 || num(col(r, "_water")) !== 0 || !(v >= lo && v <= hi)) continue;
    kept.push({ day, v });
  }
  return { kept, total };
}

// ---------------------------------------------------------------- statistics

/** Linear-interpolated percentile (p in 0..1), pipeline/aggregate.py percentile(). */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export type MonthPct = { month: number; p20: number | null; p50: number | null; p80: number | null; n_years: number; n_samples: number };

/** Mean per year-month, then p20/p50/p80 across years per calendar month. */
export function climatology(samples: Sample[], digits = 3): MonthPct[] {
  const by = new Map<string, { m: number; sum: number; n: number }>();
  for (const { day, v } of samples) {
    const k = `${day.y}-${day.m}`;
    const e = by.get(k) ?? { m: day.m, sum: 0, n: 0 };
    e.sum += v;
    e.n++;
    by.set(k, e);
  }
  const r = (v: number | null) => (v === null ? null : Number(v.toFixed(digits)));
  const out: MonthPct[] = [];
  for (let m = 1; m <= 12; m++) {
    const es = [...by.values()].filter((e) => e.m === m);
    const vals = es.map((e) => e.sum / e.n);
    out.push({
      month: m,
      p20: r(percentile(vals, 0.2)),
      p50: r(percentile(vals, 0.5)),
      p80: r(percentile(vals, 0.8)),
      n_years: vals.length,
      n_samples: es.reduce((a, e) => a + e.n, 0),
    });
  }
  return out;
}

const lowMonths = (monthly: MonthPct[]) => monthly.filter((e) => e.p50 !== null && e.p50 < LOW_NDVI).map((e) => e.month);

function covered(samples: Sample[]): string | null {
  if (samples.length === 0) return null;
  const ds = samples.map((s) => dayKey(s.day)).sort();
  return `${ds[0]} to ${ds[ds.length - 1]}`;
}

// ---------------------------------------------------------------- outputs

export type Provenance = {
  source: string;
  doi: string | string[];
  native_res: string;
  period: string | null;
  access: string;
  retrieved: string;
  note?: string;
};

export type Point = { lat: number; lon: number };

/** Superset of NdviFile (mobile/src/data/satellite.ts). */
export interface LiveNdviFile {
  id: string;
  product: string;
  version: string;
  native_res: string;
  period: string;
  point: Point;
  units: string;
  sampling: {
    valid_samples: number;
    composites_seen?: number;
    per_product?: Record<string, { observations_seen: number; valid_samples: number; period: string | null }>;
    qa_rule: string;
    month_rule?: string;
    statistic: string;
  };
  monthly: MonthPct[];
  low_ndvi_months: number[];
  low_ndvi_rule: string;
  provenance: Provenance;
}

export type EcoSeries = { units: string; period: string; observations_seen: number; valid_samples: number; monthly: MonthPct[] };

/** Superset of EcostressFile (mobile/src/data/satellite.ts). */
export interface LiveEcostressFile {
  id: string;
  product: string;
  version: string;
  native_res: string;
  point: Point;
  qa_rule: string;
  statistic: string;
  esi: EcoSeries;
  et_daily: EcoSeries;
  provenance: Provenance[];
  caveats: string[];
}

type Ctx = { id: string; point: Point; taskId: string; today: string };

const LOW_RULE = `calendar months whose p50 NDVI is below ${LOW_NDVI}. A simple threshold for 'little green cover' (bare, flooded or just planted), not a crop calendar`;
const STAT = "mean of the valid samples in each year-month, then p20, p50, p80 across years per calendar month (linear-interpolated percentiles)";

export function buildNdvi(rows: CsvRow[], modisYears: [number, number], x: Ctx): LiveNdviFile | null {
  const { kept, total } = modisSamples(rows, modisYears[0], modisYears[1]);
  const period = covered(kept);
  if (period === null) return null;
  const monthly = climatology(kept);
  return {
    id: x.id,
    product: "MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid (MOD13Q1)",
    version: "Collection 6.1 (061)",
    native_res: "250 m pixel, 16-day composite",
    period,
    point: x.point,
    units: "NDVI (unitless, -0.2..1)",
    sampling: {
      composites_seen: total,
      valid_samples: kept.length,
      qa_rule:
        "keep a composite only if _250m_16_days_pixel_reliability == 0 (good data); marginal (1), snow/ice (2), cloudy (3) and fill (-1) are dropped",
      month_rule: "each composite is assigned to the month of its composite day of the year (the pixel's own acquisition day)",
      statistic: STAT,
    },
    monthly,
    low_ndvi_months: lowMonths(monthly),
    low_ndvi_rule: LOW_RULE,
    provenance: {
      source: "NASA LP DAAC MOD13Q1 v061 (_250m_16_days_NDVI, _250m_16_days_pixel_reliability, _250m_16_days_composite_day_of_the_year)",
      doi: "10.5067/MODIS/MOD13Q1.061",
      native_res: "250 m, 16-day",
      period,
      access: `NASA AppEEARS point task ${x.taskId} (${API})`,
      retrieved: x.today,
      note: "A 250 m pixel mixes this lot with its neighbours; small lots may differ.",
    },
  };
}

export function buildHls(pairs: Record<string, [CsvRow[], CsvRow[]]>, x: Ctx): LiveNdviFile | null {
  const all: Sample[] = [];
  const per: Record<string, { observations_seen: number; valid_samples: number; period: string | null }> = {};
  for (const [name, [vi, fm]] of Object.entries(pairs)) {
    const { kept, total } = hlsSamples(vi, fm);
    per[name] = { observations_seen: total, valid_samples: kept.length, period: covered(kept) };
    all.push(...kept);
  }
  const period = covered(all);
  if (period === null) return null;
  const monthly = climatology(all);
  return {
    id: x.id,
    product: "Harmonized Landsat Sentinel-2 Vegetation Indices (HLSL30_VI, HLSS30_VI)",
    version: "v2.0 (020)",
    native_res: "30 m pixel, every Landsat 8/9 and Sentinel-2 overpass",
    period,
    point: x.point,
    units: "NDVI (unitless, -1..1)",
    sampling: {
      per_product: per,
      valid_samples: all.length,
      qa_rule:
        "keep an observation only if the HLS Fmask (from HLSL30.020 / HLSS30.020, joined on date) has bits 1 cloud, 2 adjacent cloud/shadow, 3 cloud shadow and 4 snow/ice all 0, and NDVI is within -1..1. Water (bit 5) is kept, since a flooded paddy is a real field state",
      statistic:
        "Landsat and Sentinel-2 samples pooled; mean per year-month, then p20, p50, p80 across years per calendar month (linear-interpolated percentiles)",
    },
    monthly,
    low_ndvi_months: lowMonths(monthly),
    low_ndvi_rule: LOW_RULE,
    provenance: {
      source: "NASA LP DAAC HLSL30_VI v2.0 and HLSS30_VI v2.0 (NDVI), Fmask from HLSL30 v2.0 and HLSS30 v2.0",
      doi: ["10.5067/HLS/HLSL30_VI.002", "10.5067/HLS/HLSS30_VI.002", "10.5067/HLS/HLSL30.002", "10.5067/HLS/HLSS30.002"],
      native_res: "30 m, irregular revisit (about 2 to 3 days combined, fewer clear days)",
      period,
      access: `NASA AppEEARS point task ${x.taskId} (${API})`,
      retrieved: x.today,
      note: "Early years have fewer overpasses (Sentinel-2 from late 2015, Landsat 9 from late 2021), so n_samples per month varies.",
    },
  };
}

/** pipeline/fetch_appeears.py build_all(): the ETdaily unit note, copied verbatim. */
const JET_UNITS =
  "mm/day, integrated from sunrise to sunset. Source: ECOSTRESS L1C-4 Grid/Tile User Guide V2, L3T JET section text ('a daily ET estimate in millimeters per day ... recorded in the L3T JET product as ETdaily'). The same guide's Table 10 and AppEEARS list W m-2; values of 1.7 to 4.6 only make sense as mm/day";

export function buildEcostress(esiRows: CsvRow[], jetRows: CsvRow[], x: Ctx): LiveEcostressFile | null {
  const esi = ecoSamples(esiRows, "ESI", 0, 1);
  const jet = ecoSamples(jetRows, "ETdaily", 0, Infinity);
  const pe = covered(esi.kept);
  const pj = covered(jet.kept);
  if (pe === null || pj === null) return null;
  const access = `NASA AppEEARS point task ${x.taskId}`;
  return {
    id: x.id,
    product: "ECOSTRESS Tiled L4 Evaporative Stress Index PT-JPL (ECO_L4T_ESI) and L3 Evapotranspiration (ECO_L3T_JET)",
    version: "002",
    native_res: "70 m pixel, irregular ISS overpass times",
    point: x.point,
    qa_rule:
      "keep a value only if the product's own cloud layer == 0, water layer == 0 and the value is finite (ESI within 0..1, ETdaily >= 0)",
    statistic: STAT,
    esi: {
      units: "ratio (0 = high stress, 1 = no stress)",
      period: pe,
      observations_seen: esi.total,
      valid_samples: esi.kept.length,
      monthly: climatology(esi.kept),
    },
    et_daily: { units: JET_UNITS, period: pj, observations_seen: jet.total, valid_samples: jet.kept.length, monthly: climatology(jet.kept, 2) },
    provenance: [
      { source: "NASA LP DAAC ECO_L4T_ESI v002 (ESI, cloud, water)", doi: "10.5067/ECOSTRESS/ECO_L4T_ESI.002", native_res: "70 m", period: pe, access, retrieved: x.today },
      { source: "NASA LP DAAC ECO_L3T_JET v002 (ETdaily, cloud, water)", doi: "10.5067/ECOSTRESS/ECO_L3T_JET.002", native_res: "70 m", period: pj, access, retrieved: x.today },
    ],
    caveats: [
      "ECOSTRESS flies on the ISS, so overpass times vary and a month can have zero, one or many clear samples.",
      "ESI and ET are snapshots on clear-sky overpasses; cloudy (often rainy) days are missing, which biases the sample toward dry, sunny days.",
    ],
  };
}

const norm = (s: string) => s.replace(/[_.]/g, "-").toUpperCase();

/** AppEEARS names point results <task-name>-<PRODUCT>-<VER>-results.csv; '_' and '.' compare as '-'. */
export function findCsv<T extends { file_name: string }>(files: T[], product: string): T | undefined {
  const want = "-" + norm(product) + "-RESULTS-CSV";
  return files
    .filter((f) => norm(f.file_name.split("/").pop() ?? "").endsWith(want))
    .sort((a, b) => a.file_name.localeCompare(b.file_name))[0];
}
