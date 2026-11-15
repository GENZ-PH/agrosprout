// NASA FLDAS Noah monthly soil moisture, evapotranspiration, rainfall and runoff for one 0.1 degree
// point. Port of pipeline/fetch_fldas.py; every constant is copied from it, with the source it cites.
import {
  Budget, CONCURRENCY, UpstreamError, cellIndices, cmrGranules, daysInMonth, getText, lastYears, mapLimited,
  monthPct, parseDapCsv, periodOf, ym, type MonthPct, type Source,
} from "./common";

// CMR collection C1563089663-GES_DISC = FLDAS_NOAH01_C_GL_M v001 (pipeline COLLECTION).
const COLLECTION = "C1563089663-GES_DISC";
// Landing page and DOI (pipeline LANDING, DOI).
const LANDING = "https://disc.gsfc.nasa.gov/datacollection/FLDAS_NOAH01_C_GL_M_001.html";
const DOI = "10.5067/5NHC22T9375G";
// Citation format from README_FLDAS.pdf section 1.2.3, last revised 12 June 2026 (pipeline CITATION).
const CITATION =
  "Amy McNally, NASA/GSFC/HSL (2018), FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 " +
  "degree (MERRA-2 and CHIRPS), Greenbelt, MD, USA, Goddard Earth Sciences Data and Information " +
  "Services Center (GES DISC), Accessed [Data Access Date], 10.5067/5NHC22T9375G";
// Grid: centres X = -179.95 + 0.1 i (3600), Y = -59.95 + 0.1 j (1500), variables [time][Y][X] (pipeline).
const RES = 0.1;
const N_X = 3600;
const N_Y = 1500;
const X0 = -179.95;
const Y0 = -59.95;
// Domain 60S to 90N (CMR, read 2026-11-14, pipeline docstring); Y index 1500 covers up to 90N.
export const FLDAS_MIN_LAT = -60;
// Fill value -9999 (masked water or no data), pipeline FILL.
const FILL = -9999.0;
// Extra cells on each side of the touching cells: 4 x 4 block for a corner point (pipeline BLOCK).
const BLOCK = 1;
/** Most recent 36 monthly granules (3 years per calendar month) to stay under the subrequest cap. */
export const FLDAS_MONTHS = 36;

// file variable -> [output key, kind]. "flux": kg m-2 s-1 -> mm/month; "sm": m3/m3 as is (pipeline VARIABLES,
// names and units from the file's DMR and README Table 5a, read 2026-11-14).
const VARIABLES: Record<string, [string, "flux" | "sm"]> = {
  SoilMoi00_10cm_tavg: ["soil_moisture_0_10cm_m3m3", "sm"],
  SoilMoi10_40cm_tavg: ["soil_moisture_10_40cm_m3m3", "sm"],
  Evap_tavg: ["evapotranspiration_mm", "flux"],
  Rainf_f_tavg: ["rainfall_mm", "flux"],
  Qs_tavg: ["surface_runoff_mm", "flux"],
  Qsb_tavg: ["subsurface_runoff_mm", "flux"],
};
const RAIN = "Rainf_f_tavg";

export type FldasAnswer = {
  period: string;
  native_res: string;
  point: { lat: number; lon: number };
  grid_cell: { rule: string; cells_used: { lat: number; lon: number }[] };
  units: Record<string, string>;
  monthly: {
    soil_moisture_0_10cm_m3m3: MonthPct[];
    soil_moisture_10_40cm_m3m3: MonthPct[];
    evapotranspiration_mm: MonthPct[];
    rainfall_mm: MonthPct[];
    surface_runoff_mm: MonthPct[];
    subsurface_runoff_mm: MonthPct[];
    total_runoff_mm: MonthPct[];
  };
  months_used: number;
  months_failed: number;
  source: Source;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
/** "_tavg" monthly mean flux: 1 kg m-2 = 1 mm of water, so kg m-2 s-1 x 86400 x days -> mm per month (pipeline). */
const fluxToMonth = (rate: number, y: number, m: number) => rate * 86400 * daysInMonth(y, m);

type Block = { X: number[]; Y: number[]; vars: Record<string, Map<string, number | null>> };
const cellKey = (y: number, x: number) => `${y},${x}`;

function parseBlock(text: string): Block {
  const p = parseDapCsv(text);
  const X = (p.X?.[0] ?? []).map((v) => r2(v ?? NaN));
  const Y = (p.Y?.[0] ?? []).map((v) => r2(v ?? NaN));
  const vars: Block["vars"] = {};
  for (const v of Object.keys(VARIABLES)) {
    const grid = new Map<string, number | null>();
    (p[v] ?? []).forEach((row, j) => row.forEach((val, i) => grid.set(cellKey(Y[j], X[i]), val === null || val <= FILL + 0.5 ? null : val)));
    vars[v] = grid;
  }
  return { X, Y, vars };
}

/** Values in every month for every variable, and the rainfall forcing is not zero in every month (pipeline usable_cell()). */
function usable(cell: string, months: Block[]): boolean {
  let rain = 0;
  for (const b of months) {
    for (const v of Object.keys(VARIABLES)) if (b.vars[v].get(cell) == null) return false;
    rain += b.vars[RAIN].get(cell) as number;
  }
  return rain > 0;
}

export async function fldas(lat: number, lon: number, token: string): Promise<FldasAnswer> {
  if (lat < FLDAS_MIN_LAT) throw new UpstreamError(422, "out_of_coverage", "FLDAS global monthly covers 60S to 90N only");
  const budget = new Budget();
  const granules = await cmrGranules({ collection_concept_id: COLLECTION, temporal: lastYears(5) }, budget);
  // FLDAS_NOAH01_C_GL_M.001:FLDAS_NOAH01_C_GL_M.A200101.001.nc -> "2001-01" (pipeline pick_granules()).
  const byMonth = new Map<string, string>();
  for (const [name, url] of granules) {
    const stamp = name.split(".A").pop()?.slice(0, 6);
    if (stamp && /^\d{6}$/.test(stamp)) byMonth.set(ym(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6))), url);
  }
  const keys = [...byMonth.keys()].sort().slice(-FLDAS_MONTHS);
  if (!keys.length) throw new UpstreamError(502, "no_granules", "NASA CMR listed no FLDAS monthly files");

  const xi = cellIndices(lon, X0, N_X, RES);
  const yi = cellIndices(lat, Y0, N_Y, RES);
  const xs: [number, number] = [Math.max(0, xi[0] - BLOCK), Math.min(N_X - 1, xi[xi.length - 1] + BLOCK)];
  const ys: [number, number] = [Math.max(0, yi[0] - BLOCK), Math.min(N_Y - 1, yi[yi.length - 1] + BLOCK)];
  const y = `%5B${ys[0]}:1:${ys[1]}%5D`;
  const x = `%5B${xs[0]}:1:${xs[1]}%5D`;
  const ce = [...Object.keys(VARIABLES).map((v) => `%2F${v}%5B0%5D${y}${x}`), `%2FX${x}`, `%2FY${y}`].join(";");

  const results = await mapLimited(keys, CONCURRENCY, async (key) => parseBlock(await getText(`${byMonth.get(key)}.dap.csv?dap4.ce=${ce}`, budget, token)), budget);
  const okKeys = keys.filter((_k, i) => !(results[i] instanceof UpstreamError));
  const blocks = results.filter((r): r is Block => !(r instanceof UpstreamError));
  const failed = keys.length - blocks.length;
  if (failed > keys.length / 2) throw results.find((r) => r instanceof UpstreamError) as UpstreamError;

  // Cell choice (pipeline choose_cells()): touching cells that are usable, else the nearest usable cell in the block.
  const touching = yi.flatMap((j) => xi.map((i) => cellKey(r2(Y0 + RES * j), r2(X0 + RES * i))));
  let cells = touching.filter((c) => usable(c, blocks));
  let rule = "mean of the cells that touch the point and have usable values in every month";
  if (!cells.length && blocks.length) {
    const cands = blocks[0].Y.flatMap((yy) => blocks[0].X.map((xx) => cellKey(yy, xx))).filter((c) => usable(c, blocks));
    const dist = (c: string) => {
      const [cy, cx] = c.split(",").map(Number);
      return Math.hypot(cy - lat, cx - lon);
    };
    cands.sort((a, b) => dist(a) - dist(b));
    cells = cands.slice(0, 1);
    rule = cells.length ? "no touching cell was usable, so the nearest usable cell in the block" : "no usable cell in the block";
  }
  if (!cells.length) throw new UpstreamError(422, "no_data", "FLDAS has no land values around this point (water or outside the model mask)");

  // {output key: {"YYYY-MM": value}} from the mean of the chosen cells (pipeline monthly_values()).
  const series: Record<string, Map<string, number>> = {};
  for (const [key] of Object.values(VARIABLES)) series[key] = new Map();
  okKeys.forEach((k, idx) => {
    const [yy, mm] = k.split("-").map(Number);
    for (const [v, [key, kind]] of Object.entries(VARIABLES)) {
      const vals = cells.map((c) => blocks[idx].vars[v].get(c));
      if (vals.some((q) => q == null)) continue;
      const avg = (vals as number[]).reduce((a, b) => a + b, 0) / vals.length;
      series[key].set(k, kind === "flux" ? fluxToMonth(avg, yy, mm) : avg);
    }
  });
  const total = new Map<string, number>();
  for (const [k, s] of series.surface_runoff_mm) {
    const sub = series.subsurface_runoff_mm.get(k);
    if (sub !== undefined) total.set(k, s + sub);
  }
  series.total_runoff_mm = total;
  const pct = (key: string) => monthPct(series[key], key.endsWith("m3m3") ? 3 : 1);
  const today = new Date().toISOString().slice(0, 10);
  const flux = "mm per month (file: kg m-2 s-1 monthly mean, x 86400 x days in month)";
  return {
    period: periodOf([...series.rainfall_mm.keys()]),
    native_res: "0.1 x 0.1 degree grid cell (about 11 x 11 km here), monthly",
    point: { lat, lon },
    grid_cell: { rule, cells_used: cells.map((c) => ({ lat: Number(c.split(",")[0]), lon: Number(c.split(",")[1]) })) },
    units: {
      soil_moisture_0_10cm_m3m3: "m3/m3 (SoilMoi00_10cm_tavg)",
      soil_moisture_10_40cm_m3m3: "m3/m3 (SoilMoi10_40cm_tavg)",
      evapotranspiration_mm: `${flux} (Evap_tavg)`,
      rainfall_mm: `${flux} (Rainf_f_tavg, CHIRPS forcing)`,
      surface_runoff_mm: `${flux} (Qs_tavg)`,
      subsurface_runoff_mm: `${flux} (Qsb_tavg)`,
      total_runoff_mm: "mm per month (Qs_tavg + Qsb_tavg, same year and month)",
    },
    monthly: {
      soil_moisture_0_10cm_m3m3: pct("soil_moisture_0_10cm_m3m3"),
      soil_moisture_10_40cm_m3m3: pct("soil_moisture_10_40cm_m3m3"),
      evapotranspiration_mm: pct("evapotranspiration_mm"),
      rainfall_mm: pct("rainfall_mm"),
      surface_runoff_mm: pct("surface_runoff_mm"),
      subsurface_runoff_mm: pct("subsurface_runoff_mm"),
      total_runoff_mm: pct("total_runoff_mm"),
    },
    months_used: series.rainfall_mm.size,
    months_failed: failed,
    source: {
      name: "NASA GES DISC, FLDAS Noah Land Surface Model L4 Global Monthly 0.1 degree (MERRA-2 and CHIRPS) V001 (FLDAS_NOAH01_C_GL_M); Earthdata cloud OPeNDAP subset, granule list from CMR",
      doi: DOI,
      url: LANDING,
      citation: CITATION.replace("[Data Access Date]", today),
    },
  };
}
