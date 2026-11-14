// Engine v0 parameters (D27). The ONLY place for engine coefficients.
// Every value has a source, or the label "assumption: validate locally"
// (CLAUDE.md rules 3 and 9). Changing a value here must not need code
// changes anywhere else. Validated at the 20:00 sanity review (#32).

// ---------------------------------------------------------------------------
// Water balance (docs/07-rotation-engine.md §2)
// ---------------------------------------------------------------------------

/**
 * Effective rainfall, FAO/AGLW monthly rule:
 *   Pe = 0.8 P - 25  if P > 75 mm/month
 *   Pe = 0.6 P - 10  if P <= 75 mm/month, never below 0
 * Source: Brouwer, C., Heibloem, M. 1986. Irrigation Water Management
 * Training Manual No. 3: Irrigation Water Needs. FAO. Section 4.2,
 * https://www.fao.org/4/s2022e/s2022e08.htm
 * The manual says the formulae apply to slopes of at most 4-5% (stated as a
 * limitation for sloping lots).
 */
export const EFFECTIVE_RAIN = {
  thresholdMm: 75,
  highSlope: 0.8,
  highOffsetMm: 25,
  lowSlope: 0.6,
  lowOffsetMm: 10,
} as const;

/**
 * Day of the month a crop is planted when the farmer gives only a month.
 * assumption: validate locally. Mid-month, the same convention et0.ts uses
 * for the monthly radiation terms (FAO-56 Chapter 3).
 */
export const PLANTING_DAY_OF_MONTH = 15;

/** Mean days per month, 365 / 12 (definition, common year). */
export const MEAN_DAYS_PER_MONTH = 365 / 12;

/**
 * The farmer's own plant-to-harvest duration is used when it is within
 * +/-30% of the crop's season length; otherwise the crop's season length.
 * Source: team spec, docs/07-rotation-engine.md §3b. assumption: validate locally.
 */
export const FARMER_SEASON_TOLERANCE = 0.3;

/**
 * Kc climate adjustment (FAO-56 Eq. 62 and 65) is NOT applied in v0.
 * Why: it needs crop height h, which crops.json does not have. crops.json
 * meta notes the Table 12 values are for a sub-humid standard climate
 * (RHmin about 45%, u2 about 2 m/s). In a humid, low-wind climate the
 * adjustment lowers Kc mid and Kc end, so v0 slightly OVERestimates crop
 * water need (errs toward showing more stress). Team decision (#23).
 */
export const KC_CLIMATE_ADJUSTMENT = false;

/**
 * A month is in the stress window (chart shading) when its deficit is more
 * than this share of the month's water need.
 * Source: team spec, docs/07-rotation-engine.md §2. assumption: validate locally.
 */
export const STRESS_WINDOW_DEFICIT_SHARE = 0.25;

/**
 * Crops grown ponded (lowland paddy). These get the rice allowance from
 * crops.json `rice_extra_detail` (Brouwer & Heibloem 1986, Section 4.4):
 * percolation + seepage while ponded, soil saturation for puddling once in
 * the month before planting, and the water layer once in the planting month.
 */
export const PONDED_CROP_IDS: readonly string[] = ["lowland-rice"];

/**
 * Soil feel -> percolation class in crops.json `rice_extra_detail`.
 * Source: Brouwer & Heibloem 1986, Section 4.4 (heavy clay 4, average 6,
 * sandy 8 mm/day). "loamy" and "unknown" use the manual's average.
 */
export const RICE_PERCOLATION_CLASS = {
  clayey: "heavy_clay",
  loamy: "average",
  sandy: "sandy",
  unknown: "average",
} as const;

/**
 * Share of the monthly rain deficit covered by irrigation, by the farmer's
 * water-source answer. "full" = full irrigation covers the deficit by
 * definition; "rain" and "unknown" = none.
 * "some" = 0.5 is an assumption: validate locally (no source for a typical
 * supplemental amount; ask the agricultural technician at the 20:00 review).
 */
export const IRRIGATION_DEFICIT_SHARE = {
  rain: 0,
  some: 0.5,
  full: 1,
  unknown: 0,
} as const;

// ---------------------------------------------------------------------------
// Crop fit: Good fit / Watch out / Poor fit (docs/11-user-flow.md, S3 card)
// ---------------------------------------------------------------------------

/**
 * Water stress index (WSI = sum of deficit / sum of need, 0-1) cut-offs,
 * typical year (P50).
 * - Good fit at or below WSI_GOOD_MAX. assumption: validate locally.
 * - Poor fit above WSI_POOR_MIN. Same value as the hard filter in
 *   docs/07-rotation-engine.md §3 ("WSI > 0.6 in the P50 scenario with no
 *   irrigation"). assumption: validate locally.
 * - In between: Watch out. Also Watch out when a dry year (P20) goes above
 *   WSI_POOR_MIN even though a typical year is fine.
 */
export const WSI_GOOD_MAX = 0.2;
export const WSI_POOR_MIN = 0.6;

/**
 * Temperature check uses the monthly mean temperature, (Tmax + Tmin) / 2,
 * against the crop's FAO Ecocrop range (crops.json `temp_c`):
 * outside [min, max] = Poor fit; outside [opt_low, opt_high] = Watch out.
 * Source of ranges: FAO Ecocrop (cited per crop in crops.json).
 * Comparing monthly means is a method choice. assumption: validate locally.
 */
export const TEMP_CHECK = "monthly-mean" as const;

/**
 * Waterlogging: a crop with LOW waterlogging tolerance gets Watch out when
 * any month of its season has NASA POWER root-zone wetness (GWETROOT, 0-1)
 * at or above this value. assumption: validate locally; calibrate on the
 * demo site (docs/07-rotation-engine.md §3). At the Iligan test point the
 * monthly means run 0.74-0.97, so the cut-off has to sit high.
 */
export const WATERLOG_WETNESS_MIN = 0.9;
