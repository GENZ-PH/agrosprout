// "This lot looks like it is on water" (sea or lake): the lot checked against Natural Earth 1:10m land and lakes for the
// Philippines, bundled by pipeline/build_land_water.py (public domain, "Made with Natural Earth"). It catches what NASA
// POWER's ~50 km cells read as land: inner seas such as Manila Bay or the Visayan Sea, and Laguna de Bay (POWER probe
// 2026-11-15). A soft warning only: the map's shore is coarse (1:10,000,000 scale), so a real farm on the shore, a
// fishpond say, can read as water. Not in the data: Lake Lanao. Outside the map's window (e.g. Pag-asa Island): no check.
// No React Native imports, so it runs in Node tests.
import type { Lot } from "../types";

type Ring = readonly (readonly number[])[];
type Polygon = readonly Ring[];

/** The bundled file's shape (`mobile/assets/data/land-water-ph.json`). */
export interface LandWaterData {
  meta: { window: readonly number[] } & Record<string, unknown>;
  /** Land and minor islands: each polygon is an outer ring, then its holes. */
  land: readonly Polygon[];
  lakes: readonly Polygon[];
}

interface Prepared {
  box: [number, number, number, number];
  rings: Polygon;
}

export interface LandWaterIndex {
  window: [number, number, number, number];
  land: Prepared[];
  lakes: Prepared[];
}

function prepare(polys: readonly Polygon[]): Prepared[] {
  return polys.map((rings) => {
    const outer = rings[0];
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of outer) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { box: [x0, y0, x1, y1], rings };
  });
}

/** Builds the lookup once (bounding boxes per polygon). */
export function prepareLandWater(d: LandWaterData): LandWaterIndex {
  const [a, b, c, e] = d.meta.window;
  return { window: [a, b, c, e], land: prepare(d.land), lakes: prepare(d.lakes) };
}

/** Even-odd rule over the polygon's rings, so a hole in the land (a bay) is not land. */
function inside(p: Prepared, x: number, y: number): boolean {
  const [x0, y0, x1, y1] = p.box;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  let c = false;
  for (const r of p.rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = r[i];
      const [bx, by] = r[i + 1];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c;
    }
  }
  return c;
}

/** "land" or "water" (sea or a lake) at a point; null outside the map's window, where it can't say. */
export function placeAt(index: LandWaterIndex, lon: number, lat: number): "land" | "water" | null {
  const [w0, w1, w2, w3] = index.window;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < w0 || lon > w2 || lat < w1 || lat > w3) return null;
  if (index.lakes.some((p) => inside(p, lon, lat))) return "water";
  return index.land.some((p) => inside(p, lon, lat)) ? "land" : "water";
}

/**
 * True when the lot's centre and every point of its outline read as water: the whole lot is on the sea or a lake.
 * A lot across the shore, or outside the map, gives false (no warning).
 */
export function lotLooksLikeWater(index: LandWaterIndex, lot: Pick<Lot, "geometry" | "centroid">): boolean {
  const points = [lot.centroid, ...(lot.geometry.coordinates[0] ?? [])];
  return points.every(([lon, lat]) => placeAt(index, lon, lat) === "water");
}
