// Sketch → clean plot (#20, docs/06-architecture.md "Freehand sketch → plot").
// Pure functions: no DOM, no Leaflet, so they run in Node tests and in the map page.

import { area } from "@turf/area";
import { convex } from "@turf/convex";
import { featureCollection, point, polygon } from "@turf/helpers";
import { simplify } from "@turf/simplify";
import { unkinkPolygon } from "@turf/unkink-polygon";

import type { ShapeFix, SketchRejectReason } from "../src/map/bridge";
import type { LonLat } from "../src/types";

/** Thresholds from #20. UI tuning values, not agronomic data. */
export const CLEANUP = {
  /** Fewer raw points than this is a tap or a slip, not a lot outline. */
  minRawPoints: 6,
  /** Smaller than this (m²) is rejected: "Try drawing around the whole lot". */
  minAreaM2: 100,
  /** Target corner count after simplifying. */
  targetMaxCorners: 12,
  /** Coordinate decimals kept (6 ≈ 0.1 m). */
  decimals: 6,
} as const;

export type CleanupResult =
  | { ok: true; ring: LonLat[]; fix: ShapeFix; area_m2: number }
  | { ok: false; reason: SketchRejectReason };

const round = (v: number) => Number(v.toFixed(CLEANUP.decimals));
const same = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1];

/** Rounds, drops repeated points, and closes the ring. */
export function closeRing(points: LonLat[]): LonLat[] {
  const out: LonLat[] = [];
  for (const p of points) {
    const q: LonLat = [round(p[0]), round(p[1])];
    if (!out.length || !same(out[out.length - 1], q)) out.push(q);
  }
  if (out.length && !same(out[0], out[out.length - 1])) out.push(out[0]);
  return out;
}

/** Corner count of a closed ring (the closing point is not a corner). */
export const corners = (ring: LonLat[]) => Math.max(0, ring.length - 1);

/** Area of a closed ring in m². */
export const ringAreaM2 = (ring: LonLat[]) => area(polygon([ring]));

/**
 * Douglas-Peucker with a tolerance scaled to the sketch size: start at 2.5% of the
 * bounding-box diagonal and grow until the ring has at most `targetMaxCorners`.
 */
export function simplifyRing(ring: LonLat[]): LonLat[] {
  if (corners(ring) <= CLEANUP.targetMaxCorners) return ring;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  let tolerance = diagonal * 0.025;
  let best = ring;
  for (let i = 0; i < 12; i++) {
    const next = simplify(polygon([ring]), { tolerance, highQuality: true }).geometry.coordinates[0] as LonLat[];
    if (corners(next) >= 3) best = next;
    if (corners(next) <= CLEANUP.targetMaxCorners) break;
    tolerance *= 1.5;
  }
  return best;
}

/** True when no two non-adjacent edges of the ring cross. */
export function isSimpleRing(ring: LonLat[]): boolean {
  const n = ring.length - 1;
  if (n < 3) return false;
  const cross = (a: LonLat, b: LonLat, c: LonLat) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const intersects = (p1: LonLat, p2: LonLat, p3: LonLat, p4: LonLat) => {
    const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbours share a point
      if (intersects(ring[i], ring[i + 1], ring[j], ring[j + 1])) return false;
    }
  }
  return true;
}

/** If lines cross, split at the crossings and keep the largest piece; if that fails, use the convex hull. */
export function fixRing(ring: LonLat[], rawPoints: LonLat[]): { ring: LonLat[]; fix: ShapeFix } {
  if (isSimpleRing(ring)) return { ring, fix: "none" };
  try {
    const pieces = unkinkPolygon(polygon([ring])).features;
    let largest: LonLat[] | null = null;
    let largestArea = 0;
    for (const piece of pieces) {
      const candidate = closeRing(piece.geometry.coordinates[0] as LonLat[]);
      const a = ringAreaM2(candidate);
      if (a > largestArea && isSimpleRing(candidate)) {
        largest = candidate;
        largestArea = a;
      }
    }
    if (largest) return { ring: largest, fix: "unkinked" };
  } catch {
    // fall through to the hull
  }
  const hull = convex(featureCollection(rawPoints.map((p) => point(p))));
  if (hull) return { ring: closeRing(hull.geometry.coordinates[0] as LonLat[]), fix: "hull" };
  return { ring, fix: "none" };
}

/** The whole pipeline: close → simplify → clean → size check. */
export function cleanSketch(rawPoints: LonLat[]): CleanupResult {
  const closed = closeRing(rawPoints);
  if (corners(closed) < CLEANUP.minRawPoints) return { ok: false, reason: "too_short" };
  const simplified = simplifyRing(closed);
  const { ring, fix } = fixRing(simplified, closed);
  const final = simplifyRing(ring);
  const area_m2 = ringAreaM2(final);
  if (corners(final) < 3 || !isSimpleRing(final) || area_m2 < CLEANUP.minAreaM2) {
    return { ok: false, reason: area_m2 < CLEANUP.minAreaM2 ? "too_small" : "too_short" };
  }
  return { ok: true, ring: final, fix, area_m2 };
}
