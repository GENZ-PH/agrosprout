// One list of every data source and method the app uses, so each ⓘ panel names a source the
// same way: the same name, what it measures, how coarse it is and which years. Explainers point
// at these by key (explainers.ts `sources`); the Data and limits page lists the full detail.
// Every line here repeats what the code and citations already say; nothing new is claimed.

export type SourceKey =
  | "power"
  | "power-daily"
  | "srtm"
  | "fao56"
  | "brouwer"
  | "ecocrop"
  | "crop-library"
  | "osm"
  | "farmer"
  | "shi"
  | "imerg"
  | "smap"
  | "modis";

export interface SourceTag {
  /** Short name, the same everywhere in the app. */
  name: string;
  /** Who publishes it. NASA sources say NASA so a judge can spot them. */
  by: string;
  /** What it gives this app. */
  gives: string;
  /** Resolution, or "method" for a method or table. */
  scale: string;
  /** Years, or `{period}` for the years of a lot's own data. */
  years: string;
  nasa: boolean;
}

export const SOURCES: Readonly<Record<SourceKey, SourceTag>> = {
  power: {
    name: "NASA POWER, monthly",
    by: "NASA Langley (MERRA-2 weather model, CERES sunshine)",
    gives: "Rain, temperature, humidity, wind, sunshine, root-zone soil wetness",
    scale: "0.5° × 0.625° cell, about 50 km (sunshine 1° × 1°)",
    years: "{period}",
    nasa: true,
  },
  "power-daily": {
    name: "NASA POWER, daily",
    by: "NASA Langley (MERRA-2 weather model, CERES sunshine)",
    gives: "The sample farm's climate, built from daily values, and its heavy-rain days",
    scale: "0.5° × 0.625° cell, about 50 km (sunshine 1° × 1°)",
    years: "{period}",
    nasa: true,
  },
  srtm: {
    name: "NASA SRTM v3",
    by: "NASA JPL, Shuttle Radar Topography Mission",
    gives: "Sample farm elevation and slope",
    scale: "About 30 m",
    years: "February 2000",
    nasa: true,
  },
  fao56: {
    name: "FAO-56",
    by: "Allen and others, 1998",
    gives: "Evaporation (Penman-Monteith) and crop water use",
    scale: "Method",
    years: "1998",
    nasa: false,
  },
  brouwer: {
    name: "FAO Training Manual No. 3",
    by: "Brouwer and Heibloem, 1986",
    gives: "Effective rain and paddy water needs",
    scale: "Method",
    years: "1986",
    nasa: false,
  },
  ecocrop: {
    name: "FAO Ecocrop",
    by: "FAO",
    gives: "Temperature range each crop tolerates",
    scale: "Per crop",
    years: "Database values",
    nasa: false,
  },
  "crop-library": {
    name: "Crop library",
    by: "Team, each value cited in crops.json",
    gives: "Season length, planting calendar, crop traits",
    scale: "Per crop",
    years: "See each citation",
    nasa: false,
  },
  osm: {
    name: "OpenStreetMap routing",
    by: "© OpenStreetMap contributors, FOSSGIS server",
    gives: "Road distance to a harvest place",
    scale: "Points rounded to about 100 m",
    years: "Current road map",
    nasa: false,
  },
  imerg: {
    name: "NASA GPM IMERG",
    by: "NASA GES DISC (GPM IMERG Final, V07)",
    gives: "Satellite rain, monthly, to check the NASA POWER rain",
    scale: "0.1° cell, about 11 km",
    years: "2001 to 2025-09",
    nasa: true,
  },
  smap: {
    name: "NASA SMAP L4",
    by: "NASA NSIDC DAAC (SPL4SMGP, Version 8)",
    gives: "Soil moisture at the surface and in the root zone",
    scale: "9 km cell",
    years: "2015-04 to 2025-12",
    nasa: true,
  },
  modis: {
    name: "NASA MODIS NDVI",
    by: "NASA LP DAAC (MOD13Q1 v061), via ORNL DAAC",
    gives: "How green the ground is, every 16 days",
    scale: "About 250 m pixel",
    years: "No data file bundled yet",
    nasa: true,
  },
  shi: {
    name: "Soil health index",
    by: "This app (docs/07-rotation-engine.md §4)",
    gives: "A relative soil-health line per plan over three years",
    scale: "Per plan",
    years: "Three years ahead",
    nasa: false,
  },
  farmer: {
    name: "Your answers",
    by: "You",
    gives: "Your lots, crops, months and goals",
    scale: "Your farm",
    years: "Now",
    nasa: false,
  },
};
