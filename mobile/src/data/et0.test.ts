import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS_IN_MONTH,
  et0Day,
  midMonthDayOfYear,
  monthlyEt0,
  solarFromSunshine,
  solarToMJ,
  windAt2m,
  extraterrestrialRadiation,
  daylightHours,
} from './et0';

/**
 * FAO-56 Chapter 4, Example 17: "Determination of ETo with mean monthly data".
 * Bangkok, Thailand, 13 deg 44' N (13.73), elevation 2 m, April (15 April, J = 105).
 * Source: https://www.fao.org/4/x0490e/x0490e08.htm
 * The paper prints rounded intermediates, so each check uses a tolerance
 * that matches the printed precision.
 */
const LAT = 13.73;
const ELEV = 2;
const DOY = 105;

function near(actual: number, expected: number, tol: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: got ${actual}, expected ${expected} +/- ${tol}`,
  );
}

test('midMonthDayOfYear: 15 April is day 105 (common year)', () => {
  assert.equal(midMonthDayOfYear(3), 105);
  assert.equal(midMonthDayOfYear(0), 15);
  assert.equal(midMonthDayOfYear(11), 349);
});

test('radiation terms match FAO-56 Example 17', () => {
  near(extraterrestrialRadiation(LAT, DOY), 38.06, 0.05, 'Ra');
  near(daylightHours(LAT, DOY), 12.31, 0.02, 'N');
  near(solarFromSunshine(8.5, LAT, DOY), 22.65, 0.05, 'Rs');
});

test('ET0 matches FAO-56 Example 17 (5.72 mm/day) and its intermediates', () => {
  const rs = solarFromSunshine(8.5, LAT, DOY);
  const r = et0Day({
    tmaxC: 34.8,
    tminC: 25.6,
    eaKpa: 2.85,
    windMs2m: 2,
    rsMjM2Day: rs,
    latDeg: LAT,
    elevM: ELEV,
    dayOfYear: DOY,
    gMjM2Day: 0.14 * (30.2 - 29.2), // Eq. 44, March mean 29.2 C
  });
  const d = r.detail;
  near(d.tmeanC, 30.2, 1e-9, 'Tmean');
  near(d.pressureKpa, 101.3, 0.05, 'P');
  near(d.gammaKpaC, 0.0674, 0.0002, 'gamma');
  near(d.deltaKpaC, 0.246, 0.001, 'Delta');
  near(d.esKpa, 4.42, 0.01, 'es');
  near(d.rsoMjM2Day, 28.54, 0.05, 'Rso');
  near(d.rnsMjM2Day, 17.44, 0.05, 'Rns');
  near(d.rnlMjM2Day, 3.11, 0.03, 'Rnl');
  near(d.rnMjM2Day, 14.33, 0.05, 'Rn');
  near(d.radiationTermMmDay, 3.97, 0.03, 'radiation term');
  near(d.aerodynamicTermMmDay, 1.75, 0.03, 'aerodynamic term');
  near(r.et0MmDay, 5.72, 0.05, 'ETo');
});

test('actual vapour pressure from mean RH uses Eq. 19 (ea = es * RH / 100)', () => {
  const base = {
    tmaxC: 34.8,
    tminC: 25.6,
    windMs2m: 2,
    rsMjM2Day: 22.65,
    latDeg: LAT,
    elevM: ELEV,
    dayOfYear: DOY,
    gMjM2Day: 0.14,
  };
  const viaRh = et0Day({ ...base, rhMeanPct: 60 });
  near(viaRh.detail.eaKpa, viaRh.detail.esKpa * 0.6, 1e-12, 'ea');
  const viaEa = et0Day({ ...base, eaKpa: viaRh.detail.esKpa * 0.6 });
  near(viaRh.et0MmDay, viaEa.et0MmDay, 1e-12, 'ET0 via RH vs ea');
});

test('et0Day needs eaKpa or rhMeanPct', () => {
  assert.throws(
    () =>
      et0Day({
        tmaxC: 30,
        tminC: 22,
        windMs2m: 2,
        rsMjM2Day: 18,
        latDeg: 8,
        elevM: 0,
        dayOfYear: 100,
        gMjM2Day: 0,
      }),
    TypeError,
  );
});

test('solarToMJ converts POWER and FAO-56 units; unknown units throw', () => {
  assert.equal(solarToMJ(5, 'MJ/m^2/day'), 5);
  near(solarToMJ(1, 'kW-hr/m^2/day'), 3.6, 1e-12, 'kWh');
  near(solarToMJ(100, 'W/m^2'), 8.64, 1e-9, 'W/m2 (FAO-56 Table 3)');
  assert.throws(() => solarToMJ(1, 'cal/cm^2/day'), RangeError);
});

test('windAt2m: 10 m reading of 3.2 m/s gives about 2.4 m/s (FAO-56 Example 14)', () => {
  near(windAt2m(3.2, 10), 2.4, 0.05, 'u2');
  near(windAt2m(2, 2), 2, 0.01, 'u2 at 2 m is unchanged');
});

test('latitude beyond 66 degrees throws', () => {
  assert.throws(() => extraterrestrialRadiation(80, 100), RangeError);
});

const flat = (v: number) => Array<number | null>(12).fill(v);

test('monthlyEt0: constant temperature gives G = 0 and mm/month = mm/day * days', () => {
  const r = monthlyEt0({
    tmaxC: flat(32),
    tminC: flat(23),
    rhMeanPct: flat(80),
    windMs2m: flat(1.5),
    rsMjM2Day: flat(18),
    latDeg: 8.23,
    elevM: 6,
  });
  assert.equal(r.elevationAssumed, false);
  for (let m = 0; m < 12; m++) {
    const day = r.et0MmDay[m] as number;
    const expected = et0Day({
      tmaxC: 32,
      tminC: 23,
      rhMeanPct: 80,
      windMs2m: 1.5,
      rsMjM2Day: 18,
      latDeg: 8.23,
      elevM: 6,
      dayOfYear: midMonthDayOfYear(m),
      gMjM2Day: 0,
    }).et0MmDay;
    near(day, expected, 1e-12, `month ${m + 1} mm/day`);
    near(r.et0MmMonth[m] as number, day * DAYS_IN_MONTH[m], 1e-9, `month ${m + 1} mm/month`);
  }
});

test('monthlyEt0: G wraps December to January (Eq. 43)', () => {
  const tmax = flat(32) as number[];
  tmax[11] = 28; // cool December
  const r = monthlyEt0({
    tmaxC: tmax,
    tminC: flat(23),
    rhMeanPct: flat(80),
    windMs2m: flat(1.5),
    rsMjM2Day: flat(18),
    latDeg: 8.23,
    elevM: 6,
  });
  // January's G = 0.07 * (Feb mean 27.5 - Dec mean 25.5) = 0.14, positive because
  // the wrapped December is cooler, so January ET0 must be lower than with G = 0.
  // Without the wrap (Dec ignored) G would be 0 and this assertion would fail.
  const withG0 = et0Day({
    tmaxC: 32,
    tminC: 23,
    rhMeanPct: 80,
    windMs2m: 1.5,
    rsMjM2Day: 18,
    latDeg: 8.23,
    elevM: 6,
    dayOfYear: 15,
    gMjM2Day: 0,
  }).et0MmDay;
  const g = 0.07 * (27.5 - 25.5);
  assert.ok(g > 0);
  assert.ok((r.et0MmDay[0] as number) < withG0, 'positive G lowers ET0 in January');
});

test('monthlyEt0: missing input gives null for that month only, with a warning', () => {
  const tmax = flat(32);
  tmax[5] = null; // -999 turned into null by the POWER parser
  const r = monthlyEt0({
    tmaxC: tmax,
    tminC: flat(23),
    rhMeanPct: flat(80),
    windMs2m: flat(1.5),
    rsMjM2Day: flat(18),
    latDeg: 8.23,
    elevM: 6,
  });
  assert.equal(r.et0MmDay[5], null);
  assert.equal(r.et0MmMonth[5], null);
  assert.notEqual(r.et0MmDay[4], null);
  assert.ok(r.warnings.some((w) => w.startsWith('Month 6')));
  // Neighbours lose their G (their neighbour is missing) and fall back to G = 0
  assert.ok(r.warnings.some((w) => w.startsWith('Month 5') && w.includes('G set to 0')));
});

test('monthlyEt0: null elevation falls back to sea level and is flagged', () => {
  const r = monthlyEt0({
    tmaxC: flat(32),
    tminC: flat(23),
    rhMeanPct: flat(80),
    windMs2m: flat(1.5),
    rsMjM2Day: flat(18),
    latDeg: 8.23,
    elevM: null,
  });
  assert.equal(r.elevationAssumed, true);
  assert.ok(r.warnings[0].includes('sea level'));
});

test('monthlyEt0 rejects series that are not 12 long', () => {
  assert.throws(
    () =>
      monthlyEt0({
        tmaxC: [30],
        tminC: flat(23),
        rhMeanPct: flat(80),
        windMs2m: flat(1.5),
        rsMjM2Day: flat(18),
        latDeg: 8,
        elevM: 0,
      }),
    RangeError,
  );
});
