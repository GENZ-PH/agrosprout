// GPM IMERG Final Run monthly rainfall by calendar month for one 0.1 degree point.
// Port of pipeline/fetch_imerg.py (read that file for the reasoning); every constant below is
// copied from it, with the source it cites.
import {
  Budget, CONCURRENCY, UpstreamError, cellIndices, cmrGranules, daysInMonth, getText, lastYears, mapLimited,
  parseDapCsv, percentile, periodOf, roundTo, ym, type Source,
} from "./common";

// CMR collection C2723754851-GES_DISC = GPM_3IMERGM V07 (pipeline COLLECTION).
const COLLECTION = "C2723754851-GES_DISC";
// GES DISC landing page and DOI (pipeline LANDING, DOI, read 2026-11-14).
const LANDING = "https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary";
const DOI = "10.5067/GPM/IMERG/3B-MONTH/07";
// Verbatim from the "Data Citation" tab of LANDING (pipeline CITATION, read 2026-11-14).
const CITATION =
  "Huffman, G.J.; Stocker, E.F.; Bolvin, D.T.; Nelkin, E.J.; Tan, J. (2023), GPM IMERG Final " +
  "Precipitation L3 1 month 0.1 degree x 0.1 degree V07, Greenbelt, MD, Goddard Earth Sciences " +
  "Data and Information Services Center (GES DISC), Accessed: [Data Access Date], " +
  "10.5067/GPM/IMERG/3B-MONTH/07";
// Grid: cell centres -179.95 + 0.1 i (lon, 3600) and -89.95 + 0.1 j (lat, 1800), [time][lon][lat] (pipeline).
const RES = 0.1;
const N_LON = 3600;
const N_LAT = 1800;
const LON0 = -179.95;
const LAT0 = -89.95;
// `precipitation` fill value -9999.9 (granule DAS, read 2026-11-14, pipeline FILL).
const FILL = -9999.9;
/**
 * The most recent 36 monthly granules: 3 years for every calendar month, so one call stays under the
 * Workers subrequest cap (1 CMR search + 36 subsets). The pipeline uses 2001-2025 offline.
 */
export const IMERG_MONTHS = 36;

export type ImergMonth = { month: number; p20_mm: number | null; p50_mm: number | null; p80_mm: number | null; n_years: number };
export type ImergAnswer = {
  period: string;
  native_res: string;
  units: string;
  point: { lat: number; lon: number };
  grid_cell: { rule: string; lon_index: number[]; lat_index: number[] };
  monthly: ImergMonth[];
  months_used: number;
  months_failed: number;
  source: Source;
};

/** 3IMERGM `precipitation` is an average rate over the calendar month (mm/hr) -> mm per month (pipeline rate_to_month_total()). */
const monthTotal = (rate: number, y: number, m: number) => rate * 24 * daysInMonth(y, m);

/** DAP4 constraint, same encoding as pipeline constraint(). */
function constraint(ilon: number[], jlat: number[]): string {
  const lo = `%5B${ilon[0]}:1:${ilon[ilon.length - 1]}%5D`;
  const la = `%5B${jlat[0]}:1:${jlat[jlat.length - 1]}%5D`;
  return `%2FGrid%2Fprecipitation%5B0%5D${lo}${la};%2FGrid%2Flon${lo};%2FGrid%2Flat${la}`;
}

export async function imerg(lat: number, lon: number, token: string): Promise<ImergAnswer> {
  const budget = new Budget();
  // Five years back is enough to find the latest 36 published months (CMR listed up to 2025-09 on 2026-11-15).
  const granules = await cmrGranules({ collection_concept_id: COLLECTION, temporal: lastYears(5) }, budget);
  // (year, month) -> URL, keeping the name that sorts last when a month has two (pipeline pick_granules()).
  const byMonth = new Map<string, [string, string]>();
  for (const [name, url] of granules) {
    const stamp = name.split("3IMERG.", 2)[1]?.slice(0, 8);
    if (!stamp) continue;
    const key = ym(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)));
    const prev = byMonth.get(key);
    if (!prev || name > prev[0]) byMonth.set(key, [name, url]);
  }
  const keys = [...byMonth.keys()].sort().slice(-IMERG_MONTHS);
  if (!keys.length) throw new UpstreamError(502, "no_granules", "NASA CMR listed no IMERG monthly files");

  const ilon = cellIndices(lon, LON0, N_LON, RES);
  const jlat = cellIndices(lat, LAT0, N_LAT, RES);
  const ce = constraint(ilon, jlat);
  const results = await mapLimited(keys, CONCURRENCY, async (key) => {
    const text = await getText(`${byMonth.get(key)![1]}.dap.csv?dap4.ce=${ce}`, budget, token);
    const parsed = parseDapCsv(text);
    const rows = parsed["Grid/precipitation"] ?? parsed["precipitation"] ?? [];
    // Flatten [time=0][lon][lat]; fill or negative -> null (pipeline cell_rates()).
    return rows.flat().map((v) => (v === null || v <= FILL + 0.01 || v < 0 ? null : v));
  }, budget);
  const failed = results.filter((r) => r instanceof UpstreamError);
  if (failed.length > keys.length / 2) throw failed[0] as UpstreamError;

  // Each month is the mean of the cells the point touches; a month with a missing cell is left out.
  const totals = new Map<string, number>();
  keys.forEach((key, i) => {
    const rates = results[i];
    if (rates instanceof UpstreamError || !rates.length || rates.some((r) => r === null)) return;
    const vs = rates as number[];
    const [y, m] = key.split("-").map(Number);
    totals.set(key, monthTotal(vs.reduce((a, b) => a + b, 0) / vs.length, y, m));
  });

  const monthly: ImergMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const vals = [...totals].filter(([k]) => Number(k.slice(5)) === m).map(([, v]) => v);
    monthly.push({
      month: m,
      p20_mm: roundTo(percentile(vals, 0.2), 1),
      p50_mm: roundTo(percentile(vals, 0.5), 1),
      p80_mm: roundTo(percentile(vals, 0.8), 1),
      n_years: vals.length,
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    period: periodOf([...totals.keys()]),
    native_res: "0.1 x 0.1 degree grid cell (about 11 x 11 km here)",
    units: "mm per month (file: mm/hr average rate over the calendar month, x 24 x days in month)",
    point: { lat, lon },
    grid_cell: {
      rule: ilon.length * jlat.length > 1 ? "the point lies on a cell edge or corner, so each month is the mean of the cells it touches" : "the cell that contains the point",
      lon_index: ilon,
      lat_index: jlat,
    },
    monthly,
    months_used: totals.size,
    months_failed: failed.length,
    source: {
      name: "NASA GES DISC, GPM IMERG Final Precipitation L3 1 month 0.1 degree V07 (GPM_3IMERGM), variable Grid/precipitation; Earthdata cloud OPeNDAP subset, granule list from CMR",
      doi: DOI,
      url: LANDING,
      citation: CITATION.replace("[Data Access Date]", today),
    },
  };
}
