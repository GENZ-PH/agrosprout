// The detail behind each source for the inspector panel: variables, how the app uses them, and
// the formulas exactly as the code computes them. Every line points at code that exists:
// data/power.ts, data/power-daily.ts, data/srtm.ts, data/et0.ts, engine/waterBalance.ts,
// engine/params.ts, engine/scores.ts, engine/infiltration.ts, engine/soilHealth.ts.
// If a formula changes in the code, change it here too.

import type { SourceKey } from "./sources";

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
      "One request per lot you draw, for the lot centre rounded to 0.1° (community AG, 2001-2025). Lots in the same cell share it. The sample farm's numbers come from the daily data instead (see NASA POWER, daily).",
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
    ],
    how: [
      "One request per lot point for every day of 2001-2025 (about 450 KB), rounded to 0.1°. The sample farm's monthly numbers are built from these daily values by the team's pipeline.",
      "A month with more than 10% of its days missing counts as missing.",
      "Days are counted per month and averaged over the years: very hot, very heavy rain and frost.",
      "Trends in yearly rain, the dry-season shortage and the average daytime high use Sen's slope and the Mann-Kendall test.",
    ],
    formulas: [
      { name: "Very hot day", lines: ["T2M_MAX > 35 °C"] },
      { name: "Very heavy rain day", lines: ["PRECTOTCORR > 50 mm"] },
      { name: "Frost day (ETCCDI FD)", lines: ["T2M_MIN < 0 °C"] },
      { name: "Days per month", lines: ["mean over the years of the count of such days in that month"] },
      { name: "Sen's slope", lines: ["slope = median of (xⱼ − xᵢ) ÷ (j − i) over every pair of years i < j", "per decade = slope × 10"] },
      { name: "Clear trend", lines: ["Mann-Kendall p < 0.05; otherwise the card says no clear trend"] },
    ],
    cite: "NASA POWER daily point API (MERRA-2). Frost-day index: ETCCDI (Karl et al. 1999; Peterson et al. 2001, WMO).",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
  },
  srtm: {
    variables: [{ code: "srtm30m", meaning: "Ground height, 1 arc-second (about 30 m), whole metres" }],
    how: [
      "Nine heights on a 3 × 3 grid, 30 m apart, around the lot centre rounded to 0.001° (about 110 m). On the web the request goes through this site's pass-through, which stores nothing.",
      "The middle height is the field elevation. It sets the air pressure in the evaporation sum.",
      "The slope comes from the nine heights. It sets the RUSLE slope factor in the washout score, except on lowland paddy.",
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
      { code: "NASA POWER", meaning: "T2M, T2M_RANGE, RH2M, WS2M, ALLSKY_SFC_SW_DWN" },
      { code: "NASA SRTM", meaning: "Field elevation, for the air pressure" },
    ],
    how: [
      "Reference evaporation ET₀ is worked out on the phone for every month from the NASA POWER values, at the field's SRTM elevation (sea level if unknown).",
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
      { name: "Water stress index", lines: ["WSI = ΣD ÷ Σneed over the season"], note: "Good fit at WSI ≤ 0.2, Poor fit above 0.6, Watch out in between. The cut-offs are team assumptions to check locally." },
    ],
    cite: "Brouwer, C., Heibloem, M. (1986). Irrigation Water Management Training Manual No. 3: Irrigation Water Needs. FAO.",
    url: "https://www.fao.org/4/s2022e/s2022e08.htm",
  },
  ecocrop: {
    variables: [{ code: "NASA POWER", meaning: "Monthly mean temperature (T2M)" }],
    how: ["Each month of a crop's season is checked against the crop's temperature range from FAO Ecocrop."],
    formulas: [{ name: "Temperature check", lines: ["T = (Tmax + Tmin) ÷ 2", "outside [min, max] → Poor fit", "outside [optimal low, optimal high] → Watch out"] }],
    cite: "FAO Ecocrop database, cited per crop in crops.json.",
  },
  rusle: {
    variables: [{ code: "NASA SRTM", meaning: "Slope in percent" }],
    how: [
      "The washout score weighs the months a field is bare by how heavy the rain is, times a slope factor.",
      "With an SRTM slope and land that is not lowland paddy, the slope factor is the RUSLE S. Otherwise it is set by the land type you gave (lowland 0.3, upland 0.6, sloping 1; assumptions).",
    ],
    formulas: [{ name: "Slope steepness (McCool et al. 1987)", lines: ["θ = arctan(slope % ÷ 100)", "S = 10.8 sin θ + 0.03 if slope < 9 %", "S = 16.8 sin θ − 0.50 if slope ≥ 9 %"] }],
    cite: "Renard, K.G. et al. (2011), USLE and RUSLE, ch. 8 in Handbook of Erosion Modelling, Eq. 8.4-8.5; USDA Agriculture Handbook 703.",
    url: "https://www.tucson.ars.ag.gov/unit/Publications/PDFfiles/2127.pdf",
  },
  tr55: {
    variables: [{ code: "NASA POWER", meaning: "Monthly rain, as the weight for each month" }],
    how: [
      "For a 50 mm storm, how much soaks in when the field is bare or cropped, by soil group (from your soil answer; unknown counts as B).",
      "Months with paddy rice in the field are left out. The year's figure is weighted by each month's rain.",
    ],
    formulas: [{ name: "Curve number runoff (TR-55 eq. 2-1, 2-2, 2-4)", lines: [
      "P = 50 mm ÷ 25.4 (inches)",
      "S = 1000 ÷ CN − 10,  Ia = 0.2 S",
      "Q = (P − Ia)² ÷ (P − Ia + S) if P > Ia, else 0",
      "soaks in = 1 − Q ÷ P",
    ], note: "Curve numbers, bare field: soil group A 77, B 86, C 91, D 94. Cropped: A 72, B 81, C 88, D 91." }],
    cite: "USDA NRCS (1986). Urban Hydrology for Small Watersheds, Technical Release 55.",
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
      { code: "250m_16_days_NDVI", meaning: "Vegetation index, scale factor 0.0001" },
      { code: "250m_16_days_pixel_reliability", meaning: "0 good, 1 marginal, 2 snow or ice, 3 cloudy" },
    ],
    how: [
      "A check on the season: when the ground around the lot greens up and dries out, seen from space.",
      "Composites with good or marginal reliability are kept; cloudy, snow and fill values are dropped.",
      "One pixel is about 230 m across (about 5 ha), larger than the lot, so it mixes the lot with what is around it.",
    ],
    formulas: [
      { name: "NDVI", lines: ["NDVI = (NIR − Red) ÷ (NIR + Red)"], note: "From −1 to +1. Green leaves absorb red light and scatter near-infrared, so more green canopy gives a higher value (MOD13 User Guide V6.1, section 1.2)." },
      { name: "Per calendar month", lines: ["median, P20 and P80 of the kept composites whose 16-day period starts in that month, across all years"] },
    ],
    cite: "Didan, K. (2021). MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. NASA LP DAAC. Accessed through the ORNL DAAC MODIS Land Product Subsets service.",
    url: "https://lpdaac.usgs.gov/products/mod13q1v061/",
  },
  shi: {
    variables: [{ code: "Scores", meaning: "Builds soil (S) and Protects from washout (E), 0-100" }],
    how: ["Every plan starts at 50. Its year is assumed to repeat, so the line moves the same amount each year until it hits 0 or 100.", "A relative indicator for comparing plans on one lot, not a soil test."],
    formulas: [{ name: "Each year", lines: ["SHI = clamp(SHI before + 10 × S ÷ 100 − 10 × (1 − E ÷ 100), 0, 100)"], note: "The start of 50 is the team spec; the two 10s are assumptions to check locally." }],
  },
  oni: {
    how: ["Shown as context for this season only. The results use 25 years of records, not a forecast."],
    url: "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
  },
  osm: {
    how: ["Road distance from the lot to a harvest place, divided by a speed for the way you travel. Your own travel time always wins. Offline, a straight-line estimate is used."],
    url: "https://routing.openstreetmap.de/",
  },
};
