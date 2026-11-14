import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIO_RANGE } from "../engine/params";
import { applyScenario } from "../engine/scenario";
import { describeScenario, NO_CHANGE, RAIN_CHOICES, rainLabel, TEMP_CHOICES, tempLabel, toScenario } from "./what-if-core";

test("the choices cover the whole range and include no change", () => {
  assert.equal(RAIN_CHOICES[0], SCENARIO_RANGE.rain_pct.min);
  assert.equal(RAIN_CHOICES[RAIN_CHOICES.length - 1], SCENARIO_RANGE.rain_pct.max);
  assert.ok(RAIN_CHOICES.includes(0));
  assert.equal(TEMP_CHOICES[0], SCENARIO_RANGE.temp_c.min);
  assert.equal(TEMP_CHOICES[TEMP_CHOICES.length - 1], SCENARIO_RANGE.temp_c.max);
});

test("every choice is accepted by the engine's range check", () => {
  const monthly = {
    precip_mm: { p20: [1], p50: [1], p80: [1] },
    tmax_c: [30],
    tmin_c: [22],
    et0_mm: [100],
  } as never;
  for (const r of RAIN_CHOICES) for (const t of TEMP_CHOICES) {
    assert.doesNotThrow(() => applyScenario({ lat: 8, elevation_m: null, monthly }, { rain_pct: r, temp_c: t }));
  }
});

test("both at zero means no scenario", () => {
  assert.equal(toScenario(0, 0), null);
  assert.deepEqual(toScenario(-20, 0), { rain_pct: -20, temp_c: 0 });
  assert.deepEqual(NO_CHANGE, { rain_pct: 0, temp_c: 0 });
});

test("labels say what changed in plain words", () => {
  assert.equal(rainLabel(0), "Same rain");
  assert.equal(rainLabel(-30), "−30% rain");
  assert.equal(rainLabel(20), "+20% rain");
  assert.equal(tempLabel(0), "Same temperature");
  assert.equal(tempLabel(2), "+2 °C");
  assert.equal(describeScenario({ rain_pct: -20, temp_c: 1 }), "20% less rain and 1 °C warmer");
  assert.equal(describeScenario({ rain_pct: 10, temp_c: 0 }), "10% more rain");
});
