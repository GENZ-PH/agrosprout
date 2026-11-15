// The detail behind each source for the inspector panel: variables, how the app uses them, and
// the formulas exactly as the code computes them. Every line points at code that exists:
// data/power.ts, data/et0.ts, engine/waterBalance.ts, engine/params.ts, engine/scores.ts,
// engine/cropFit.ts, engine/soilHealth.ts, and for the sample farm pipeline/build_demo.py,
// pipeline/aggregate.py, pipeline/fetch_srtm.py, pipeline/fetch_imerg.py, pipeline/fetch_smap.py,
// pipeline/fetch_appeears.py (MODIS, HLS, ECOSTRESS), pipeline/fetch_fldas.py.
// If a formula changes in the code, change it here too.

import type { SourceKey } from "./sources";

/** Methods that work on each NASA dataset: their formulas show in that dataset's panel. */
export const METHODS_ON: Readonly<Partial<Record<SourceKey, readonly SourceKey[]>>> = {
  power: ["fao56", "brouwer", "ecocrop"],
  "power-daily": ["fao56", "brouwer", "ecocrop"],
  srtm: ["fao56"],
};

export interface SourceDetail {
  variables?: readonly { code: string; meaning: string }[];
  how: readonly string[];
  formulas?: readonly { name: string; lines: readonly string[]; note?: string }[];
  cite?: string;
  url?: string;
}

export const SOURCE_DETAILS: Readonly<Partial<Record<SourceKey, SourceDetail>>> = {
  power: {
    variables: [
      { code: "PRECTOTCORR", meaning: "Rain, bias-corrected, mm per day" },
      { code: "T2M", meaning: "Air temperature at 2 m, monthly mean, °C" },
      { code: "T2M_RANGE", meaning: "Daily temperature range at 2 m, °C" },
      { code: "RH2M", meaning: "Relative humidity at 2 m, %" },
      { code: "WS2M", meaning: "Wind speed at 2 m, m/s" },
      { code: "ALLSKY_SFC_SW_DWN", meaning: "Sunshine reaching the ground (CERES), converted to MJ/m²/day" },
      { code: "GWETROOT", meaning: "Root-zone soil wetness, 0 dry to 1 saturated" },
    ],
    how: [
      "One request per lot you draw, for the lot centre rounded to 0.1° (community AG, 2001-2025). Lots in the same grid cell get the same numbers. The sample farm's numbers come from the daily data instead (see NASA POWER, daily).",
      "Rain becomes millimetres per month for every year, then a dry, typical and wet year: the 20th, 50th and 80th percentile across the years.",
      "Temperature, humidity, wind and sunshine go into the FAO-56 evaporation sum; the crop's need follows from it.",
      "The monthly mean temperature is checked against each crop's FAO Ecocrop range.",
      "Root-zone wetness at or above 0.9 flags waterlogging for crops with low waterlogging tolerance.",
    ],
    formulas: [
      { name: "Rain per month", lines: ["P = PRECTOTCORR × days in that month of that year"] },
      { name: "Dry, typical and wet year", lines: ["P20, P50, P80 = 20th, 50th, 80th percentile of P across the years (linear interpolation)"] },
      { name: "Daily high and low", lines: ["Tmax ≈ T2M + T2M_RANGE ÷ 2", "Tmin ≈ T2M − T2M_RANGE ÷ 2"], note: "About 0.5 °C off the true daily means. The sample farm uses the daily highs and lows instead." },
      { name: "Waterlogging flag", lines: ["GWETROOT ≥ 0.9 in a month of the season, crop with low waterlogging tolerance → Watch out"] },
    ],
    cite: "NASA Langley Research Center POWER Project, monthly point API, community AG. Weather from MERRA-2, sunshine from CERES SYN1deg.",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/monthly/",
  },
  "power-daily": {
    variables: [
      { code: "T2M_MAX", meaning: "Daily highest air temperature at 2 m, °C" },
      { code: "T2M_MIN", meaning: "Daily lowest air temperature at 2 m, °C" },
      { code: "PRECTOTCORR", meaning: "Daily rain, mm" },
      { code: "RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT", meaning: "Daily humidity, wind, sunshine and root-zone wetness, as for the monthly data" },
    ],
    how: [
      "Sample farm only. The team's pipeline fetched every day of 2001-2025 for the farm point once, and the results are bundled with the app. The phone never asks for daily data.",
      "Monthly rain is the sum of the daily rain, scaled up to the whole month when a few days are missing; a month with more than 10% of days missing is left out. Highs, lows, humidity, wind, sunshine and root-zone wetness are the mean of the daily values.",
      "A month with more than 10% of its days missing counts as missing.",
      "Very heavy rain days are counted per month and averaged over the years. They weigh each month in the washout score.",
    ],
    formulas: [
      { name: "Very heavy rain day", lines: ["PRECTOTCORR > 50 mm"] },
      { name: "Days per month", lines: ["mean over the years of the count of such days in that month"] },
    ],
    cite: "NASA POWER daily point API, community AG. Weather from MERRA-2, sunshine from CERES SYN1deg.",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
  },
  srtm: {
    variables: [{ code: "srtm30m", meaning: "Ground height, 1 arc-second (about 30 m), whole metres" }],
    how: [
      "Sample farm only. The team's pipeline asked once for nine heights on a 3 × 3 grid, 30 m apart, around the farm point, and the results are bundled with the app. Lots you draw have no SRTM data yet.",
      "The middle height is the field elevation. It sets the air pressure in the evaporation sum. Without it, sea level is used.",
      "The slope comes from the nine heights and is kept with the sample farm, but no score uses it yet. The washout score uses the land type you give.",
    ],
    formulas: [
      { name: "Slope (Horn 1981)", lines: [
        "dz/dx = ((c + 2f + i) − (a + 2d + g)) ÷ (8 × 30 m)",
        "dz/dy = ((g + 2h + i) − (a + 2b + c)) ÷ (8 × 30 m)",
        "slope % = 100 × √(dz/dx² + dz/dy²)",
      ], note: "Heights a b c / d e f / g h i, north row first, 30 m apart. Rounded to a whole percent: SRTM heights are whole metres, so this is a rough terrain class." },
      { name: "Air pressure (FAO-56 Eq. 7)", lines: ["P = 101.3 × ((293 − 0.0065 z) ÷ 293)^5.26 kPa, z = field elevation in m"] },
    ],
    cite: "NASA JPL (2013), NASA Shuttle Radar Topography Mission Global 1 arc second v3, NASA LP DAAC, doi:10.5067/MEASURES/SRTM/SRTMGL1.003, served by Open Topo Data.",
    url: "https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003",
  },
  fao56: {
    variables: [
      { code: "NASA POWER", meaning: "T2M, T2M_RANGE, RH2M, WS2M, ALLSKY_SFC_SW_DWN (sample farm: daily T2M_MAX and T2M_MIN instead of T2M and T2M_RANGE)" },
      { code: "NASA SRTM", meaning: "Field elevation, for the air pressure (sample farm only)" },
    ],
    how: [
      "Reference evaporation ET₀ is worked out for every month from the NASA POWER values: on the phone for lots you draw, by the team's pipeline with the same method for the sample farm.",
      "Lots you draw use sea level for the air pressure. The sample farm uses its SRTM elevation.",
      "Each crop's water use is ET₀ times its crop coefficient Kc for the growth stage, over the crop's days in that month.",
      "The Kc climate adjustment is not applied (crop height is not in the library), so water need is slightly overestimated.",
    ],
    formulas: [
      { name: "Penman-Monteith (Eq. 6)", lines: [
        "ET₀ = [0.408 Δ (Rn − G) + γ × 900 ÷ (T + 273) × u₂ × (es − ea)] ÷ [Δ + γ (1 + 0.34 u₂)]",
      ], note: "T is the mean temperature and u₂ the wind at 2 m (WS2M). Rn is net radiation from the sunshine value (Eq. 38-40), G the soil heat flux (Eq. 43). es comes from Tmax and Tmin (Eq. 11-12), ea from RH2M (Eq. 19), Δ is the slope of the vapour curve (Eq. 13) and γ follows from the air pressure (Eq. 8)." },
      { name: "Crop water use (Eq. 56)", lines: ["ETc = Kc(stage) × ET₀"] },
    ],
    cite: "Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration. FAO Irrigation and Drainage Paper 56.",
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
  },
  brouwer: {
    variables: [{ code: "NASA POWER", meaning: "PRECTOTCORR, as millimetres per month" }],
    how: [
      "Not all rain reaches the roots. Effective rain is worked out per month from NASA POWER rain.",
      "The shortage is the crop's need minus effective rain minus any irrigation you said you have.",
      "Lowland rice also needs water for percolation, land soaking and the standing water layer.",
    ],
    formulas: [
      { name: "Effective rain (§4.2)", lines: ["Pe = 0.8 P − 25 if P > 75 mm/month", "Pe = 0.6 P − 10 if P ≤ 75 mm/month, never below 0"] },
      { name: "Monthly shortage", lines: [
        "need = ETc (+ paddy allowance for lowland rice)",
        "Irr = share × max(0, need − Pe)",
        "D = max(0, need − Pe − Irr)",
      ], note: "Irrigation share by your answer: rain only 0, some 0.5 (an assumption), full 1." },
      { name: "Water stress index", lines: ["WSI = ΣD ÷ Σneed over the season"], note: "Good fit at WSI ≤ 0.2, Poor fit above 0.6, Watch out in between. Also Watch out when the typical year is fine but the dry year (P20) is above 0.6. A water answer of \"not sure\" counts as rain only. The cut-offs are team assumptions to check locally." },
    ],
    cite: "Brouwer, C., Heibloem, M. (1986). Irrigation Water Management Training Manual No. 3: Irrigation Water Needs. FAO.",
    url: "https://www.fao.org/4/s2022e/s2022e08.htm",
  },
  ecocrop: {
    variables: [{ code: "NASA POWER", meaning: "Monthly mean temperature, from the monthly highs and lows" }],
    how: ["Each month of a crop's season is checked against the crop's temperature range from FAO Ecocrop."],
    formulas: [{ name: "Temperature check", lines: ["T = (Tmax + Tmin) ÷ 2", "outside [min, max] → Poor fit", "outside [optimal low, optimal high] → Watch out"] }],
    cite: "FAO Ecocrop database, cited per crop in crops.json.",
  },
  imerg: {
    variables: [{ code: "precipitation", meaning: "Merged satellite and gauge rain, average rate over the month, mm/hr" }],
    how: [
      "A check, not an input: the results still use NASA POWER rain. IMERG is shown beside it so you can see how far two NASA rain estimates agree here.",
      "Fetched once by the team's pipeline and bundled for the sample farm. The farm point sits on the corner of four IMERG cells, so each month is the mean of those four.",
      "Monthly files end at 2025-09, so October to December have one year fewer.",
    ],
    formulas: [
      { name: "Rain per month", lines: ["P = rate (mm/hr) × 24 × days in that month"], note: "The file gives an average rate over the calendar month (IMERG Technical Documentation, 2023, Table 2)." },
      { name: "Dry, typical and wet year", lines: ["P20, P50, P80 = percentiles of P across years for each calendar month"] },
    ],
    cite: "Huffman, G.J., Stocker, E.F., Bolvin, D.T., Nelkin, E.J., Tan, J. (2023), GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07, GES DISC, doi:10.5067/GPM/IMERG/3B-MONTH/07.",
    url: "https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary",
  },
  smap: {
    variables: [
      { code: "sm_surface", meaning: "Soil water in the top 0-5 cm, m³/m³" },
      { code: "sm_rootzone", meaning: "Soil water in the top 0-100 cm, m³/m³" },
    ],
    how: [
      "A check, not an input: the results use NASA POWER root-zone wetness. SMAP shows the same season from a satellite-assisted model.",
      "Sampled by the team's pipeline: the 11:00-14:00 Philippine time average on 6 days of every month, 2015 to 2025, all 774 samples valid.",
      "SMAP gives water per volume of soil; NASA POWER GWETROOT is a share of saturation. They are different numbers and are not plotted together.",
    ],
    formulas: [{ name: "Per calendar month", lines: ["month value = mean of the samples in that year-month", "shown = mean, P20 and P80 of those values across years"] }],
    cite: "Reichle, R. et al. (2025). SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data (SPL4SMGP, Version 8). NASA NSIDC DAAC, doi:10.5067/T5RUATAQREF8.",
    url: "https://nsidc.org/data/spl4smgp/versions/8",
  },
  modis: {
    variables: [
      { code: "_250m_16_days_NDVI", meaning: "Vegetation index, -0.2 to 1; higher means greener" },
      { code: "_250m_16_days_pixel_reliability", meaning: "Quality: 0 good, 1 marginal, 2 snow or ice, 3 cloudy" },
      { code: "_250m_16_days_composite_day_of_the_year", meaning: "Day the pixel was seen" },
    ],
    how: [
      "A check, not an input: the scores do not use it. Fetched once by the team's pipeline through NASA AppEEARS for the sample farm point and bundled with the app.",
      "Only composites with pixel reliability 0 (good) are kept; 353 of the 575 composites from 2001 to 2025 pass. Each one counts in the month it was seen.",
      "A 250 m pixel mixes the lot with its neighbours; a small lot may differ.",
    ],
    formulas: [{ name: "Per calendar month", lines: ["month value = mean of the good composites in that year-month", "shown = P20, P50 and P80 of those values across years"] }],
    cite: "MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid, MOD13Q1 Collection 6.1 (061). NASA LP DAAC, doi:10.5067/MODIS/MOD13Q1.061. Accessed through NASA AppEEARS, 2026-11-14.",
    url: "https://doi.org/10.5067/MODIS/MOD13Q1.061",
  },
  hls: {
    variables: [
      { code: "NDVI", meaning: "Vegetation index from HLSL30_VI (Landsat) and HLSS30_VI (Sentinel-2), -1 to 1" },
      { code: "Fmask", meaning: "Cloud, cloud shadow and snow flags from HLSL30 and HLSS30" },
    ],
    how: [
      "A check, not an input: the scores do not use it. Fetched once by the team's pipeline through NASA AppEEARS for the sample farm point and bundled with the app.",
      "An overpass is kept only when Fmask shows no cloud, adjacent cloud or shadow, cloud shadow or snow. Water is kept, since a flooded paddy is a real field state. 388 of 1,018 overpasses pass.",
      "Landsat and Sentinel-2 are pooled. Early years have fewer overpasses (Sentinel-2 from late 2015, Landsat 9 from late 2021).",
    ],
    formulas: [{ name: "Per calendar month", lines: ["month value = mean of the clear overpasses in that year-month", "shown = P20, P50 and P80 of those values across years"] }],
    cite: "Harmonized Landsat Sentinel-2 Vegetation Indices HLSL30_VI and HLSS30_VI v2.0, with Fmask from HLSL30 and HLSS30 v2.0. NASA LP DAAC, doi:10.5067/HLS/HLSL30_VI.002, doi:10.5067/HLS/HLSS30_VI.002, doi:10.5067/HLS/HLSL30.002, doi:10.5067/HLS/HLSS30.002. Accessed through NASA AppEEARS, 2026-11-14.",
    url: "https://doi.org/10.5067/HLS/HLSL30_VI.002",
  },
  ecostress: {
    variables: [
      { code: "ESI", meaning: "Evaporative Stress Index (ECO_L4T_ESI), 0 high stress to 1 no stress" },
      { code: "ETdaily", meaning: "Daily evapotranspiration (ECO_L3T_JET), mm/day, sunrise to sunset" },
    ],
    how: [
      "A check, not an input: the scores work out evaporation from NASA POWER with FAO-56. Fetched once by the team's pipeline through NASA AppEEARS for the sample farm point and bundled with the app.",
      "A value is kept only when the product's own cloud and water layers are 0. ECOSTRESS flies on the space station, so overpass times vary and a month can have no clear sample: 54 samples from 2018-09 to 2026-09, none in February.",
      "Cloudy (often rainy) days are missing, so the samples lean toward dry, sunny days.",
    ],
    formulas: [{ name: "Per calendar month", lines: ["month value = mean of the clear samples in that year-month", "shown = P20, P50 and P80 of those values across years"] }],
    cite: "ECOSTRESS Tiled L4 Evaporative Stress Index PT-JPL (ECO_L4T_ESI, v002), doi:10.5067/ECOSTRESS/ECO_L4T_ESI.002, and ECOSTRESS Tiled L3 Evapotranspiration (ECO_L3T_JET, v002), doi:10.5067/ECOSTRESS/ECO_L3T_JET.002. NASA LP DAAC. Accessed through NASA AppEEARS, 2026-11-14.",
    url: "https://doi.org/10.5067/ECOSTRESS/ECO_L4T_ESI.002",
  },
  fldas: {
    variables: [
      { code: "SoilMoi00_10cm_tavg", meaning: "Soil water, 0-10 cm, m³/m³" },
      { code: "SoilMoi10_40cm_tavg", meaning: "Soil water, 10-40 cm, m³/m³" },
      { code: "Evap_tavg", meaning: "Evapotranspiration, kg m⁻² s⁻¹" },
      { code: "Rainf_f_tavg", meaning: "Rain (CHIRPS forcing), kg m⁻² s⁻¹" },
      { code: "Qs_tavg, Qsb_tavg", meaning: "Surface and subsurface runoff, kg m⁻² s⁻¹" },
    ],
    how: [
      "A check, not an input: the scores do not use it. A land surface model run (Noah 3.6.1, forced by MERRA-2 weather and CHIRPS rain), not a measurement. Fetched once by the team's pipeline and bundled for the sample farm.",
      "The farm point sits on a cell corner, so each month is the mean of the 3 touching cells that have values in every month.",
      "Its rain is the CHIRPS forcing, so it will not match NASA POWER or GPM IMERG exactly.",
    ],
    formulas: [
      { name: "Water per month", lines: ["mm = rate (kg m⁻² s⁻¹) × 86400 × days in that month", "runoff = surface + subsurface"] },
      { name: "Dry, typical and wet year", lines: ["P20, P50, P80 = percentiles across 2001-2025 for each calendar month"] },
    ],
    cite: "Amy McNally, NASA/GSFC/HSL (2018), FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 degree (MERRA-2 and CHIRPS), Greenbelt, MD, USA, Goddard Earth Sciences Data and Information Services Center (GES DISC), Accessed 2026-11-14, 10.5067/5NHC22T9375G",
    url: "https://disc.gsfc.nasa.gov/datacollection/FLDAS_NOAH01_C_GL_M_001.html",
  },
  shi: {
    variables: [{ code: "Scores", meaning: "Builds soil (S) and Protects from washout (E), 0-100" }],
    how: ["Every plan starts at 50. Its year is assumed to repeat, so the line moves the same amount each year until it hits 0 or 100.", "A relative indicator for comparing plans on one lot, not a soil test."],
    formulas: [{ name: "Each year", lines: ["SHI = clamp(SHI before + 10 × S ÷ 100 − 10 × (1 − E ÷ 100), 0, 100)"], note: "The start of 50 is the team spec; the two 10s are assumptions to check locally." }],
  },
  osm: {
    how: ["Road distance from the lot to a harvest place, divided by a speed for the way you travel. Your own travel time always wins. Offline, a straight-line estimate is used."],
    url: "https://routing.openstreetmap.de/",
  },
};
