// Offline place search on the lots map (#196): the farmer types a town, city or coordinates and the map flies
// there. Searches the bundled GeoNames town list (pipeline/build_places.py); nothing typed is sent anywhere
// (rule 8). Plain logic, no React Native imports, so it runs in Node tests.

/** One row of `places-ph.json`: [name, province, lat, lon]. */
export type PlaceRow = readonly [string, string, number, number];

export interface Place {
  name: string;
  province: string;
  lat: number;
  lon: number;
  /** `name`, normalised for matching. */
  norm: string;
  /** The name without "City of", "Municipality of" or " City", normalised: "iligan" for "Iligan City". */
  core: string;
}

/** One line in the results list. */
export interface PlaceHit {
  key: string;
  title: string;
  detail: string;
  lat: number;
  lon: number;
  zoom: number;
}

export const MIN_QUERY = 2;
export const MAX_HITS = 6;
/** Close enough to see a town's fields and roads; the farmer zooms in further to draw. */
export const TOWN_ZOOM = 13;
/** Typed coordinates point at one spot, so the map goes in closer. */
export const COORDS_ZOOM = 16;

/** Lower case, accents removed (ñ = n), punctuation as spaces, single spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toPlaces(rows: readonly PlaceRow[]): Place[] {
  return rows.map(([name, province, lat, lon]) => ({
    name,
    province,
    lat,
    lon,
    norm: normalize(name),
    core: normalize(name.replace(/^(city|municipality) of /i, "").replace(/ city$/i, "")),
  }));
}

/** "8.23, 124.24" or "8.23 124.24" → the point; null if it isn't a valid latitude and longitude. */
export function parseCoords(q: string): { lat: number; lon: number } | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/**
 * Up to MAX_HITS results, best first: the name without "City of"/" City" equals the query, then the name starts
 * with it, then a later word starts with it. Ties keep the file's order (bigger towns first). Only names are
 * searched, not provinces.
 */
export function searchPlaces(places: readonly Place[], query: string): PlaceHit[] {
  const point = parseCoords(query);
  if (point) {
    return [{ key: "coords", title: `Go to ${point.lat}, ${point.lon}`, detail: "Coordinates", ...point, zoom: COORDS_ZOOM }];
  }
  const q = normalize(query);
  if (q.length < MIN_QUERY) return [];
  const ranked: { p: Place; rank: number; i: number }[] = [];
  places.forEach((p, i) => {
    const rank = p.core === q ? 0 : p.norm.startsWith(q) || p.core.startsWith(q) ? 1 : ` ${p.norm}`.includes(` ${q}`) ? 2 : -1;
    if (rank >= 0) ranked.push({ p, rank, i });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, MAX_HITS)
    .map(({ p, i }) => ({ key: `town-${i}`, title: p.name, detail: p.province, lat: p.lat, lon: p.lon, zoom: TOWN_ZOOM }));
}
