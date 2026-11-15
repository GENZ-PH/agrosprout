// SMAP L4 surface and root-zone soil moisture by calendar month for one 0.1 degree point.
// Port of pipeline/fetch_smap.py with REDUCED sampling (see SAMPLING_NOTE); constants are copied
// from the pipeline with the source it cites.
import {
  Budget, CONCURRENCY, UpstreamError, cmrGranules, getText, lastYears, mapLimited, mean, parseDapCsv, percentile,
  periodOf, roundTo, type Source,
} from "./common";

// CMR collection C3480440870-NSIDC_CPRD = SPL4SMGP Version 8 (pipeline COLLECTION).
const COLLECTION = "C3480440870-NSIDC_CPRD";
// Landing page and DOI (pipeline LANDING, DOI, read 2026-11-14).
const LANDING = "https://nsidc.org/data/spl4smgp/versions/8";
const DOI = "10.5067/T5RUATAQREF8";
// Verbatim from the "Data Citation" box on LANDING (pipeline CITATION).
const CITATION =
  "Reichle, R., De Lannoy, G., Koster, R. D., Crow, W. T., Kimball, J. S., Liu, Q. & Bechtold, M. " +
  "(2025). SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical " +
  "Data . (SPL4SMGP, Version 8). [Data Set]. Boulder, Colorado USA. NASA National Snow and Ice Data " +
  "Center Distributed Active Archive Center. https://doi.org/10.5067/T5RUATAQREF8 .";
// The 03:00-06:00 UTC average (granule centre 04:30 UTC), as in the pipeline GRANULE_TIME.
const GRANULE_TIME = "T043000";
// One sample day per month. Day 16 is one of the pipeline's SAMPLE_DAYS (1, 6, 11, 16, 21, 26).
const SAMPLE_DAY = 16;
/** Most recent 36 months: 1 CMR + 1 grid read + 36 subsets stays under the subrequest cap. */
export const SMAP_MONTHS = 36;
// Fill -9999, valid range 0..0.9 m3 m-3 (granule DMR, read 2026-11-14, pipeline FILL and VALID).
const FILL = -9999.0;
const VALID: [number, number] = [0.0, 0.9];
const VARS = ["Geophysical_Data/sm_surface", "Geophysical_Data/sm_rootzone", "cell_lat", "cell_lon"];
// EASE-Grid 2.0 global (EPSG:6933): WGS84 ellipsoid, Lambert cylindrical equal-area, standard parallel
// 30 deg (pipeline _A, _F).
const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);
// Cache key for the file's /x and /y vectors (the same for every granule of the collection).
const XY_CACHE = new Request("https://cache.agrosprout/nasa/smap/xy-v008");

const SAMPLING_NOTE =
  `Reduced sampling for the live answer: one 3-hour average (03:00-06:00 UTC, granule ${GRANULE_TIME}) on day ${SAMPLE_DAY} of each of the last ${SMAP_MONTHS} months, ` +
  "so each year-month is a single sample. The bundled pipeline file uses 6 days per month from 2015-04. Treat these values as indicative.";

type Stat = { mean: number | null; p20: number | null; p80: number | null; n: number };
export type SmapAnswer = {
  period: string;
  native_res: string;
  units: string;
  point: { lat: number; lon: number };
  grid_cell: { grid: string; row: number; col: number; cell_lat: number | null; cell_lon: number | null };
  sampling: { note: string; granule: string; day_of_month: number; granules_requested: number; valid_surface_samples: number; valid_rootzone_samples: number; failed_requests: number; statistic: string };
  monthly: { month: number; surface_m3m3: Stat; rootzone_m3m3: Stat }[];
  source: Source;
};

/** Projected (x, y) metres of a WGS84 point on EPSG:6933 (pipeline ease2_xy()). */
function ease2xy(lat: number, lon: number): [number, number] {
  const rad = Math.PI / 180;
  const p1 = 30 * rad;
  const k0 = Math.cos(p1) / Math.sqrt(1 - E2 * Math.sin(p1) ** 2);
  const s = Math.sin(lat * rad);
  const q = (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)));
  return [A * k0 * lon * rad, (A * q) / (2 * k0)];
}

const nearest = (vs: number[], t: number) => vs.reduce((best, v, i) => (Math.abs(v - t) < Math.abs(vs[best] - t) ? i : best), 0);
const clean = (v: number | null) => (v === null || v === FILL || v < VALID[0] || v > VALID[1] ? null : v);

async function gridXY(sampleUrl: string, budget: Budget, token: string, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<{ x: number[]; y: number[] }> {
  const hit = await caches.default.match(XY_CACHE);
  if (hit) return hit.json();
  const p = parseDapCsv(await getText(`${sampleUrl}.dap.csv?dap4.ce=%2Fx;%2Fy`, budget, token));
  const xy = { x: (p.x?.[0] ?? []) as number[], y: (p.y?.[0] ?? []) as number[] };
  if (!xy.x.length || !xy.y.length) throw new UpstreamError(502, "upstream_error", "SMAP grid vectors were empty");
  ctx.waitUntil(caches.default.put(XY_CACHE, new Response(JSON.stringify(xy), { headers: { "cache-control": "public, max-age=2592000" } })));
  return xy;
}

function stat(vals: number[]): Stat {
  return { mean: roundTo(mean(vals), 3), p20: roundTo(percentile(vals, 0.2), 3), p80: roundTo(percentile(vals, 0.8), 3), n: vals.length };
}

export async function smap(lat: number, lon: number, token: string, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<SmapAnswer> {
  const budget = new Budget();
  const granules = await cmrGranules(
    {
      collection_concept_id: COLLECTION,
      readable_granule_name: `SMAP_L4_SM_gph_*${String(SAMPLE_DAY).padStart(2, "0")}${GRANULE_TIME}_*`,
      "options[readable_granule_name][pattern]": "true",
      temporal: lastYears(4),
    },
    budget,
  );
  // "YYYY-MM" -> [name, url]; a reprocessed day keeps the name that sorts last (pipeline pick_granules()).
  const byMonth = new Map<string, [string, string]>();
  for (const [name, url] of granules) {
    const stamp = name.split("_gph_", 2)[1]?.slice(0, 8);
    if (!stamp || Number(stamp.slice(6, 8)) !== SAMPLE_DAY) continue;
    const key = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}`;
    const prev = byMonth.get(key);
    if (!prev || name > prev[0]) byMonth.set(key, [name, url]);
  }
  const keys = [...byMonth.keys()].sort().slice(-SMAP_MONTHS);
  if (!keys.length) throw new UpstreamError(502, "no_granules", "NASA CMR listed no SMAP L4 files");

  const { x, y } = await gridXY(byMonth.get(keys[keys.length - 1])![1], budget, token, ctx);
  const [px, py] = ease2xy(lat, lon);
  const row = nearest(y, py);
  const col = nearest(x, px);
  if (row < 1 || col < 1 || row > y.length - 2 || col > x.length - 2) throw new UpstreamError(422, "out_of_coverage", "The point is at the edge of the SMAP grid");
  // A 1 x 1 slice came back empty (pipeline, 2026-11-14), so ask for 3 x 3 and read the centre.
  const sl = `%5B${row - 1}:1:${row + 1}%5D%5B${col - 1}:1:${col + 1}%5D`;
  const ce = VARS.map((v) => `%2F${encodeURIComponent(v)}${sl}`).join(";");

  const results = await mapLimited(keys, CONCURRENCY, async (key) => {
    const p = parseDapCsv(await getText(`${byMonth.get(key)![1]}.dap.csv?dap4.ce=${ce}`, budget, token));
    const c = (name: string) => {
      const rows = p[name];
      return rows && rows.length === 3 && rows[1].length === 3 ? rows[1][1] : null;
    };
    return { surface: clean(c("Geophysical_Data/sm_surface")), rootzone: clean(c("Geophysical_Data/sm_rootzone")), cell_lat: c("cell_lat"), cell_lon: c("cell_lon") };
  }, budget);
  const failed = results.filter((r) => r instanceof UpstreamError).length;
  if (failed > keys.length / 2) throw results.find((r) => r instanceof UpstreamError) as UpstreamError;

  const surf = new Map<string, number>();
  const root = new Map<string, number>();
  let cell: [number, number] | null = null;
  keys.forEach((k, i) => {
    const r = results[i];
    if (r instanceof UpstreamError) return;
    if (r.surface !== null) surf.set(k, r.surface);
    if (r.rootzone !== null) root.set(k, r.rootzone);
    if (!cell && r.cell_lat !== null && r.cell_lon !== null) cell = [r.cell_lat, r.cell_lon];
  });
  const byCal = (s: Map<string, number>, m: number) => [...s].filter(([k]) => Number(k.slice(5)) === m).map(([, v]) => v);
  const c = cell as [number, number] | null;
  return {
    period: periodOf([...new Set([...surf.keys(), ...root.keys()])]),
    native_res: "9 km EASE-Grid 2.0 Global (EPSG:6933) cell",
    units: "m3/m3 (volumetric water content)",
    point: { lat, lon },
    grid_cell: {
      grid: "EASE-Grid 2.0 Global 9 km",
      row,
      col,
      cell_lat: c ? roundTo(c[0], 5) : null,
      cell_lon: c ? roundTo(c[1], 5) : null,
    },
    sampling: {
      note: SAMPLING_NOTE,
      granule: "03:00-06:00 UTC 3-hourly average (granule centre 04:30 UTC, 12:30 Philippine time)",
      day_of_month: SAMPLE_DAY,
      granules_requested: keys.length,
      valid_surface_samples: surf.size,
      valid_rootzone_samples: root.size,
      failed_requests: failed,
      statistic: "one sample per year-month, then mean, p20, p80 across years per calendar month (linear-interpolated percentiles)",
    },
    monthly: Array.from({ length: 12 }, (_v, i) => ({ month: i + 1, surface_m3m3: stat(byCal(surf, i + 1)), rootzone_m3m3: stat(byCal(root, i + 1)) })),
    source: {
      name: "NASA NSIDC DAAC, SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture (SPL4SMGP) Version 8, variables sm_surface and sm_rootzone; Earthdata cloud OPeNDAP subset, granule list from CMR",
      doi: DOI,
      url: LANDING,
      citation: `${CITATION} Subset: cell row ${row}, col ${col} (EASE-Grid 2.0 9 km), 04:30 UTC granules on day ${SAMPLE_DAY} of each month, ${periodOf(keys)}. Date Accessed ${new Date().toISOString().slice(0, 10)}.`,
    },
  };
}
