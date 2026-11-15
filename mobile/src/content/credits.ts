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
    name: "GeoNames",
    lines: ["Towns and cities for the place search on the map, kept on your phone: nothing you type is sent. Town names and positions: GeoNames (CC BY 4.0)."],
    url: "https://www.geonames.org/",
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

export const METHOD_CREDITS: readonly CreditItem[] = [
  {
    name: "FAO-56 (crop water need)",
    lines: ["Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration: guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56. Penman-Monteith ET0, crop coefficients, stage lengths, rooting depth and depletion fraction."],
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
  },
  {
    name: "FAO Training Manual No. 3 (effective rain)",
    lines: ["Brouwer, C., Heibloem, M. (1986). Irrigation Water Management Training Manual No. 3: Irrigation Water Needs. FAO. Effective rainfall and the extra water paddy rice needs."],
    url: "https://www.fao.org/4/s2022e/s2022e08.htm",
  },
  { name: "FAO Ecocrop (crop temperature ranges)", lines: ["Each value is cited per crop in the crop library."], url: "https://gaez.fao.org/pages/ecocrop" },
  { name: "Kader (1993)", lines: ["Perishability classes for market access, where cited in the crop library."] },
];

export const SERVICE_CREDITS: readonly CreditItem[] = [
  {
    name: "NASA POWER API",
    lines: ["Called once per lot with the lot centre rounded to 0.1 degree."],
    url: "https://power.larc.nasa.gov/docs/services/api/",
  },
  {
    name: "Anthropic Claude API (SI notes)",
    lines: ["Called only by our API Worker with the app's results (no location, no lot shape, no names). Model claude-opus-5-5. Terms: Anthropic Commercial Terms and Usage Policy."],
    url: "https://www.anthropic.com/legal/commercial-terms",
  },
  {
    name: "Wikipedia and Wikimedia Commons",
    lines: ["Pictures for crops found by search. Only the crop's scientific name is sent."],
    url: "https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy",
  },
  {
    name: "FOSSGIS routing server (OpenStreetMap)",
    lines: ["Travel time to harvest places. Points rounded to about 100 m. Routing © OpenStreetMap contributors (ODbL)."],
    url: "https://routing.openstreetmap.de/about.html",
  },
  {
    name: "Open Topo Data (pipeline only)",
    lines: ["SRTM elevation for the sample farm, fetched once by the team's pipeline. The app never calls it."],
    url: "https://www.opentopodata.org/",
  },
];

export const BUILD_CREDITS: readonly CreditItem[] = [
  { name: "TypeScript", lines: ["Apache-2.0. Type checking."], url: "https://www.typescriptlang.org" },
  { name: "esbuild", lines: ["MIT. Bundles the offline map page."], url: "https://esbuild.github.io" },
  { name: "ESLint and eslint-config-expo", lines: ["MIT. Linting."], url: "https://eslint.org" },
  { name: "Workbox", lines: ["MIT. Service worker for the installable web app."], url: "https://developer.chrome.com/docs/workbox" },
  { name: "Node.js test runner", lines: ["MIT. Engine and data tests."], url: "https://nodejs.org" },
  { name: "Zod and @hono/zod-validator", lines: ["MIT. Checks requests in the API Worker."], url: "https://zod.dev" },
  { name: "EAS Build (Expo)", lines: ["Android builds. Expo terms."], url: "https://expo.dev/eas" },
  { name: "Cloudflare Pages, Workers and Wrangler", lines: ["Web hosting and the API Worker. Wrangler: MIT or Apache-2.0. Cloudflare terms."], url: "https://www.cloudflare.com" },
  { name: "GitHub", lines: ["Code, issues and pull requests. GitHub terms."], url: "https://github.com" },
  { name: "Python 3 standard library", lines: ["The data pipeline. No third-party Python packages."], url: "https://www.python.org" },
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
