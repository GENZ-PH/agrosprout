/**
 * Monthly reference evapotranspiration (ET0), FAO-56 Penman-Monteith.
 *
 * Source: Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop
 * evapotranspiration: guidelines for computing crop water requirements.
 * FAO Irrigation and Drainage Paper 56. Equation numbers below are the
 * paper's own (Chapters 2 and 3). Monthly use with monthly mean inputs is an
 * accepted FAO-56 procedure (Chapter 4, Example 17).
 *
 * Pure TypeScript: no React Native imports, so it runs on Android, web and
 * in Node tests. The Python mirror lives in `pipeline/et0.py` (issue #8) and
 * must give the same answer for the same inputs.
 *
 * Units: temperatures in degrees C, vapour pressure in kPa, wind in m/s at
 * 2 m, radiation in MJ m-2 day-1, ET0 in mm/day (and mm/month).
 */

// ---------------------------------------------------------------------------
// Constants (each with its FAO-56 source)
// ---------------------------------------------------------------------------

/** Solar constant, MJ m-2 min-1 (FAO-56 Eq. 21, Chapter 3). */
const GSC = 0.082;
/** Albedo of the hypothetical grass reference crop (FAO-56 Eq. 38, Chapter 3). */
const ALBEDO = 0.23;
/** Stefan-Boltzmann constant, MJ K-4 m-2 day-1 (FAO-56 Eq. 39, Chapter 3). */
const SIGMA = 4.903e-9;
/** Degrees C to Kelvin as used in FAO-56 Eq. 39 (273.16). */
const KELVIN_RNL = 273.16;
/** Degrees C to Kelvin as used in the aerodynamic term, 900/(T + 273) (Eq. 6). */
const KELVIN_PM = 273;
/** Radiation to equivalent evaporation, mm per MJ m-2 (FAO-56 Eq. 20, 1/lambda). */
const MM_PER_MJ = 0.408;
/** Latitude beyond which the sunset-hour-angle shortcut (Eq. 25) is not used here. */
const MAX_ABS_LAT_DEG = 66;
/** Days per month in a common year. Used because the inputs are multi-year climatology. */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** 1 W m-2 = 0.0864 MJ m-2 day-1 (FAO-56 Chapter 3, Table 3 unit conversion). */
const MJ_PER_W_M2_DAY = 0.0864;
/** 1 kWh = 3.6 MJ (exact, SI definition). */
const MJ_PER_KWH = 3.6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Et0DayInputs {
  /** Mean daily maximum air temperature, degrees C. */
  tmaxC: number;
  /** Mean daily minimum air temperature, degrees C. */
  tminC: number;
  /** Actual vapour pressure, kPa. Provide this OR `rhMeanPct`. */
  eaKpa?: number;
  /** Mean relative humidity, percent. Used for Eq. 19 when `eaKpa` is absent. */
  rhMeanPct?: number;
  /** Wind speed at 2 m, m/s. */
  windMs2m: number;
  /** Incoming solar radiation Rs, MJ m-2 day-1. Convert with `solarToMJ` first. */
  rsMjM2Day: number;
  /** Latitude, decimal degrees (north positive). */
  latDeg: number;
  /** Elevation above sea level, m. */
  elevM: number;
  /** Day of year used for the radiation terms (mid-month: see `midMonthDayOfYear`). */
  dayOfYear: number;
  /** Soil heat flux G, MJ m-2 day-1 (Eq. 43 or 44; 0 for daily periods). */
  gMjM2Day: number;
}

export interface Et0DayResult {
  et0MmDay: number;
  /** Intermediates, exposed so the unit test can check them against the worked example. */
  detail: {
    tmeanC: number;
    pressureKpa: number;
    gammaKpaC: number;
    deltaKpaC: number;
    esKpa: number;
    eaKpa: number;
    raMjM2Day: number;
    daylightHours: number;
    rsoMjM2Day: number;
    rnsMjM2Day: number;
    rnlMjM2Day: number;
    rnMjM2Day: number;
    radiationTermMmDay: number;
    aerodynamicTermMmDay: number;
  };
}

/** One value per month, January first. `null` = missing (POWER `-999`). */
export type MonthlySeries = readonly (number | null)[];

export interface MonthlyEt0Inputs {
  tmaxC: MonthlySeries;
  tminC: MonthlySeries;
  rhMeanPct: MonthlySeries;
  windMs2m: MonthlySeries;
  /** Solar radiation already in MJ m-2 day-1 (see `solarToMJ`). */
  rsMjM2Day: MonthlySeries;
  latDeg: number;
  /** SRTM elevation when known (#9). `null` falls back to sea level, flagged as an assumption. */
  elevM: number | null;
}

export interface MonthlyEt0Result {
  /** ET0 per month in mm/day, `null` where an input was missing. */
  et0MmDay: (number | null)[];
  /** ET0 per month in mm/month (mm/day times days in the month), `null` where missing. */
  et0MmMonth: (number | null)[];
  /** True when elevation was not supplied and sea level (0 m) was used. */
  elevationAssumed: boolean;
  /** Human-readable notes, e.g. months where G fell back to 0. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Day of year (common year) for the 15th of a month; month is 0 = January. FAO-56 Chapter 3 mid-month convention. */
export function midMonthDayOfYear(month0: number): number {
  let doy = 15;
  for (let m = 0; m < month0; m++) doy += DAYS_IN_MONTH[m];
  return doy;
}

/**
 * Convert incoming solar radiation to MJ m-2 day-1.
 * NASA POWER reports the unit in the response `parameters` metadata; pass that
 * string here. Unknown units throw so a wrong unit can never pass silently.
 */
export function solarToMJ(value: number, unit: string): number {
  const u = unit.trim().toLowerCase().replace(/\s+/g, '');
  if (u === 'mj/m^2/day' || u === 'mjm-2day-1' || u === 'mj/m2/day') return value;
  if (u === 'kw-hr/m^2/day' || u === 'kwh/m^2/day' || u === 'kwh/m2/day') return value * MJ_PER_KWH;
  if (u === 'w/m^2' || u === 'wm-2' || u === 'w/m2') return value * MJ_PER_W_M2_DAY;
  throw new RangeError(`Unknown solar radiation unit: "${unit}"`);
}

/** Convert wind speed measured at height z (m) to 2 m. FAO-56 Eq. 47. */
export function windAt2m(uz: number, heightM: number): number {
  return (uz * 4.87) / Math.log(67.8 * heightM - 5.42);
}

// ---------------------------------------------------------------------------
// FAO-56 building blocks
// ---------------------------------------------------------------------------

/** Saturation vapour pressure at air temperature T (degrees C), kPa. FAO-56 Eq. 11. */
export function saturationVapourPressure(tC: number): number {
  return 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));
}

/** Slope of the saturation vapour pressure curve at T (degrees C), kPa/degC. FAO-56 Eq. 13. */
export function vapourPressureSlope(tC: number): number {
  return (4098 * saturationVapourPressure(tC)) / Math.pow(tC + 237.3, 2);
}

/** Atmospheric pressure from elevation, kPa. FAO-56 Eq. 7. */
export function atmosphericPressure(elevM: number): number {
  return 101.3 * Math.pow((293 - 0.0065 * elevM) / 293, 5.26);
}

/** Psychrometric constant, kPa/degC. FAO-56 Eq. 8 (0.665e-3 * P). */
export function psychrometricConstant(pressureKpa: number): number {
  return 0.000665 * pressureKpa;
}

/** Sunset hour angle, radians. FAO-56 Eq. 25 (latitude in radians, declination in radians). */
function sunsetHourAngle(latRad: number, decl: number): number {
  return Math.acos(-Math.tan(latRad) * Math.tan(decl));
}

function declination(doy: number): number {
  // FAO-56 Eq. 24, radians
  return 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
}

/** Extraterrestrial radiation Ra, MJ m-2 day-1. FAO-56 Eq. 21 with Eq. 22 to 25. */
export function extraterrestrialRadiation(latDeg: number, doy: number): number {
  assertLatitude(latDeg);
  const phi = (Math.PI / 180) * latDeg; // Eq. 22
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365); // Eq. 23
  const delta = declination(doy); // Eq. 24
  const ws = sunsetHourAngle(phi, delta); // Eq. 25
  return (
    ((24 * 60) / Math.PI) *
    GSC *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

/** Maximum possible daylight hours N. FAO-56 Eq. 34. */
export function daylightHours(latDeg: number, doy: number): number {
  assertLatitude(latDeg);
  const phi = (Math.PI / 180) * latDeg;
  const ws = sunsetHourAngle(phi, declination(doy));
  return (24 / Math.PI) * ws;
}

/** Solar radiation from sunshine hours (Angstrom, default as/bs). FAO-56 Eq. 35. */
export function solarFromSunshine(sunshineHours: number, latDeg: number, doy: number): number {
  const ra = extraterrestrialRadiation(latDeg, doy);
  const n = daylightHours(latDeg, doy);
  return (0.25 + 0.5 * (sunshineHours / n)) * ra;
}

function assertLatitude(latDeg: number): void {
  if (!Number.isFinite(latDeg) || Math.abs(latDeg) > MAX_ABS_LAT_DEG) {
    throw new RangeError(`Latitude must be within +/-${MAX_ABS_LAT_DEG} degrees, got ${latDeg}`);
  }
}

// ---------------------------------------------------------------------------
// ET0 for one period
// ---------------------------------------------------------------------------

/** FAO-56 Penman-Monteith (Eq. 6) for one period, from mean inputs. Returns mm/day. */
export function et0Day(i: Et0DayInputs): Et0DayResult {
  const tmean = (i.tmaxC + i.tminC) / 2; // Eq. 9
  const p = atmosphericPressure(i.elevM); // Eq. 7
  const gamma = psychrometricConstant(p); // Eq. 8
  const delta = vapourPressureSlope(tmean); // Eq. 13, at mean air temperature

  const es = (saturationVapourPressure(i.tmaxC) + saturationVapourPressure(i.tminC)) / 2; // Eq. 12
  let ea: number;
  if (i.eaKpa !== undefined) {
    ea = i.eaKpa;
  } else if (i.rhMeanPct !== undefined) {
    ea = (es * i.rhMeanPct) / 100; // Eq. 19 (RHmean only; FAO-56 calls this less desirable than Eq. 17)
  } else {
    throw new TypeError('Provide eaKpa or rhMeanPct');
  }

  const ra = extraterrestrialRadiation(i.latDeg, i.dayOfYear); // Eq. 21
  const n = daylightHours(i.latDeg, i.dayOfYear); // Eq. 34
  const rso = (0.75 + 2e-5 * i.elevM) * ra; // Eq. 37
  const rns = (1 - ALBEDO) * i.rsMjM2Day; // Eq. 38
  const relShortwave = Math.min(i.rsMjM2Day / rso, 1.0); // Rs/Rso limited to <= 1.0 (Eq. 39)
  const rnl =
    SIGMA *
    ((Math.pow(i.tmaxC + KELVIN_RNL, 4) + Math.pow(i.tminC + KELVIN_RNL, 4)) / 2) *
    (0.34 - 0.14 * Math.sqrt(ea)) *
    (1.35 * relShortwave - 0.35); // Eq. 39
  const rn = rns - rnl; // Eq. 40

  const denom = delta + gamma * (1 + 0.34 * i.windMs2m);
  const radiationTerm = (MM_PER_MJ * delta * (rn - i.gMjM2Day)) / denom;
  const aerodynamicTerm =
    (gamma * (900 / (tmean + KELVIN_PM)) * i.windMs2m * (es - ea)) / denom;

  return {
    et0MmDay: radiationTerm + aerodynamicTerm, // Eq. 6
    detail: {
      tmeanC: tmean,
      pressureKpa: p,
      gammaKpaC: gamma,
      deltaKpaC: delta,
      esKpa: es,
      eaKpa: ea,
      raMjM2Day: ra,
      daylightHours: n,
      rsoMjM2Day: rso,
      rnsMjM2Day: rns,
      rnlMjM2Day: rnl,
      rnMjM2Day: rn,
      radiationTermMmDay: radiationTerm,
      aerodynamicTermMmDay: aerodynamicTerm,
    },
  };
}

// ---------------------------------------------------------------------------
// ET0 for the twelve months of a climatology
// ---------------------------------------------------------------------------

/**
 * Monthly ET0 from monthly mean inputs. Soil heat flux G uses the previous and
 * next month's mean temperature (FAO-56 Eq. 43), wrapping December to January
 * because the inputs are a 12-month climatology.
 */
export function monthlyEt0(inp: MonthlyEt0Inputs): MonthlyEt0Result {
  const series = [inp.tmaxC, inp.tminC, inp.rhMeanPct, inp.windMs2m, inp.rsMjM2Day];
  if (series.some((s) => s.length !== 12)) {
    throw new RangeError('Every monthly series must have 12 values (January to December)');
  }
  const elevationAssumed = inp.elevM === null;
  const elevM = inp.elevM ?? 0;
  const warnings: string[] = [];
  if (elevationAssumed) {
    warnings.push('Elevation not supplied: sea level (0 m) assumed.');
  }

  const tmean: (number | null)[] = inp.tmaxC.map((tx, m) => {
    const tn = inp.tminC[m];
    return tx === null || tn === null ? null : (tx + tn) / 2;
  });

  const et0MmDay: (number | null)[] = [];
  const et0MmMonth: (number | null)[] = [];

  for (let m = 0; m < 12; m++) {
    const tx = inp.tmaxC[m];
    const tn = inp.tminC[m];
    const rh = inp.rhMeanPct[m];
    const u2 = inp.windMs2m[m];
    const rs = inp.rsMjM2Day[m];
    if (tx === null || tn === null || rh === null || u2 === null || rs === null) {
      et0MmDay.push(null);
      et0MmMonth.push(null);
      warnings.push(`Month ${m + 1}: an input was missing, ET0 not computed.`);
      continue;
    }
    const prev = tmean[(m + 11) % 12];
    const next = tmean[(m + 1) % 12];
    let g = 0;
    if (prev !== null && next !== null) {
      g = 0.07 * (next - prev); // Eq. 43
    } else {
      warnings.push(`Month ${m + 1}: neighbouring month missing, soil heat flux G set to 0.`);
    }
    const r = et0Day({
      tmaxC: tx,
      tminC: tn,
      rhMeanPct: rh,
      windMs2m: u2,
      rsMjM2Day: rs,
      latDeg: inp.latDeg,
      elevM,
      dayOfYear: midMonthDayOfYear(m),
      gMjM2Day: g,
    });
    et0MmDay.push(r.et0MmDay);
    et0MmMonth.push(r.et0MmDay * DAYS_IN_MONTH[m]);
  }

  return { et0MmDay, et0MmMonth, elevationAssumed, warnings };
}
