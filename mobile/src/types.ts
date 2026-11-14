// Shared data contracts (Engine + Data). Change by PR only (D22).
// Frozen at Checkpoint 1 (#4). Source of the shapes: docs/06-architecture.md
// "Data contracts", plus the crop library shape used by `crops.json` (#11)
// and the optional additions proposed in docs/03-data-sources.md (#3).
//
// Conventions
// - Monthly series: 12 values, index 0 = January. `null` = missing
//   (NASA POWER `-999`, or not computed).
// - Calendar months in seasons and calendars: 1 = January ... 12 = December.
// - Coordinates are GeoJSON order: [lon, lat], decimal degrees (WGS84).
// - Units are in the field name (`_mm`, `_c`, `_ha`, `_km`, `_pct`) or in the
//   comment next to it.
// - Optional / unknown values are `null`, never 0 or -999.
//
// The engine (`src/engine/`), the live fetch (`src/data/power.ts`) and the
// pipeline (`pipeline/build_demo.py`) all follow this file. Do not keep a
// second copy of these shapes anywhere.

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** [lon, lat] in decimal degrees (GeoJSON order). */
export type LonLat = [number, number];

/** 12 monthly values, index 0 = January. `null` = missing. */
export type MonthlySeries = (number | null)[];

/** Calendar month, 1 = January ... 12 = December. */
export type MonthNumber = number;

/** Where a derived value came from. Every derived field gets one entry. */
export interface Provenance {
  /** Field this entry describes, e.g. "monthly.precip_mm". */
  field: string;
  /** Dataset and variable, e.g. "NASA POWER PRECTOTCORR". */
  source: string;
  /** Native resolution of the source, e.g. "0.5° x 0.625°". */
  native_res: string;
  /** Period the value summarizes, e.g. "2001-2024". */
  period: string;
  /** ISO date the data was retrieved, e.g. "2026-11-14". */
  retrieved: string;
  /** Optional method note, e.g. "FAO-56 Penman-Monteith from monthly means". */
  note?: string;
}

// ---------------------------------------------------------------------------
// Farm (AsyncStorage key `farm`, on the device only; D12)
// ---------------------------------------------------------------------------

export type LandType = "lowland" | "upland" | "sloping" | "unknown";
/** rain = rain only · some = some irrigation · full = full irrigation. */
export type WaterSource = "rain" | "some" | "full" | "unknown";
export type SoilFeel = "sandy" | "loamy" | "clayey" | "unknown";

/** Optional lot details from the farmer (#41). "unknown" lowers confidence. */
export interface LotDetails {
  land_type: LandType;
  water: WaterSource;
  soil: SoilFeel;
}

/** One growing season of a crop on a lot. Months are 1-12; may wrap the year (11 → 2). */
export interface CropSeason {
  plant_month: MonthNumber;
  harvest_month: MonthNumber;
}

export interface LotCrop {
  /** `Crop.id` in crops.json. */
  crop_id: string;
  /** Empty = months not given yet: the engine uses `Crop.typical_calendar`, labeled "assumed". */
  seasons: CropSeason[];
}

export type DataStatus = "ready" | "pending" | "error";

/** farmer = farmer's own time · route = OSRM road route · estimate = straight line x circuity (07 §3c). */
export type TravelSource = "farmer" | "route" | "estimate";
export type RouteProfile = "car" | "bike" | "foot";

/** Travel from one lot to one destination (S6). */
export interface Travel {
  destination_id: string;
  /** Road or estimated distance, km. `null` when the farmer typed only a time. */
  distance_km: number | null;
  /** One-way travel time, minutes. */
  minutes: number;
  source: TravelSource;
  /** OSRM profile used when `source` is "route", else `null`. */
  route_profile: RouteProfile | null;
}

export interface Lot {
  /** Stable id, e.g. "lot-1". */
  id: string;
  /** Display name, e.g. "Lot 1". */
  name: string;
  geometry: { type: "Polygon"; coordinates: LonLat[][] };
  /** Horizontal (map) area from the drawn polygon (turf.area, no elevation or slope), hectares. D31 (#107). */
  area_ha: number;
  centroid: LonLat;
  details: LotDetails;
  crops: LotCrop[];
  data_status: DataStatus;
  /** Storage key of this lot's climate data: `lotdata:<lotId>` or `demo/<farmId>`. */
  data_ref: string;
  /** One entry per destination, filled when the farmer adds a place (S6). */
  travel: Travel[];
  /**
   * Proposed in docs/03 (#3), optional: PSA Geolocation province code picked
   * by the farmer, e.g. "80" (Lanao del Norte). `null` or absent = not given.
   */
  province_code?: string | null;
}

export type DestinationType = "market" | "storage" | "buyer" | "coop";
export type TransportMode =
  | "walk"
  | "carabao"
  | "bicycle"
  | "motorcycle"
  | "tricycle"
  | "jeepney"
  | "truck";

/** A harvest destination, added any time from the dashboard or Edit farm (S6, D20). */
export interface Destination {
  id: string;
  name: string;
  type: DestinationType;
  point: LonLat;
  mode: TransportMode;
  /** Farmer's load per trip, kg. `null` = "I don't know" (use the assumed default in params.ts). */
  load_kg_per_trip: number | null;
  /** One-way fare, PHP. `null` = not given; never guessed. */
  fare_one_way: number | null;
}

/** Priority sliders, each 0-100. Defaults are all equal (50). */
export interface Priorities {
  water: number;
  soil: number;
  income: number;
  labor: number;
}

export interface Farm {
  /** Shape version, for migrations in the farm store (#18). */
  version: 1;
  lots: Lot[];
  destinations: Destination[];
  priorities: Priorities;
}

// ---------------------------------------------------------------------------
// Lot climate data: `lotdata:<lotId>` (live, #6) and `demo/<farm>.json`
// (pipeline, #8) share this one shape.
// ---------------------------------------------------------------------------

export interface PrecipPercentiles {
  /** Dry year: 20th percentile across years, mm per month. */
  p20: MonthlySeries;
  /** Typical year: median across years, mm per month. */
  p50: MonthlySeries;
  /** Wet year: 80th percentile across years, mm per month. */
  p80: MonthlySeries;
}

export interface LotMonthly {
  /** Precipitation (POWER PRECTOTCORR, mm/day x days in month), mm per month. */
  precip_mm: PrecipPercentiles;
  /** Reference evapotranspiration, FAO-56 (src/data/et0.ts), mm per month. */
  et0_mm: MonthlySeries;
  /**
   * Mean daily maximum temperature, °C. Demo farms: mean of daily POWER T2M_MAX.
   * Live lots: POWER T2M + T2M_RANGE/2, because the monthly T2M_MAX is the
   * hottest day of the month, not the mean daily maximum (docs/03).
   */
  tmax_c: MonthlySeries;
  /**
   * Mean daily minimum temperature, °C. Demo farms: mean of daily POWER T2M_MIN.
   * Live lots: POWER T2M - T2M_RANGE/2 (monthly T2M_MIN is the coldest day).
   */
  tmin_c: MonthlySeries;
  /** Root-zone soil wetness (POWER GWETROOT), 0-1. */
  rootzone_wetness: MonthlySeries;
  /** Mean relative humidity at 2 m (POWER RH2M), %. Kept so ET0 can be recomputed. */
  rh2m_pct: MonthlySeries | null;
  /** Mean wind speed at 2 m (POWER WS2M), m/s. */
  ws2m_ms: MonthlySeries | null;
  /** Mean incoming solar radiation (POWER ALLSKY_SFC_SW_DWN), MJ m-2 day-1. */
  solar_mj_m2_day: MonthlySeries | null;
  /** Demo farms only (daily POWER): mean days per month with Tmax > 35 °C. `null` for live lots. */
  heat_days_gt35: MonthlySeries | null;
  /** Demo farms only (daily POWER): mean days per month with rain > 50 mm. `null` for live lots. */
  heavy_rain_days_gt50mm: MonthlySeries | null;
  /** Demo farms only (AppEEARS SMAP L4, #5): root-zone soil moisture, m3/m3. */
  smap_rootzone_m3m3: MonthlySeries | null;
}

/** Long-term trends, demo farms only (pipeline). */
export interface LotTrends {
  annual_precip_mm_per_decade: number | null;
  dry_season_deficit_mm_per_decade: number | null;
  tmax_c_per_decade: number | null;
  /** e.g. "Sen's slope / Mann-Kendall". */
  method: string;
  /** Mann-Kendall p-value per trend field name. */
  p_values: Record<string, number>;
}

export interface LotData {
  /** Lot id (live) or demo farm id, e.g. "lanao-norte-demo-1". */
  id: string;
  /** Display name for demo farms; `null` for live lots (use `Lot.name`). */
  name: string | null;
  /** live = fetched on the device per lot · demo = precomputed and bundled. */
  kind: "live" | "demo";
  /** Point the data was requested for. Live lots: centroid rounded to 0.1° (privacy, rule 8). */
  lat: number;
  lon: number;
  /** SRTM elevation, m (#9). `null` = unknown: ET0 used sea level and a caveat says so. */
  elevation_m: number | null;
  /** SRTM-derived slope, %. `null` when unknown (use `LotDetails.land_type`). */
  slope_pct: number | null;
  /** Live lots: the point sent to SRTM, the lot centre rounded to 0.001° (~110 m, rule 8). */
  srtm_point?: [number, number] | null;
  /** Live lots: the NASA POWER grid cell's average elevation, m, from the POWER answer. */
  cell_elevation_m?: number | null;
  /** Years summarized, e.g. "2001-2024". */
  period: string;
  monthly: LotMonthly;
  /** `null` for live lots. */
  trends: LotTrends | null;
  provenance: Provenance[];
  /** Plain-language caveats shown with the data, e.g. the POWER grid-cell note. */
  caveats: string[];
}

// ---------------------------------------------------------------------------
// Crop library: `mobile/assets/data/crops.json` (#11)
// Every numeric value is cited in `sources`; values that could not be
// checked are `null` and listed in `unverified`.
// ---------------------------------------------------------------------------

export type Level = "low" | "medium" | "high";

export interface CropCalendarSlot {
  plant_month: MonthNumber;
  harvest_month: MonthNumber;
}

export interface CropSource {
  /** Which fields this citation covers, e.g. "root_depth_m, p_depletion". */
  field_or_fields: string;
  citation: string;
  url?: string;
}

export interface Crop {
  id: string;
  name: string;
  /** Cebuano name, e.g. "Humay". */
  local_name: string | null;
  family: string;
  /** Days from planting to harvest. */
  season_days: number | null;
  /** FAO-56 Table 11 stage lengths [ini, dev, mid, late], days. Rescale to `season_days`. */
  stages_days: [number, number, number, number] | null;
  /** FAO-56 Table 12 single crop coefficients [Kc ini, Kc mid, Kc end]. */
  kc: [number, number, number] | null;
  /** FAO-56 Table 22 maximum effective rooting depth [min, max], m. */
  root_depth_m: [number, number] | null;
  /** FAO-56 Table 22 depletion fraction p, 0-1. */
  p_depletion: number | null;
  /** FAO Ecocrop temperature range, °C: TMIN, TOPMN, TOPMX, TMAX. */
  temp_c: { min: number; opt_low: number; opt_high: number; max: number } | null;
  drought_tolerance: Level | null;
  waterlogging_tolerance: Level | null;
  n_fixing: boolean | null;
  labor: Level | null;
  market: Level | null;
  cover_value: Level | null;
  /** high = days · medium = 1-3 weeks · low = months (07 §3c). */
  perishability: Level | null;
  storable_if_dried: boolean | null;
  /** Typical regional yield, t/ha (PSA OpenSTAT where cited). */
  yield_t_per_ha: number | null;
  /** Typical local planting calendar; empty = unknown. */
  typical_calendar: CropCalendarSlot[];
  sources: CropSource[];
  /** Field names whose values could not be verified (left `null`). */
  unverified: string[];
  notes: string;
  /** Proposed in docs/03 (#3), optional: PSA table group for local yields. */
  psa_group?: "palay" | "corn" | null;
}

/** Ponded-rice water allowance details (FAO Training Manual No. 3, §4.4). */
export interface RiceExtraDetail {
  /** Percolation + seepage while ponded, mm/day, by soil. */
  percolation_seepage_mm_per_day: { heavy_clay: number; average: number; sandy: number };
  /** Soil saturation for puddling, mm, once (month before transplanting). */
  land_prep_saturation_mm_once: number;
  /** Establishing the water layer, mm, once (transplanting month). */
  water_layer_establishment_mm_once: number;
  how_rice_extra_mm_was_derived: string;
  citation: string;
  url: string;
}

/** Typical total available water per metre of roots, mm/m (FAO-56 Table 19). */
export interface TawRange {
  min: number;
  max: number;
  fao_texture_class?: string;
}

export interface CropLibrary {
  meta: Record<string, unknown>;
  /** Average ponded-rice percolation + seepage, mm per month. */
  rice_extra_mm: number | null;
  rice_extra_detail: RiceExtraDetail | null;
  taw_mm_per_m: {
    sandy: TawRange;
    loamy: TawRange;
    clayey: TawRange;
    citation: string;
    url: string;
  };
  crops: Crop[];
}

// ---------------------------------------------------------------------------
// Proposed in docs/03 (#3), optional bundled files. The engine must work
// without them.
// ---------------------------------------------------------------------------

/** `mobile/assets/data/psa/yields.json` (pipeline, #10). */
export interface PsaCropYield {
  year: number;
  production_t: number | null;
  area_ha: number | null;
  yield_t_per_ha: number | null;
}

export interface PsaYields {
  source: string;
  retrieved: string;
  /** Keyed by PSA Geolocation province code. */
  provinces: Record<
    string,
    { name: string; palay: PsaCropYield | null; corn: PsaCropYield | null }
  >;
}

/** `mobile/assets/data/context.json` (pipeline, #10). Context for a "why now" line; not an engine input. */
export interface ClimateContext {
  oni: {
    season: string;
    year: number;
    anomaly_c: number | null;
    source: string;
    url: string;
    retrieved: string;
  } | null;
  advisory: {
    issuer: string;
    title: string;
    issued: string;
    summary_by_hand: string;
    url: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Storage keys (AsyncStorage; `localStorage` on web)
// ---------------------------------------------------------------------------

export const FARM_STORAGE_KEY = "farm";

/** AsyncStorage key for a live lot's climate data. */
export function lotDataKey(lotId: string): string {
  return `lotdata:${lotId}`;
}
