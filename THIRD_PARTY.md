# Third-party data, services, libraries, and assets

Everything this project uses that the team didn't make, with its license or terms. Versions are the ones installed on 2026-11-14 (`mobile/package.json`, `api/package.json`). "Not checked" means nobody on the team has read the terms yet; fix those before submitting (#52).

**This file is the source for the Space Apps project form's References field** ("Space Agency Partner Data & Other References" in `docs/submission/fields.md`). The challenge rules ask us to list every external resource we use there: code, data, text and images. Anything added to the app must be added here first, then copied to the form.

**In the app:** the **Licenses and credits** screen (`mobile/app/credits.tsx`, text in `mobile/src/content/credits.ts`), linked as "Credits" in the dashboard footer, from Data and limits, and as "Photo credits" on the crop screen (S2), repeats the credits below for farmers and judges.

Contents: [NASA data](#nasa-data) · [Other data](#other-data) · [Methods and references](#methods-and-references) · [Online services the app calls](#online-services-the-app-calls) · [App libraries](#app-libraries) · [Map libraries](#bundled-map-libraries-mobilemap-src-built-into-one-offline-html-file) · [Build and test tools](#build-and-test-tools) · [API Worker](#api-worker-api) · [Pipeline](#pipeline-pipeline) · [Images, icons, and fonts](#images-icons-and-fonts) · [SI tools](#si-tools)

## NASA data

| Data | How we get it | What ships | Terms |
|---|---|---|---|
| **NASA POWER**, monthly point API (Agroclimatology community), 2001–2025 | The app calls it once per lot, centroid rounded to 0.1° (`mobile/src/data/power.ts`) | Nothing bundled; saved on the phone per lot | https://power.larc.nasa.gov/docs/services/api/ (not checked for a citation line) |
| **NASA POWER**, daily point API, 2001–2025 | The pipeline, for the demo farm (`pipeline/fetch_power.py`) | `mobile/assets/data/demo/lanao-norte-demo-1.json` | Same as above |
| **NASA GPM IMERG** Final Precipitation L3 1 month 0.1° V07, 2001 to 2025-09 | The pipeline, for the demo farm (`pipeline/fetch_imerg.py`) | `mobile/assets/data/demo/lanao-norte-demo-1-imerg.json` (shown in Satellite checks, not used in scores) | Cite: Huffman, G.J., Stocker, E.F., Bolvin, D.T., Nelkin, E.J., Tan, J. (2023), GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07, GES DISC, doi:10.5067/GPM/IMERG/3B-MONTH/07 (https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary). Terms not checked line by line |
| **NASA SMAP L4** soil moisture, SPL4SMGP Version 8, 2015-04 to 2025-12 | The pipeline, for the demo farm (`pipeline/fetch_smap.py`) | `mobile/assets/data/demo/lanao-norte-demo-1-smap.json` (shown in Satellite checks, not used in scores) | Cite: Reichle, R. et al. (2025). SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data (SPL4SMGP, Version 8). NASA NSIDC DAAC, doi:10.5067/T5RUATAQREF8 (https://nsidc.org/data/spl4smgp/versions/8). Terms not checked line by line |
| **NASA MODIS** MOD13Q1 Collection 6.1 (061) NDVI, 250 m, 16-day, 2001-01 to 2025-12 | The pipeline, for the demo farm point, through NASA AppEEARS (`pipeline/fetch_appeears.py`) | `mobile/assets/data/demo/lanao-norte-demo-1-ndvi.json` (shown in Satellite checks, not used in scores) | Cite: MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid, MOD13Q1 v061, NASA LP DAAC, doi:10.5067/MODIS/MOD13Q1.061. Terms not checked line by line |
| **NASA HLS** v2.0 NDVI (HLSL30_VI, HLSS30_VI) with Fmask (HLSL30, HLSS30), 30 m, 2013-05 to 2026-10 | The pipeline, for the demo farm point, through NASA AppEEARS (`pipeline/fetch_appeears.py`) | `mobile/assets/data/demo/lanao-norte-demo-1-hls.json` (shown in Satellite checks, not used in scores) | Cite: Harmonized Landsat Sentinel-2, NASA LP DAAC, doi:10.5067/HLS/HLSL30_VI.002, doi:10.5067/HLS/HLSS30_VI.002, doi:10.5067/HLS/HLSL30.002, doi:10.5067/HLS/HLSS30.002. Terms not checked line by line |
| **NASA ECOSTRESS** ECO_L4T_ESI v002 (Evaporative Stress Index) and ECO_L3T_JET v002 (daily ET), 70 m, 2018-09 to 2026-09 | The pipeline, for the demo farm point, through NASA AppEEARS (`pipeline/fetch_appeears.py`) | `mobile/assets/data/demo/lanao-norte-demo-1-ecostress.json` (shown in Satellite checks, not used in scores) | Cite: NASA LP DAAC, doi:10.5067/ECOSTRESS/ECO_L4T_ESI.002 and doi:10.5067/ECOSTRESS/ECO_L3T_JET.002. Terms not checked line by line |
| **NASA FLDAS** Noah Land Surface Model L4 Global Monthly 0.1° (MERRA-2 and CHIRPS), FLDAS_NOAH01_C_GL_M v001, 2001-01 to 2025-12 | The pipeline, for the demo farm, through Earthdata cloud OPeNDAP (`pipeline/fetch_fldas.py`) | `mobile/assets/data/demo/lanao-norte-demo-1-fldas.json` (shown in Satellite checks, not used in scores) | Cite: Amy McNally, NASA/GSFC/HSL (2018), FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 degree (MERRA-2 and CHIRPS), Greenbelt, MD, USA, GES DISC, Accessed 2026-11-14, doi:10.5067/5NHC22T9375G (https://disc.gsfc.nasa.gov/datacollection/FLDAS_NOAH01_C_GL_M_001.html). Terms not checked line by line |
| **NASA SRTM** Global 1 arc-second v3 (SRTMGL1), elevation and slope | The pipeline, through Open Topo Data (see below) | Elevation and slope in the demo farm file | Openly shared, cite: NASA JPL. (2013). NASA Shuttle Radar Topography Mission Global 1 arc second [Data set]. NASA LP DAAC. https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003 (read 2026-11-14 at https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl1-003) |

Sentinel-2 reaches the app only inside NASA HLS (HLSS30), above. AppEEARS needs an Earthdata Login; the credentials stay outside the repo (`pipeline/README.md`).

These credit lines are also on the in-app Licenses and credits screen. No NASA logos are used anywhere.

### SRTM through Open Topo Data (pipeline only)

- `https://api.opentopodata.org/v1/srtm30m`, code in `pipeline/fetch_srtm.py`. The app never calls it: only the resulting numbers ship.
- The public API is free, limited to 100 locations per request, 1 call per second and 1000 calls per day (https://www.opentopodata.org/). It publishes no terms of use for the public instance. We make one request per demo point, wait over a second between requests and cache the answer, so a re-run makes no call. Only the team's demo coordinates are sent, never a farmer's data (rule 8). Software: MIT (https://github.com/ajnisbet/opentopodata).

## Other data

Fetched by the pipeline and bundled with the app. The app doesn't show PSA or ONI yet (the explainer text in `mobile/src/content/explainers.ts` already names both); drop those two from this list and from the submission if no screen uses them by the freeze.

| Data | Code | What ships | Terms |
|---|---|---|---|
| **PSA OpenSTAT**, palay and corn production and area harvested by province (tables 0012E4EVCP0 and 0022E4EAHC0), https://openstat.psa.gov.ph/ | `pipeline/fetch_psa.py` | `mobile/assets/data/psa/yields.json` | Not checked |
| **NOAA Climate Prediction Center, Oceanic Niño Index (ONI)**, https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt | `pipeline/fetch_oni.py` | `mobile/assets/data/context.json` | Not checked |
| **FAO Ecocrop database**, crop names only (EcoPortCode, scientific and common names), full copy in OpenCLIM/ecocrop `EcoCrop_DB.csv` at commit `f13577f4237604b15d85d8e43741714a2d1eb2d4`, https://github.com/OpenCLIM/ecocrop. Used by the S2 crop search (#152); no Ecocrop-only crop is scored | `pipeline/build_ecocrop_names.py` | `mobile/assets/data/ecocrop-names.json` | Data © FAO. FAO website terms (https://www.fao.org/contact-us/terms/en/, read 2026-11-14): non-commercial use allowed with acknowledgement of FAO as source and copyright holder, no FAO endorsement implied. Credit shown in the app: "Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop". Repository code: UK Open Government Licence v3 |
| **Natural Earth 1:10m physical vectors**, release v5.1.2 (land, minor islands, lakes; admin-0 countries for the Philippines bounding box), https://www.naturalearthdata.com/, via https://github.com/nvkelso/natural-earth-vector | `pipeline/build_land_water.py` | `mobile/assets/data/land-water-ph.json` (land and lakes cut to the Philippines, rounded to 0.001°) | Public domain (https://www.naturalearthdata.com/about/terms-of-use/, read 2026-11-15). Credit given anyway: "Made with Natural Earth" |
| **GeoNames**, Philippines country dump `PH.zip` (cities and municipalities, feature code ADM3, with provinces from ADM2), https://download.geonames.org/export/dump/PH.zip, retrieved 2026-11-15 | `pipeline/build_places.py` | `mobile/assets/data/places-ph.json` (1,646 towns: name, province, position rounded to 0.001°) | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Credit shown in the app: "Town names and positions: GeoNames (CC BY 4.0)" |

## Methods and references

Cited in the code where they're used (`mobile/src/engine/params.ts`, `mobile/src/data/et0.ts`, `pipeline/et0.py`) and listed for the farmer in the Data & limits text (`mobile/src/content/explainers.ts`).

- **FAO-56:** Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). *Crop evapotranspiration: guidelines for computing crop water requirements.* FAO Irrigation and Drainage Paper 56. https://www.fao.org/4/x0490e/x0490e00.htm. Penman-Monteith ET₀, crop coefficients (Table 12), stage lengths (Table 11), rooting depth and depletion fraction (Table 22).
- **FAO Training Manual No. 3:** Brouwer, C., Heibloem, M. (1986). *Irrigation Water Management Training Manual No. 3: Irrigation Water Needs.* FAO. https://www.fao.org/4/s2022e/s2022e08.htm. Effective rainfall (Section 4.2) and the extra water paddy rice needs (Section 4.4).
- **FAO Ecocrop:** crop temperature ranges. Each value is cited per crop in the crop library.
- **Kader (1993):** perishability classes for market access, "where cited" in the crop library (`params.ts`). The full reference comes with `crops.json`.
- **Crop library `crops.json` (#11): pending.** Every value will carry its own citation. When it lands, add its sources here. The engine's test fixture (`mobile/src/engine/__fixtures__/crops.fixture.ts`, not shipped) cites the FAO Ecocrop database (via https://github.com/OpenCLIM/ecocrop), the PhilRice Rice Variety Database, the IRRI Rice Knowledge Bank, the DA HVCDP Mungbean Production Guide, PNS/BAFS 27:2018 and FAO GIEWS; keep only the ones `crops.json` uses.

## Online services the app calls

Free public services, light use only, none needing an account or a key; except the optional Claude API call, which our API Worker makes with a paid key.

### NASA POWER (climate per lot)

- Monthly point API, called once per lot with the centroid rounded to 0.1°.
- Source and terms: https://power.larc.nasa.gov/docs/services/api/

### Anthropic Claude API ("In plain words" SI summary, D33 and D33a)

- Called only by our API Worker (`api/src/routes/explain.ts`), never from the phone directly, for the suggested plan when the phone is online (by itself on the suggestion card, D33a; a tap on **Explain this plan with SI** during a what-if). Model `claude-opus-5-5`.
- Sent: the engine's results for the plan on screen (crop names, scores, the engine's own why, trade-off and check-locally lines, confidence). Not sent: location, lot shape, lot or farm names. Nothing is stored by us; identical requests are answered from the Cloudflare edge cache for a day.
- The answer is shown as "SI-generated", and the Worker drops it if it contains a number that is not in the engine results.
- Needs a paid API key, kept as a Worker secret (`ANTHROPIC_API_KEY`). Terms: Anthropic Commercial Terms and Usage Policy (https://www.anthropic.com/legal/commercial-terms, https://www.anthropic.com/legal/aup), not yet checked line by line.

### Wikipedia and Wikimedia Commons (pictures of search-only crops)

- For a crop saved from the search that has no bundled picture, the app asks the Wikipedia page-summary API (`https://en.wikipedia.org/api/rest_v1/page/summary/<scientific name>`) for the page's lead picture, then the Commons API (`https://commons.wikimedia.org/w/api.php`, `prop=imageinfo`) for its author and license. Code: `mobile/src/data/crop-photo-core.ts` and `crop-photo.ts`. Shown only on S2, under the chosen crop, with `Photo: author, license (Wikimedia Commons)` linking to the file page, and a link to the license text. The Licenses and credits screen lists every picture saved on the phone with its full credit (title, author, license with link, Commons file page), read back from the same saved answer. The picture itself is Wikimedia's own scaled thumbnail, not changed by us.
- Only the crop's scientific name is sent. Nothing about the farmer or lots, no location. Wikimedia sees the phone's IP address like any website would. The result is saved on the phone (a "none found" answer for 7 days), requests go one at a time with a 1 second pause (and after an HTTP 429 nothing is sent for the `Retry-After` time, at least 5 seconds), and offline or on any error the app shows the placeholder.
- Only pictures on Commons under CC0, public domain, CC BY or CC BY-SA with an author are shown. The lead picture is chosen by Wikipedia editors, so it can be an illustration instead of a photo (cassava shows a 19th-century plate). A name that fits more than one Ecocrop species gets no lookup.
- Policies: https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy (read 2026-11-15; the app sends a descriptive User-Agent on Android, and none on web because browsers cannot set it). Wikimedia limits fast callers with HTTP 429. Not yet checked by a human: the Wikimedia API terms for an app with many users.

### Road routing (travel time to harvest destinations, optional)

- **FOSSGIS routing server**, `https://routing.openstreetmap.de` (car, bike and foot profiles). Code: `mobile/src/data/routing.ts`.
- Policy (https://routing.openstreetmap.de/about.html, read 2026-11-14): at most one request per second, no scraping or heavy use, a valid User-Agent, and the required OpenStreetMap attribution with a link to "fix the map" (https://www.openstreetmap.org/fixthemap). Request URLs are saved in the server's log file. The full German usage policy (fossgis.de) could not be read from our network on 2026-11-14 and still needs a human check.
- The OSRM demo server (`router.project-osrm.org`, car only) is not used. Its policy: at most one request per second, "reasonable, non-commercial use-cases", no uptime guarantee (https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server).
- Only points rounded to about 100 m (3 decimals) are sent, one request per lot and destination, and only when the farmer adds or moves a destination.
- Attribution shown wherever a road route is used: "Routing © OpenStreetMap contributors". The exact wording the OSM Foundation asks for is in https://osmfoundation.org/wiki/Licence/Attribution_Guidelines and was not checked.
- OpenStreetMap data is under the ODbL: https://www.openstreetmap.org/copyright.

### Map tiles (S1 lot map, S6 places)

- Basemap is decision **D25, still open**. Until the team picks, the map page uses **Esri World Imagery** as a placeholder (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`). Switching to EOX Sentinel-2 cloudless or OpenStreetMap is one line in `mobile/map-src/main.ts` (`DEFAULT_BASEMAP`). The terms of use of each option were not checked here; that is part of D25. If the team picks Sentinel-2 cloudless, it also goes under "Space Agency Partner Data" in the submission (ESA Copernicus data).
- The provider's attribution is always shown on the map (Leaflet attribution control).
- Tiles are requested only for the area on screen, as the farmer looks around. No bulk download or tile caching. Offline, lot shapes still draw on a plain background.
- Like any web map, tile requests show the tile server which area is being viewed (zoom level and tile numbers). No lot shapes, names, or other farm data are sent.

## App libraries

Runtime dependencies in `mobile/package.json`, all open source.

| Library | Version | License | Link |
|---|---|---|---|
| Expo (`expo`, `expo-router`, `expo-constants`, `expo-linking`, `expo-location`, `expo-status-bar`, `@expo/metro-runtime`) | SDK 58 | MIT | https://github.com/expo/expo |
| React, React DOM | 19.3.0 | MIT | https://react.dev |
| React Native | 0.88.1 | MIT | https://reactnative.dev |
| React Native Web | 0.21.4 | MIT | https://github.com/necolas/react-native-web |
| react-native-webview | 14.0.1 | MIT | https://github.com/react-native-webview/react-native-webview |
| react-native-svg | 15.16.0 | MIT | https://github.com/software-mansion/react-native-svg |
| lucide-react-native | 1.73.0 | ISC | https://lucide.dev |
| react-native-chart-kit | 7.0.4 | MIT | https://chartkit.io |
| paths-js (used by react-native-chart-kit) | 0.4.11 | Apache-2.0 | https://github.com/andreaferretti/paths-js |
| react-native-screens | 4.30.1 | MIT | https://github.com/software-mansion/react-native-screens |
| react-native-safe-area-context | 5.11.1 | MIT | https://github.com/AppAndFlow/react-native-safe-area-context |
| AsyncStorage (`@react-native-async-storage/async-storage`) | 2.2.0 | MIT | https://github.com/react-native-async-storage/async-storage |
| NetInfo (`@react-native-community/netinfo`) | 12.0.1 | MIT | https://github.com/react-native-netinfo/react-native-netinfo |
| TanStack Query (`@tanstack/react-query`, `query-async-storage-persister`, `react-query-persist-client`) | 5.107.1 | MIT | https://tanstack.com/query |
| Zustand | 5.1.0 | MIT | https://github.com/pmndrs/zustand |
| Hono (typed API client) | 4.13.18 | MIT | https://hono.dev |

Chart library: decision D30. Add it here when it lands.

## Bundled map libraries (`mobile/map-src/`, built into one offline HTML file)

- Leaflet 1.9.4, BSD-2-Clause: https://leafletjs.com
- Terra Draw 1.39.0 and terra-draw-leaflet-adapter 1.4.0, MIT: https://terradraw.io
- Turf.js 7.4.0 (`@turf/area`, `centroid`, `convex`, `helpers`, `simplify`, `unkink-polygon`), MIT: https://turfjs.org

## Build and test tools

Not shipped inside the app.

| Tool | Version | License | Use |
|---|---|---|---|
| TypeScript | 6.0.3 (app), 7.0.2 (API) | Apache-2.0 | Type checking |
| esbuild | 0.28.2 | MIT | Bundles the offline map page |
| ESLint, eslint-config-expo | 9.39.5, 58.0.4 | MIT | Linting |
| Workbox CLI | 7.4.1 | MIT | Service worker for the installable web app |
| Node.js built-in test runner | Node 24 | MIT | Engine and data tests |
| EAS Build (Expo Application Services) | hosted | Expo terms | Android APK builds |
| Cloudflare Pages and Workers, Wrangler 4.162.0 | hosted; Wrangler MIT OR Apache-2.0 | Cloudflare terms | Web hosting, API Worker |
| GitHub | hosted | GitHub terms | Code, issues, pull requests |

## API Worker (`api/`)

A Cloudflare Worker with a health check route; the app doesn't depend on it for any result (rule 8: no backend storage of farm data).

| Library | Version | License |
|---|---|---|
| Hono | 4.13.18 | MIT |
| Zod | 4.6.7 | MIT |
| @hono/zod-validator | 0.9.1 | MIT |

## Pipeline (`pipeline/`)

Python 3.11+ standard library only (`urllib`, `json`, `csv`, `unittest`, …). No third-party Python packages.

## Images, icons, and fonts

- **UI icons:** Lucide (`lucide-react-native`, ISC license), used through `mobile/src/components/Icon.tsx` since #147. No icon font, no emoji.
- **Fonts:** the system font of each platform. No font files are bundled.
- **AgroSprout logo, app icon, Android adaptive icon, splash, favicon and web icons** (`mobile/assets/*.png`, `mobile/assets/images/agrosprout-logo.png`, `mobile/public/*.png`): the team's own original artwork, added in #178 (issue #177), replacing the Expo template images. Not third-party; listed here so the form can say so.
- **Crop pictures** (`mobile/assets/crops/*.webp`, #169): square crops of free-license photos from Wikimedia Commons, resized to 160 px, so each is a modified copy (changes: cropped square and resized). Each author, license and file was checked against the Commons API (`prop=imageinfo`, `extmetadata`) and against the Commons picture on 2026-11-15; authors are written as each file page asks to be credited. **Our changed copies of the CC BY-SA photos (mung bean, peanut, sweet potato, sorghum, eggplant) are adapted works and are shared under the same license and version as the original (CC BY-SA 3.0 or 4.0).** The CC BY copies keep the original's license terms with credit; CC0 and public domain have no condition. Shown in the app and credited on the Licenses and credits screen. The team should confirm the choice of pictures.

| Picture | Crop | Title | Author | License | Source |
|---|---|---|---|---|---|
| `assets/crops/lowland-rice.webp` | Rice | “Rice plant.jpg” | Douglas Paul Perkins | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | <https://commons.wikimedia.org/wiki/File:Rice_plant.jpg> |
| `assets/crops/corn.webp` | Corn | “Starr-160618-0718-Zea mays-immature cob with silks-Hawea Pl Olinda-Maui (28067473235).jpg” | Forest and Kim Starr | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/) | <https://commons.wikimedia.org/wiki/File:Starr-160618-0718-Zea_mays-immature_cob_with_silks-Hawea_Pl_Olinda-Maui_(28067473235).jpg> |
| `assets/crops/mungbean.webp` | Mung bean | “Bean pod of Vigna radiata (mung bean).jpg” | Sanjay ach at the English-language Wikipedia (Sanjay Acharya) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Bean_pod_of_Vigna_radiata_(mung_bean).jpg> |
| `assets/crops/peanut.webp` | Peanut | “Peanut 9417.jpg” | Pollinator | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Peanut_9417.jpg> |
| `assets/crops/soybean.webp` | Soybean | “Soybean Pods (10059910446).jpg” | United Soybean Board | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | <https://commons.wikimedia.org/wiki/File:Soybean_Pods_(10059910446).jpg> |
| `assets/crops/string-bean.webp` | String bean | “Long Bean.JPG” | David | Public domain | <https://commons.wikimedia.org/wiki/File:Long_Bean.JPG> |
| `assets/crops/sweet-potato.webp` | Sweet potato | “Ipomoea batatasL ja01.jpg” | miya | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | <https://commons.wikimedia.org/wiki/File:Ipomoea_batatasL_ja01.jpg> |
| `assets/crops/sorghum.webp` | Sorghum | “Sorghum 6364.jpg” | Chris Light | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | <https://commons.wikimedia.org/wiki/File:Sorghum_6364.jpg> |
| `assets/crops/eggplant.webp` | Eggplant | “Solanum melongena 24 08 2012 (1).JPG” | Joydeep | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Solanum_melongena_24_08_2012_(1).JPG> |
| `assets/crops/sesbania-rostrata.webp` | Sesbania rostrata | “Sesbania rostrata-NMNH-13374155.jpg” | NMNH (Smithsonian National Museum of Natural History, herbarium specimen) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | <https://commons.wikimedia.org/wiki/File:Sesbania_rostrata-NMNH-13374155.jpg> |
| `assets/crops/cabbage.webp` | Cabbage | “Chou cabus blanc 01.jpg” | Coyau | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Chou_cabus_blanc_01.jpg> |
| `assets/crops/potato.webp` | Potato | “Potato tubers in pail.jpg” | Ruslan V. Albitsky aka pauk | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Potato_tubers_in_pail.jpg> |
| `assets/crops/carrot.webp` | Carrot | “Harvested Carrots.jpg” | Shark2025 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | <https://commons.wikimedia.org/wiki/File:Harvested_Carrots.jpg> |
| `assets/crops/onion.webp` | Onion | “Onion on White.JPG” | Colin | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Onion_on_White.JPG> |
| `assets/crops/tomato.webp` | Tomato | “Tomato je.jpg” | Softeis | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Tomato_je.jpg> |
| `assets/crops/hot-pepper.webp` | Hot pepper | “Fresh Red Curly Chili Peppers (Capsicum annuum) Pile.jpg” | Undeka 11 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | <https://commons.wikimedia.org/wiki/File:Fresh_Red_Curly_Chili_Peppers_(Capsicum_annuum)_Pile.jpg> |
| `assets/crops/cassava.webp` | Cassava | “Cassava roots for peeling.jpg” | Denis kasozi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | <https://commons.wikimedia.org/wiki/File:Cassava_roots_for_peeling.jpg> |
| `assets/crops/cowpea.webp` | Cowpea | “Purple cowpea pods.jpg” | Fumikas Sagisavas | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | <https://commons.wikimedia.org/wiki/File:Purple_cowpea_pods.jpg> |
| `assets/crops/squash.webp` | Squash | “Cucurbita moschata Butternut 2012 G2.jpg” | George Chernilevsky | Public domain | <https://commons.wikimedia.org/wiki/File:Cucurbita_moschata_Butternut_2012_G2.jpg> |
| `assets/crops/cucumber.webp` | Cucumber | “ARS cucumber.jpg” | Stephen Ausmus, USDA ARS | Public domain | <https://commons.wikimedia.org/wiki/File:ARS_cucumber.jpg> |
| `assets/crops/watermelon.webp` | Watermelon | “DFC 6158 Sweet summer ready to slice - ripe watermelons on display one halved to reveal its juicy red flesh.jpg” | PattayaPatrol | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | <https://commons.wikimedia.org/wiki/File:DFC_6158_Sweet_summer_ready_to_slice_-_ripe_watermelons_on_display_one_halved_to_reveal_its_juicy_red_flesh.jpg> |
| `assets/crops/lettuce.webp` | Lettuce | “Lactuca sativa var. (2).jpg” | Prenn | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | <https://commons.wikimedia.org/wiki/File:Lactuca_sativa_var._(2).jpg> |

- **SI-generated images:** none so far. Any that are added must carry a visible "SI-generated" watermark and be listed here (CLAUDE.md rule 4).
- **Screenshots** in the demo deck and README come from the app itself (#51).

## SI tools

Claude Code (Anthropic) assisted with research, planning documents, and code. Claude (Anthropic API) writes the in-app "In plain words" summary, labeled as written by SI (see above). Every use is logged in [`docs/si-usage-log.md`](docs/si-usage-log.md).
