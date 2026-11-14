import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanSketch, CLEANUP, closeRing, corners, isSimpleRing, ringAreaM2 } from "./cleanup";
import type { LonLat } from "../src/types";

// Recorded-style sample strokes, generated so the expected answers are known
// exactly. Centre: near Iligan City (any point works; only the shape matters).
const C: LonLat = [124.245, 8.228];
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos((C[1] * Math.PI) / 180);
const at = (dxM: number, dyM: number): LonLat => [C[0] + dxM / M_PER_DEG_LON, C[1] + dyM / M_PER_DEG_LAT];

/** Small deterministic wobble, like a finger (no Math.random, so tests are repeatable). */
const wobble = (i: number, m: number) => Math.sin(i * 12.9898) * m;

function shakyCircle(radiusM: number, n: number): LonLat[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return at(Math.cos(t) * radiusM + wobble(i, 1), Math.sin(t) * radiusM + wobble(i + 7, 1));
  });
}

function shakyRectangle(wM: number, hM: number, perSide: number): LonLat[] {
  const pts: LonLat[] = [];
  const corners: [number, number][] = [[0, 0], [wM, 0], [wM, hM], [0, hM]];
  corners.forEach(([x0, y0], k) => {
    const [x1, y1] = corners[(k + 1) % 4];
    for (let i = 0; i < perSide; i++) {
      const f = i / perSide;
      const j = k * perSide + i;
      pts.push(at(x0 + (x1 - x0) * f + wobble(j, 1.5), y0 + (y1 - y0) * f + wobble(j + 3, 1.5)));
    }
  });
  return pts;
}

/** A figure eight: the line crosses itself once in the middle (no sample sits on the crossing). */
function figureEight(sizeM: number, n: number): LonLat[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * (i + 0.5)) / n;
    return at(Math.sin(t) * sizeM, Math.sin(t) * Math.cos(t) * sizeM * 0.8);
  });
}

test("a clean loop becomes a simple polygon with 3-12 corners and about the same area", () => {
  const r = cleanSketch(shakyCircle(50, 80));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.fix, "none");
  assert.ok(corners(r.ring) >= 3 && corners(r.ring) <= CLEANUP.targetMaxCorners, `corners ${corners(r.ring)}`);
  assert.ok(isSimpleRing(r.ring));
  const circle = Math.PI * 50 * 50;
  assert.ok(r.area_m2 > circle * 0.8 && r.area_m2 < circle * 1.05, `area ${r.area_m2}`);
});

test("a shaky rectangle keeps its four corners and its area", () => {
  const r = cleanSketch(shakyRectangle(100, 60, 20));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(corners(r.ring) >= 4 && corners(r.ring) <= 8, `corners ${corners(r.ring)}`);
  assert.ok(Math.abs(r.area_m2 - 6000) / 6000 < 0.1, `area ${r.area_m2}`);
});

test("a self-crossing sketch still gives a valid polygon", () => {
  const raw = figureEight(60, 80);
  assert.equal(isSimpleRing(closeRing(raw)), false, "the sample really crosses itself");
  const r = cleanSketch(raw);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.notEqual(r.fix, "none");
  assert.ok(isSimpleRing(r.ring));
  assert.ok(r.area_m2 >= CLEANUP.minAreaM2);
});

test("a too-short stroke is rejected", () => {
  const r = cleanSketch(shakyCircle(50, 80).slice(0, 4));
  assert.deepEqual(r, { ok: false, reason: "too_short" });
});

test("a tiny loop (under 100 m²) is rejected", () => {
  const r = cleanSketch(shakyCircle(4, 40));
  assert.deepEqual(r, { ok: false, reason: "too_small" });
});

test("closeRing drops repeated points and closes the loop", () => {
  const ring = closeRing([at(0, 0), at(0, 0), at(30, 0), at(30, 30), at(0, 30)]);
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.ok(Math.abs(ringAreaM2(ring) - 900) < 5);
});
