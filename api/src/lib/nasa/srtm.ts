// Elevation and slope from NASA SRTM v3 (1 arc-second) via Open Topo Data, for one 0.1 degree point.
// Port of pipeline/fetch_srtm.py (Horn 1981 slope on a 3 x 3 grid); constants copied from it.
import { Budget, UpstreamError, getText, type Source } from "./common";

// Public Open Topo Data API (pipeline URL): at most 100 locations per request, 1 call per second,
// 1000 calls per day (https://www.opentopodata.org/, read 2026-11-14). One request of 9 locations here.
const URL_BASE = "https://api.opentopodata.org/v1/srtm30m";
// Neighbour spacing = the SRTM cell size, about 30 m (pipeline SPACING_M).
const SPACING_M = 30.0;
// Recommended citation from the NASA Earthdata catalogue page for SRTMGL1 v003 (pipeline CITATION, read 2026-11-14).
const CITATION =
  "NASA JPL (2013), NASA Shuttle Radar Topography Mission Global 1 arc second v3, NASA LP DAAC, " +
  "https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003, served via Open Topo Data";
const DOI = "10.5067/MEASURES/SRTM/SRTMGL1.003";
// Acquisition period on the same page (pipeline ACQUIRED).
const ACQUIRED = "2000-02-11 to 2000-02-21";

export type SrtmAnswer = {
  elevation_m: number | null;
  slope_pct: number | null;
  slope_deg: number | null;
  point: { lat: number; lon: number };
  method: string;
  period: string;
  native_res: string;
  caveats: string[];
  source: Source;
};

/** (metres per degree of latitude, of longitude) at this latitude, WGS84 series (pipeline meters_per_degree()). */
function metersPerDegree(lat: number): [number, number] {
  const p = (lat * Math.PI) / 180;
  return [111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p), 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p)];
}

/** The 9 points a b c / d e f / g h i, north row first, west to east (pipeline grid_points()). */
function gridPoints(lat: number, lon: number): [number, number][] {
  const [latM, lonM] = metersPerDegree(lat);
  const dlat = SPACING_M / latM;
  const dlon = SPACING_M / lonM;
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return [1, 0, -1].flatMap((r) => [-1, 0, 1].map((c) => [r6(lat + r * dlat), r6(lon + c * dlon)] as [number, number]));
}

/** Horn (1981) slope in percent from the 9 heights in grid order; null if any is missing (pipeline horn_slope_pct()). */
function hornSlopePct(z: (number | null)[]): number | null {
  if (z.length !== 9 || z.some((v) => v === null)) return null;
  const [a, b, c, d, , f, g, h, i] = z as number[];
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * SPACING_M);
  const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * SPACING_M);
  return 100 * Math.hypot(dzdx, dzdy);
}

export async function srtm(lat: number, lon: number): Promise<SrtmAnswer> {
  const budget = new Budget();
  const locations = gridPoints(lat, lon).map(([la, lo]) => `${la},${lo}`).join("|");
  let data: { status?: string; results?: { elevation: number | null }[] };
  try {
    data = JSON.parse(await getText(`${URL_BASE}?${new URLSearchParams({ locations })}`, budget));
  } catch (e) {
    if (e instanceof UpstreamError) throw new UpstreamError(e.status, e.code, e.message.replace("A NASA server", "Open Topo Data"));
    throw new UpstreamError(502, "upstream_error", "Open Topo Data answered with something that is not JSON");
  }
  if (data.status !== "OK" || !data.results || data.results.length !== 9) throw new UpstreamError(502, "upstream_error", "Open Topo Data did not answer OK");
  const z = data.results.map((r) => r.elevation ?? null);
  const elev = z[4];
  const caveats: string[] = [];
  if (elev === null) caveats.push("SRTM gives no height at this point (outside the dataset, or no data there), so the elevation is unknown.");
  else if (elev === 0) caveats.push("SRTM reads 0 m here. That is also what the sea reads, so the point may be on the shoreline.");
  const slope = hornSlopePct(z);
  if (slope === null && elev !== null) caveats.push("SRTM is missing around this point, so the slope is unknown.");
  caveats.push(
    "The point is the lot centre rounded to 0.1 degree (about 11 km), so this is the height and slope at that rounded point, not at the lot.",
    "Heights come back in whole metres, so the slope is a rough terrain class (a 1 m step over 30 m is already about 3%), reported in whole percent and whole degrees.",
  );
  return {
    elevation_m: elev,
    // Whole percent and whole degrees: the pipeline measured a few percent spread across 30, 60 and 90 m spacing.
    slope_pct: slope === null ? null : Math.round(slope),
    slope_deg: slope === null ? null : Math.round((Math.atan(slope / 100) * 180) / Math.PI),
    point: { lat, lon },
    method: "Horn (1981) slope from the point and its 8 neighbours on a 3 x 3 grid, 30 m apart (pipeline/fetch_srtm.py)",
    period: ACQUIRED,
    native_res: "1 arc-second (about 30 m)",
    caveats,
    source: { name: "NASA SRTM v3 (SRTMGL1), 1 arc-second, via the public Open Topo Data API (srtm30m)", doi: DOI, url: "https://www.opentopodata.org/datasets/srtm/", citation: CITATION },
  };
}
