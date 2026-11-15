// NASA GIBS overlays for the dashboard's farm map: one at a time over the lots.
// Both the map page (map-src/main.ts, the tiles) and the app (FarmMapCard, the legend) import
// this file, so keep it free of React Native imports.
//
// Every value below was read from the GIBS WMTS capabilities on 2026-11-15
// (https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml) and one real
// tile per layer was fetched (HTTP 200, image/png). Each date is the layer's <Default> (latest)
// time that day, or one day before it for daily swath layers, so the whole area is covered.
// GIBS keeps old dates, so a fixed date keeps working; move it forward the same way.
// Colors and value labels come from each layer's GIBS color map (colormaps/v1.3/*.xml).

export type OverlayId = "ndvi" | "rain" | "soil-moisture" | "lst";

export interface GibsOverlay {
  /** Short tab label in the app. */
  tab: string;
  /** GIBS layer identifier. */
  layer: string;
  /** The GIBS layer title, as shown in the capabilities. */
  title: string;
  /** Satellite product, for the legend and the map credit. */
  product: string;
  /** Time used in the tile URL, YYYY-MM-DD. */
  date: string;
  /** How the date reads in the legend. */
  dateLabel: string;
  tileMatrixSet: string;
  /** Deepest GIBS zoom (the TileMatrixSet level). Leaflet scales it up at farm zoom. */
  maxNativeZoom: number;
  /** Units as the GIBS color map gives them, in words. */
  units: string;
  /** A few colors from the GIBS color map, low to high, for the legend bar. */
  stops: readonly string[];
  /** Value at each end of the legend bar, from the GIBS color map. */
  low: string;
  high: string;
  /** What the colors mean, in plain words, from the GIBS color map's order. */
  meaning: string;
  /** One hedged sentence on how the layer can help a farmer. */
  helps: string;
  /** The GIBS legend image (listed in the capabilities). */
  legendUrl: string;
}

export const GIBS_HOST = "https://gibs.earthdata.nasa.gov";

export const GIBS_OVERLAYS: Record<OverlayId, GibsOverlay> = {
  ndvi: {
    tab: "Greenness",
    layer: "MODIS_Terra_NDVI_8Day",
    title: "Vegetation Index (rolling 8-Day, MODIS, Terra)",
    product: "MODIS Terra NDVI, 8-day",
    date: "2026-11-13",
    dateLabel: "8 days to 13 Nov 2026",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    maxNativeZoom: 9,
    units: "NDVI, no units (0 to 1)",
    stops: ["#F1ECEC", "#B4A596", "#96BA20", "#2E8001", "#001801"],
    low: "0",
    high: "1",
    meaning: "Brown = bare or dry ground, darker green = more green plants.",
    helps: "Shows how green the land around your lot has been lately; a lot paler than its neighbours may be dry, bare or newly planted.",
    legendUrl: `${GIBS_HOST}/legends/MODIS_NDVI_H.svg`,
  },
  rain: {
    tab: "Rain",
    layer: "IMERG_Precipitation_Rate",
    title: "Precipitation Rate (IMERG)",
    product: "GPM IMERG precipitation rate",
    date: "2026-11-13",
    dateLabel: "13 Nov 2026",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    units: "mm per hour",
    stops: ["#00764E", "#45C000", "#FF980F", "#DA0000", "#330000"],
    low: "0.1",
    high: "53+",
    meaning: "Green = light rain, orange to dark red = heavy rain. No color = no rain shown.",
    helps: "Shows where rain was falling on that day, to compare with the rain the plan expects for this month.",
    legendUrl: `${GIBS_HOST}/legends/GPM_Precipitation_Rate_H.svg`,
  },
  "soil-moisture": {
    tab: "Soil moisture",
    layer: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture",
    title: "Root Zone Soil Moisture (L4, 12z Instantaneous, Model Value-Added, SMAP)",
    product: "SMAP L4 root zone soil moisture",
    date: "2026-11-10",
    dateLabel: "10 Nov 2026",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    units: "m³ of water per m³ of soil",
    stops: ["#FFA200", "#82C100", "#00FFFF", "#0000B7", "#000064"],
    low: "0",
    high: "0.59",
    meaning: "Orange = dry soil, blue = wet soil.",
    helps: "Shows how wet the soil is around your lot lately, to help judge whether it is a good time to plant.",
    legendUrl: `${GIBS_HOST}/legends/SMAP_Analyzed_Soil_Moisture_H.svg`,
  },
  lst: {
    tab: "Land temp",
    layer: "MODIS_Terra_Land_Surface_Temp_Day",
    title: "Land Surface Temperature (Day, MODIS, Terra)",
    product: "MODIS Terra land surface temperature, day",
    date: "2026-11-14",
    dateLabel: "14 Nov 2026 (daytime)",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    maxNativeZoom: 7,
    units: "kelvin (K)",
    stops: ["#C900FF", "#0047FF", "#66FF12", "#FFBE00", "#FF0100"],
    low: "200 K",
    high: "350 K",
    meaning: "Blue = cooler ground, red = hotter ground. Gaps are clouds or no satellite pass.",
    helps: "Shows how hot the ground got in the daytime, a hint of heat stress for crops and of soil drying out.",
    legendUrl: `${GIBS_HOST}/legends/MODIS_Land_Surface_Temp_H.svg`,
  },
};

export const OVERLAY_IDS = Object.keys(GIBS_OVERLAYS) as OverlayId[];

/** Leaflet tile URL template for an overlay (GIBS WMTS REST, EPSG:3857). */
export function gibsTileUrl(o: GibsOverlay): string {
  return `${GIBS_HOST}/wmts/epsg3857/best/${o.layer}/default/${o.date}/${o.tileMatrixSet}/{z}/{y}/{x}.png`;
}
