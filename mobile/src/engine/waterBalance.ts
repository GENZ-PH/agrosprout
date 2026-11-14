// FAO-56 monthly water balance per crop season (docs/07-rotation-engine.md §2, #23).
// Pure TypeScript (no React Native imports).
//
// Per calendar month the crop occupies:
//   ETc   = Kc(stage) x ET0, over the crop's days in that month (FAO-56 Eq. 56, 66)
//   need  = ETc + ponded-rice allowance (percolation/seepage, land prep, water layer)
//   Peff  = effective rain (Brouwer & Heibloem 1986, §4.2), over the crop's days
//   Irr   = irrigation share x max(0, need - Peff)
//   D     = max(0, need - Peff - Irr)
// WSI = sum(D) / sum(need), 0 = no stress, 1 = fully unmet. For non-rice crops
// need = ETc, so this is the spec's sum(D) / sum(ETc); for ponded rice the
// allowance is part of the need so WSI stays within 0-1.
import { DAYS_IN_MONTH } from "../data/et0";
import type { Crop, LotDetails, LotMonthly, RiceExtraDetail } from "../types";
import {
  EFFECTIVE_RAIN,
  IRRIGATION_DEFICIT_SHARE,
  KC_CLIMATE_ADJUSTMENT,
  PONDED_CROP_IDS,
  RICE_PERCOLATION_CLASS,
  STRESS_WINDOW_DEFICIT_SHARE,
} from "./params";
import { addMonths, harvestMonthOf, seasonMonths } from "./season";

export type Scenario = "p20" | "p50" | "p80";

/** Assumptions behind a result, for the "unknowns" part of the explanation (#28). */
export type WaterAssumption =
  | "planting-mid-month"
  | "kc-not-climate-adjusted"
  | "irrigation-share-assumed"
  | "water-source-unknown"
  | "soil-unknown-average-percolation";

export interface WaterMonth {
  /** Calendar month, 1-12. */
  month: number;
  /** Crop days in this month (0 for the rice land-preparation month). */
  crop_days: number;
  /** Mean Kc over the crop days; `null` for the land-preparation month. */
  kc: number | null;
  /** ET0 over the crop days, mm. */
  et0_mm: number;
  /** Crop evapotranspiration over the crop days, mm. */
  etc_mm: number;
  /** Ponded-rice allowance this month, mm (0 for other crops). */
  rice_extra_mm: number;
  /** ETc + rice allowance, mm. */
  need_mm: number;
  /** Effective rain over the crop days (whole month for land preparation), mm. */
  peff_mm: number;
  irrigation_mm: number;
  deficit_mm: number;
  /** In the stress window: deficit > STRESS_WINDOW_DEFICIT_SHARE x need. */
  stress: boolean;
}

export interface WaterBalance {
  crop_id: string;
  scenario: Scenario;
  plant_month: number;
  harvest_month: number;
  season_days: number;
  months: WaterMonth[];
  need_mm: number;
  peff_mm: number;
  deficit_mm: number;
  /** Water stress index, 0-1. */
  wsi: number;
  /** Calendar months in the stress window. */
  stress_months: number[];
  assumptions: WaterAssumption[];
}

export type WaterBalanceOutcome =
  | { ok: true; result: WaterBalance }
  | { ok: false; reason: "no-crop-water-data" }
  | { ok: false; reason: "missing-climate"; missing_months: number[] };

export interface WaterBalanceInput {
  crop: Crop;
  plantMonth: number;
  seasonDays: number;
  monthly: Pick<LotMonthly, "precip_mm" | "et0_mm">;
  details: Pick<LotDetails, "soil" | "water">;
  /** crops.json `rice_extra_detail`; needed only for ponded crops. */
  riceDetail: RiceExtraDetail | null;
  scenario: Scenario;
}

/** Effective rain for one month, mm (Brouwer & Heibloem 1986, §4.2). Never negative. */
export function effectiveRain(precipMm: number): number {
  const r = EFFECTIVE_RAIN;
  const pe =
    precipMm > r.thresholdMm
      ? r.highSlope * precipMm - r.highOffsetMm
      : r.lowSlope * precipMm - r.lowOffsetMm;
  return Math.max(0, pe);
}

export function isPonded(crop: Crop): boolean {
  return PONDED_CROP_IDS.includes(crop.id);
}

export function waterBalance(input: WaterBalanceInput): WaterBalanceOutcome {
  const { crop, plantMonth, seasonDays, monthly, details, riceDetail, scenario } = input;
  if (!crop.kc || !crop.stages_days) return { ok: false, reason: "no-crop-water-data" };
  const ponded = isPonded(crop) && riceDetail !== null;

  const occupied = seasonMonths(plantMonth, seasonDays, crop.stages_days, crop.kc);
  const prepMonth = addMonths(plantMonth, -1);
  const neededMonths = ponded ? [prepMonth, ...occupied.map((m) => m.month)] : occupied.map((m) => m.month);
  const precip = monthly.precip_mm[scenario];
  const missing = [...new Set(neededMonths)].filter(
    (m) => precip[m - 1] == null || monthly.et0_mm[m - 1] == null,
  );
  if (missing.length) return { ok: false, reason: "missing-climate", missing_months: missing };

  const share = IRRIGATION_DEFICIT_SHARE[details.water];
  const percMmDay = ponded ? riceDetail.percolation_seepage_mm_per_day[RICE_PERCOLATION_CLASS[details.soil]] : 0;

  const months: WaterMonth[] = [];
  const row = (month: number, cropDays: number, kc: number | null, riceExtra: number): WaterMonth => {
    const dim = DAYS_IN_MONTH[month - 1];
    const frac = cropDays === 0 ? 1 : cropDays / dim; // land prep uses the whole month's rain
    const et0 = (monthly.et0_mm[month - 1] as number) * (cropDays / dim);
    const etc = kc === null ? 0 : kc * et0;
    const need = etc + riceExtra;
    const peff = effectiveRain(precip[month - 1] as number) * frac;
    const gap = Math.max(0, need - peff);
    const irrigation = share * gap;
    const deficit = gap - irrigation;
    return {
      month,
      crop_days: cropDays,
      kc,
      et0_mm: et0,
      etc_mm: etc,
      rice_extra_mm: riceExtra,
      need_mm: need,
      peff_mm: peff,
      irrigation_mm: irrigation,
      deficit_mm: deficit,
      stress: need > 0 && deficit > STRESS_WINDOW_DEFICIT_SHARE * need,
    };
  };

  if (ponded) months.push(row(prepMonth, 0, null, riceDetail.land_prep_saturation_mm_once));
  occupied.forEach((m, i) => {
    let extra = 0;
    if (ponded) {
      extra = percMmDay * m.days;
      if (i === 0) extra += riceDetail.water_layer_establishment_mm_once;
    }
    months.push(row(m.month, m.days, m.kcMean, extra));
  });

  const sum = (k: keyof Pick<WaterMonth, "need_mm" | "peff_mm" | "deficit_mm">) =>
    months.reduce((a, m) => a + m[k], 0);
  const needMm = sum("need_mm");
  const deficitMm = sum("deficit_mm");

  const assumptions: WaterAssumption[] = ["planting-mid-month"];
  if (!KC_CLIMATE_ADJUSTMENT) assumptions.push("kc-not-climate-adjusted");
  if (details.water === "some") assumptions.push("irrigation-share-assumed");
  if (details.water === "unknown") assumptions.push("water-source-unknown");
  if (ponded && details.soil === "unknown") assumptions.push("soil-unknown-average-percolation");

  return {
    ok: true,
    result: {
      crop_id: crop.id,
      scenario,
      plant_month: plantMonth,
      harvest_month: harvestMonthOf(plantMonth, seasonDays),
      season_days: seasonDays,
      months,
      need_mm: needMm,
      peff_mm: sum("peff_mm"),
      deficit_mm: deficitMm,
      wsi: needMm > 0 ? deficitMm / needMm : 0,
      stress_months: months.filter((m) => m.stress).map((m) => m.month),
      assumptions,
    },
  };
}

/** Dry year (P20), typical year (P50) and wet year (P80) for the same season. */
export function waterBalanceRange(
  input: Omit<WaterBalanceInput, "scenario">,
): Record<Scenario, WaterBalanceOutcome> {
  return {
    p20: waterBalance({ ...input, scenario: "p20" }),
    p50: waterBalance({ ...input, scenario: "p50" }),
    p80: waterBalance({ ...input, scenario: "p80" }),
  };
}
