// "What if" climate scenario: drier / wetter and warmer, recomputed on the device (#47).
// Pure TypeScript (no React Native imports). This is a what-if, NOT a forecast.
//
// How the lot's monthly climate is changed:
//   rain         precipitation P20/P50/P80 are multiplied by (1 + rain_pct / 100)
//   temperature  tmax and tmin are both raised by temp_c
//   ET0          recomputed with FAO-56 (src/data/et0.ts) at the warmer temperature and scaled
//                to the stored ET0: stored x (scenario / baseline), both from the same method,
//                so temp_c = 0 leaves ET0 exactly as it was and a different method behind the
//                stored value does not shift the result
//   unchanged    relative humidity, wind, sunshine, root-zone wetness and the daily-only fields
//                (heat days, heavy-rain days) are held at the baseline. Their change under a
//                warmer climate is not modelled here.
import { monthlyEt0 } from "../data/et0";
import type { LotData, MonthlySeries } from "../types";
import { SCENARIO_RANGE } from "./params";

export interface Scenario {
  /** Rainfall change, percent (SCENARIO_RANGE.rain_pct). */
  rain_pct: number;
  /** Temperature rise, degrees C (SCENARIO_RANGE.temp_c). */
  temp_c: number;
}

export interface ScenarioResult {
  monthly: LotData["monthly"];
  /** False when humidity, wind or sunshine is missing: ET0 then stays at the baseline. */
  et0_recomputed: boolean;
  /** Plain-language notes for the "what if" label (what changed and what was held fixed). */
  notes: string[];
}

const scale = (s: MonthlySeries, f: number): MonthlySeries => s.map((v) => (v === null ? null : v * f));
const shift = (s: MonthlySeries, d: number): MonthlySeries => s.map((v) => (v === null ? null : v + d));

function checkRange(name: string, v: number, r: { min: number; max: number }) {
  if (!Number.isFinite(v) || v < r.min || v > r.max) {
    throw new RangeError(`${name} must be between ${r.min} and ${r.max}`);
  }
}

/** Lot climate under a what-if scenario. Returns a new `monthly`; the input is not changed. */
export function applyScenario(
  data: Pick<LotData, "lat" | "elevation_m" | "monthly">,
  scenario: Scenario,
): ScenarioResult {
  checkRange("rain_pct", scenario.rain_pct, SCENARIO_RANGE.rain_pct);
  checkRange("temp_c", scenario.temp_c, SCENARIO_RANGE.temp_c);
  const m = data.monthly;
  const f = 1 + scenario.rain_pct / 100;

  const precip_mm = { p20: scale(m.precip_mm.p20, f), p50: scale(m.precip_mm.p50, f), p80: scale(m.precip_mm.p80, f) };
  const tmax_c = shift(m.tmax_c, scenario.temp_c);
  const tmin_c = shift(m.tmin_c, scenario.temp_c);

  let et0_mm: MonthlySeries = m.et0_mm;
  let et0_recomputed = false;
  const notes: string[] = [];
  if (scenario.temp_c !== 0 && m.rh2m_pct && m.ws2m_ms && m.solar_mj_m2_day) {
    const common = {
      rhMeanPct: m.rh2m_pct,
      windMs2m: m.ws2m_ms,
      rsMjM2Day: m.solar_mj_m2_day,
      latDeg: data.lat,
      elevM: data.elevation_m,
    };
    const base = monthlyEt0({ ...common, tmaxC: m.tmax_c, tminC: m.tmin_c }).et0MmMonth;
    const warm = monthlyEt0({ ...common, tmaxC: tmax_c, tminC: tmin_c }).et0MmMonth;
    et0_mm = m.et0_mm.map((stored, i) => {
      const b = base[i];
      const w = warm[i];
      return stored === null || b === null || w === null || b <= 0 ? stored : stored * (w / b);
    });
    et0_recomputed = true;
  } else if (scenario.temp_c !== 0) {
    notes.push("Humidity, wind or sunshine data is missing, so evapotranspiration was not changed for the warmer climate.");
  }

  if (scenario.rain_pct !== 0 || scenario.temp_c !== 0) {
    notes.push(
      `What-if scenario, not a forecast: rainfall ${scenario.rain_pct >= 0 ? "+" : ""}${scenario.rain_pct}%, temperature +${scenario.temp_c} °C.`,
    );
    notes.push("Humidity, wind, sunshine and soil wetness are kept at today's values.");
  }

  return {
    monthly: { ...m, precip_mm, tmax_c, tmin_c, et0_mm },
    et0_recomputed,
    notes,
  };
}
