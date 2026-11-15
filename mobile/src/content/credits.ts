// Text for the Licenses and credits screen (app/credits.tsx). Every line repeats what THIRD_PARTY.md
// and the code already say; nothing new is claimed. If THIRD_PARTY.md changes, change this too.

import { SOURCE_DETAILS } from "./source-details";

export interface CreditItem {
  name: string;
  lines: readonly string[];
  url?: string;
}

/** Full list of everything the project uses, with versions and licenses. */
export const THIRD_PARTY_URL = "https://github.com/GENZ-PH/agrosprout/blob/main/THIRD_PARTY.md";

const cite = (key: keyof typeof SOURCE_DETAILS) => SOURCE_DETAILS[key]?.cite ?? "";
const link = (key: keyof typeof SOURCE_DETAILS) => SOURCE_DETAILS[key]?.url;

export const NASA_CREDITS: readonly CreditItem[] = [
  {
    name: "NASA POWER (climate for every lot)",
    lines: [cite("power"), cite("power-daily")],
    url: "https://power.larc.nasa.gov/docs/services/api/",
  },
  { name: "NASA SRTM (sample farm elevation and slope)", lines: [cite("srtm")], url: link("srtm") },
  { name: "NASA GPM IMERG (sample farm rain check)", lines: [cite("imerg")], url: link("imerg") },
  { name: "NASA SMAP L4 (sample farm soil moisture check)", lines: [cite("smap")], url: link("smap") },
  { name: "NASA MODIS NDVI (sample farm greenness check)", lines: [cite("modis")], url: link("modis") },
  { name: "NASA HLS NDVI (sample farm greenness check)", lines: [cite("hls")], url: link("hls") },
  { name: "NASA ECOSTRESS (sample farm water stress check)", lines: [cite("ecostress")], url: link("ecostress") },
  { name: "NASA FLDAS (sample farm land model check)", lines: [cite("fldas")], url: link("fldas") },
];

export const OTHER_DATA_CREDITS: readonly CreditItem[] = [
  {
    name: "FAO Ecocrop",
    lines: ["Crop temperature ranges and the crop names in the search. Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop."],
    url: "https://github.com/OpenCLIM/ecocrop",
  },
  {
    name: "FAO-56 and FAO Training Manual No. 3",
    lines: [cite("fao56"), cite("brouwer")],
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
  },
  {
    name: "Natural Earth",
    lines: ["Land and lakes for the \"looks like water\" warning. Made with Natural Earth (public domain)."],
    url: "https://www.naturalearthdata.com/",
  },
  {
    name: "OpenStreetMap road routing",
    lines: ["Travel time to harvest places. Routing © OpenStreetMap contributors (ODbL), through the FOSSGIS routing server."],
    url: "https://www.openstreetmap.org/copyright",
  },
  {
    name: "Bundled, not shown yet",
    lines: ["PSA OpenSTAT crop production tables (Philippine Statistics Authority) and the NOAA Climate Prediction Center Oceanic Niño Index."],
  },
];

export const MAP_CREDITS: readonly CreditItem[] = [
  {
    name: "Esri World Imagery (for now)",
    lines: [
      "The satellite map behind your lots. Its credit is always shown on the map: \"Tiles © Esri, Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community\".",
      "This is a placeholder. The team has not chosen the map yet (decision D25 is open) and has not checked the terms of each option.",
    ],
  },
  {
    name: "Leaflet, Terra Draw, Turf.js",
    lines: ["The map and drawing tools. Leaflet (BSD-2-Clause), Terra Draw and Turf.js (MIT)."],
    url: "https://leafletjs.com",
  },
];

export const ARTWORK_CREDITS: readonly CreditItem[] = [
  {
    name: "AgroSprout logo and app icon",
    lines: ["The team's own artwork: the logo, app icon, splash screen and web icons."],
  },
  { name: "Icons", lines: ["Lucide icons, ISC license."], url: "https://lucide.dev" },
  { name: "Fonts", lines: ["The phone's own system font. No font files are bundled."] },
];

export const SOFTWARE_CREDITS: readonly CreditItem[] = [
  {
    name: "Main libraries",
    lines: [
      "Expo and expo-router, React, React Native, React Native Web, react-native-webview, react-native-svg, AsyncStorage, NetInfo, TanStack Query, Zustand and Hono: MIT.",
      "React Native Chart Kit: MIT (with paths-js, Apache-2.0). Lucide: ISC.",
      "Leaflet: BSD-2-Clause. Terra Draw and Turf.js: MIT.",
    ],
  },
  {
    name: "Full list",
    lines: ["Every library, data set and service with its version and license is in THIRD_PARTY.md in the project's code."],
    url: THIRD_PARTY_URL,
  },
];

export const SI_CREDITS: readonly CreditItem[] = [
  {
    name: "Claude by Anthropic",
    lines: [
      "Claude Code helped the team with research, documents and code. Every use is logged in the project (docs/si-usage-log.md). The team made the ideas and decisions.",
      "\"In plain words\" on the suggestion card sends the suggested plan's results (no location, no lot shape, no names) to Claude and shows its answer labeled as written by SI. During a what-if it is the \"Explain this plan with SI\" button.",
    ],
    url: "https://www.anthropic.com",
  },
];
