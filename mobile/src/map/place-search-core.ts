// Offline place search on the lots map (#196): the farmer types a town, city, barangay or coordinates and the map
// flies there. Searches the bundled GeoNames list (pipeline/build_places.py); nothing typed is sent anywhere
// (rule 8). Plain logic, no React Native imports, so it runs in Node tests.

/** One town row of `places-ph.json` (`places`): [name, province, lat, lon]. */
export type PlaceRow = readonly [string, string, number, number];
/** One barangay row of `places-ph.json` (`barangays`): [name, index of its town in `places`, lat, lon]. */
export type BarangayRow = readonly [string, number, number, number];

export interface Place {
  kind: "town" | "barangay";
  name: string;
  /** The result's second line: the province for a town, "Town, Province" for a barangay. */
  detail: string;
  lat: number;
  lon: number;
  /** `name`, normalised for matching. */
  norm: string;
  /** Town: the name without "City of", "Municipality of" or " City" ("iligan" for "Iligan City"). Barangay: `norm`. */
  core: string;
  /** What a query can match from the start of a word: a barangay adds its town, so "abuno ili" finds Abuno, Iligan. */
  full: string;
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
/** A barangay is smaller, so the map goes in closer. */
export const BARANGAY_ZOOM = 15;
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

const coreName = (name: string) => normalize(name.replace(/^(city|municipality) of /i, "").replace(/ city$/i, ""));

/** Towns first, then barangays (each pointing at its town by index). */
export function toPlaces(rows: readonly PlaceRow[], barangays: readonly BarangayRow[] = []): Place[] {
  const towns: Place[] = rows.map(([name, province, lat, lon]) => {
    const norm = normalize(name);
    return { kind: "town", name, detail: province, lat, lon, norm, core: coreName(name), full: norm };
  });
  const out = [...towns];
  for (const [name, town, lat, lon] of barangays) {
    const t = towns[town];
    if (!t) continue;
    const norm = normalize(name);
    const detail = t.detail ? `${t.name}, ${t.detail}` : t.name;
    out.push({ kind: "barangay", name, detail, lat, lon, norm, core: norm, full: `${norm} ${t.core}` });
  }
  return out;
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
 * Up to MAX_HITS results, best first. Towns come before barangays; within each, the name (without "City of" or
 * " City") equals the query, then the name starts with it, then a later word starts with it (for a barangay, its
 * town's name counts too). Ties keep the file's order: bigger towns first, barangays by town. Provinces are not
 * searched.
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
    const rank = p.core === q ? 0 : p.norm.startsWith(q) || p.core.startsWith(q) ? 1 : ` ${p.full}`.includes(` ${q}`) ? 2 : -1;
    if (rank >= 0) ranked.push({ p, rank: rank + (p.kind === "barangay" ? 3 : 0), i });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, MAX_HITS)
    .map(({ p, i }) => ({
      key: `${p.kind}-${i}`,
      title: p.name,
      detail: p.detail,
      lat: p.lat,
      lon: p.lon,
      zoom: p.kind === "town" ? TOWN_ZOOM : BARANGAY_ZOOM,
    }));
}
