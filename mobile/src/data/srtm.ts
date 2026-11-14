/**
 * NASA SRTM elevation and slope for a lot the farmer drew (#9, #57; audit #112 A1/A2).
 *
 * Source: NASA SRTM v3, 1 arc-second (about 30 m), served by Open Topo Data (`srtm30m`),
 * https://www.opentopodata.org/datasets/srtm/. Same method as `pipeline/fetch_srtm.py`:
 * 9 heights on a 3 x 3 grid, 30 m apart, and the Horn (1981) slope. The pipeline notes say the
 * API returns whole metres, so the slope is a rough terrain class reported in whole percent.
 *
 * Privacy (CLAUDE.md rule 8, extended 2026-11-14 on the preview branch): the lot centre is rounded
 * to 0.001 degree (about 110 m) before it leaves the phone, the same order as the routing request.
 *
 * The public Open Topo Data API sends no CORS header, so the web build asks our own Cloudflare
 * Pages Function (`functions/api/srtm.ts`), which forwards the 9 points and caches the answer.
 * The Android app can call Open Topo Data directly. No React Native imports here.
 */

import { fetchWithTimeout } from '../net/fetch';

export const OPENTOPODATA_URL = 'https://api.opentopodata.org/v1/srtm30m';
/** Path of the web proxy (functions/api/srtm.ts), same origin as the app. */
export const SRTM_PROXY_PATH = '/api/srtm';
export const SPACING_M = 30;

/** Citation, verbatim from pipeline/fetch_srtm.py (NASA Earthdata catalogue page, read 2026-11-14). */
export const SRTM_CITATION =
  'NASA JPL (2013), NASA Shuttle Radar Topography Mission Global 1 arc second v3, NASA LP DAAC, https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003, served via Open Topo Data';
export const SRTM_ACQUIRED = '2000-02-11 to 2000-02-21';

export interface SrtmResult {
  elevation_m: number | null;
  slope_pct: number | null;
  /** The rounded point that was sent. */
  lat: number;
  lon: number;
  caveats: string[];
}

/** Round to 0.001 degree (about 110 m) so the exact field is never sent. */
export function roundForSrtm(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Metres per degree of latitude and of longitude at this latitude (same series as the pipeline). */
export function metersPerDegree(latDeg: number): [number, number] {
  const p = (latDeg * Math.PI) / 180;
  const latM = 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
  const lonM = 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p);
  return [latM, lonM];
}

/** The 9 points a b c / d e f / g h i, north row first, west to east. */
export function gridPoints(lat: number, lon: number, spacingM = SPACING_M): [number, number][] {
  const [latM, lonM] = metersPerDegree(lat);
  const dLat = spacingM / latM;
  const dLon = spacingM / lonM;
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const out: [number, number][] = [];
  for (const r of [1, 0, -1]) for (const c of [-1, 0, 1]) out.push([r6(lat + r * dLat), r6(lon + c * dLon)]);
  return out;
}

/** Horn (1981) slope in percent from 9 heights in grid order; null if any is missing. */
export function hornSlopePct(z: readonly (number | null)[], spacingM = SPACING_M): number | null {
  if (z.length !== 9 || z.some((v) => v === null || !Number.isFinite(v))) return null;
  const [a, b, c, d, , f, g, h, i] = z as number[];
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * spacingM);
  const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * spacingM);
  return 100 * Math.hypot(dzdx, dzdy);
}

export class SrtmParseError extends Error {}

/** Heights from an Open Topo Data answer (`{status: "OK", results: [{elevation}]}`), in order. */
export function parseHeights(json: unknown): (number | null)[] {
  const j = json as { status?: string; results?: { elevation?: number | null }[] };
  if (!j || j.status !== 'OK' || !Array.isArray(j.results) || j.results.length !== 9) {
    throw new SrtmParseError('Unexpected elevation answer');
  }
  return j.results.map((r) => (typeof r.elevation === 'number' && Number.isFinite(r.elevation) ? r.elevation : null));
}

/** Elevation and slope from the 9 heights, with the same caveats as the pipeline. */
export function elevationAndSlope(z: readonly (number | null)[], lat: number, lon: number): SrtmResult {
  const elev = z[4] ?? null;
  const caveats: string[] = [];
  if (elev === null) caveats.push('SRTM gives no height at this point, so the elevation is unknown.');
  else if (elev === 0) caveats.push('SRTM reads 0 m here, which is also what the sea reads. Check that the lot is on land.');
  const slope = hornSlopePct(z);
  if (slope === null && elev !== null) caveats.push('SRTM is missing around this point, so the slope is unknown.');
  return { elevation_m: elev, slope_pct: slope === null ? null : Math.round(slope), lat, lon, caveats };
}

export type SrtmFetcher = (lat: number, lon: number, signal?: AbortSignal) => Promise<unknown>;

/** URL for the 9 rounded points: the same-origin proxy on the web, Open Topo Data on Android. */
export function srtmUrl(lat: number, lon: number, web: boolean): string {
  const la = roundForSrtm(lat);
  const lo = roundForSrtm(lon);
  if (web) return `${SRTM_PROXY_PATH}?lat=${la}&lon=${lo}`;
  const locations = gridPoints(la, lo)
    .map(([y, x]) => `${y},${x}`)
    .join('|');
  return `${OPENTOPODATA_URL}?locations=${encodeURIComponent(locations)}`;
}

export function makeSrtmFetcher(web: boolean): SrtmFetcher {
  return async (lat, lon, signal) => {
    const res = await fetchWithTimeout(srtmUrl(lat, lon, web), { signal });
    if (!res.ok) throw new Error(`Elevation service answered ${res.status}`);
    return await res.json();
  };
}

/** Fetch and compute; the point is rounded before it is sent. */
export async function fetchSrtm(lat: number, lon: number, fetcher: SrtmFetcher, signal?: AbortSignal): Promise<SrtmResult> {
  const la = roundForSrtm(lat);
  const lo = roundForSrtm(lon);
  const z = parseHeights(await fetcher(la, lo, signal));
  return elevationAndSlope(z, la, lo);
}
