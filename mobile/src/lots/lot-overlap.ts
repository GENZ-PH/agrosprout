// "This lot overlaps Lot N" (#176): a new or adjusted lot must not cover another lot of the farm, or the same
// ground counts twice in the farm area and the per-lot results. Neighbouring lots drawn with a finger along a
// shared edge always overlap a little, so a small overlap is accepted (OVERLAP below).
// No React Native imports, so it runs in Node tests.
import type { LonLat, Lot } from "../types";
import { isPinLot } from "./lot-editor";

/**
 * When an overlap counts. UI tuning values (assumption, not sourced data), sized from the S1 drawing zoom
 * (lots.tsx: zoom 17, about 1.2 m per screen pixel at Iligan): a fingertip line wanders some 5-10 px, so two lots
 * traced along one shared edge overlap by a strip a few metres wide. On a 1 ha lot (100 m × 100 m) a 6 m strip
 * along one side is 600 m², 6% of the lot, under the 10% share.
 */
export const OVERLAP = {
  /** Overlaps up to this share of the smaller lot are accepted (assumption: validate with farmers). */
  maxShare: 0.1,
  /** Overlaps up to this size (m²) are always accepted (assumption; the same as the 100 m² smallest lot). */
  minM2: 100,
  /** Sample points per side when measuring the overlap (accuracy about 1/grid² of the shared box). */
  grid: 48,
} as const;

type Ring = readonly LonLat[];

/** Metres per degree (spherical approximation, exact enough at lot size). */
const M_PER_DEG_LAT = 110_574;
const mPerDegLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

function box(ring: Ring): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

function inside(ring: Ring, x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Area of a closed ring in m² (shoelace on a local flat projection). */
export function ringAreaM2(ring: Ring): number {
  if (ring.length < 4) return 0;
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = mPerDegLon(lat0);
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * kx * ring[i][1] * M_PER_DEG_LAT - ring[i][0] * kx * ring[j][1] * M_PER_DEG_LAT;
  }
  return Math.abs(a) / 2;
}

/** Overlap of two lot outlines in m², measured on a grid over the box both share. 0 when they don't touch. */
export function overlapM2(a: Ring, b: Ring): number {
  const [ax0, ay0, ax1, ay1] = box(a);
  const [bx0, by0, bx1, by1] = box(b);
  const x0 = Math.max(ax0, bx0);
  const y0 = Math.max(ay0, by0);
  const x1 = Math.min(ax1, bx1);
  const y1 = Math.min(ay1, by1);
  if (x0 >= x1 || y0 >= y1) return 0;
  const n = OVERLAP.grid;
  const dx = (x1 - x0) / n;
  const dy = (y1 - y0) / n;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * dx;
    for (let j = 0; j < n; j++) {
      const y = y0 + (j + 0.5) * dy;
      if (inside(a, x, y) && inside(b, x, y)) hits++;
    }
  }
  const cellM2 = dx * mPerDegLon((y0 + y1) / 2) * dy * M_PER_DEG_LAT;
  return hits * cellM2;
}

/**
 * The first other lot this outline overlaps by more than OVERLAP allows, or null. Pin lots are skipped: they have
 * a typed area and no outline, so there is nothing to compare.
 */
export function findOverlap(
  ring: Ring,
  selfId: string,
  lots: readonly Pick<Lot, "id" | "name" | "geometry">[],
): { id: string; name: string; overlap_m2: number } | null {
  const own = ringAreaM2(ring);
  for (const lot of lots) {
    if (lot.id === selfId || isPinLot(lot)) continue;
    const other = lot.geometry.coordinates[0] ?? [];
    const o = overlapM2(ring, other);
    if (o <= OVERLAP.minM2) continue;
    const smaller = Math.min(own, ringAreaM2(other));
    if (smaller > 0 && o / smaller <= OVERLAP.maxShare) continue;
    return { id: lot.id, name: lot.name, overlap_m2: o };
  }
  return null;
}
