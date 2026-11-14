/// <reference types="node" />
// Engine skeleton checks (#22): purity, entry points, and the mock lot fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ILIGAN_LOT_FIXTURE } from "./__fixtures__/iligan-lot.fixture";
import * as engine from "./index";

const ENGINE_DIR = join(process.cwd(), "src", "engine");
const FORBIDDEN = /from\s+["'](react|react-native|expo)(["'/-]|$)|from\s+["']@(expo|react-native)/;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

test("src/engine imports no React, React Native or Expo module", () => {
  const files = tsFiles(ENGINE_DIR);
  assert.ok(files.length > 0);
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), FORBIDDEN, f);
});

test("engine entry points exist; later ones say which issue implements them", () => {
  assert.equal(typeof engine.waterBalance, "function");
  assert.equal(typeof engine.cropFit, "function");
  assert.equal(typeof engine.rotations, "function");
  assert.equal(typeof engine.plantingWindow, "function");
  assert.equal(typeof engine.marketAccess, "function");
  assert.throws(() => engine.explain(), /#28/);
});

test("Iligan mock lot fixture has 12 months per series and is labeled a test fixture", () => {
  const m = ILIGAN_LOT_FIXTURE.monthly;
  for (const s of [m.precip_mm.p20, m.precip_mm.p50, m.precip_mm.p80, m.et0_mm, m.tmax_c, m.tmin_c, m.rootzone_wetness]) {
    assert.equal(s.length, 12);
  }
  assert.ok(ILIGAN_LOT_FIXTURE.caveats[0].startsWith("TEST FIXTURE"));
  assert.ok(ILIGAN_LOT_FIXTURE.provenance.length > 0);
});
