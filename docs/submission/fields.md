# Submission Form: Working Draft

> Paste-ready drafts for each field on the team's Project Submission page. **English only.** Requirements: [../02-submission-and-judging.md](../02-submission-and-judging.md).
>
> **Draft v3 (Sun Nov 15, 17:30 PHT), written with SI (Claude Code) from what is live on `main`.** Every sentence was checked against the code, the bundled data or the live app. The team owns the final wording: change anything you disagree with before pasting.
>
> Project name: **AgroSprout** (D7). Demo: **7-slide deck** (D6), [demo-deck.pdf](demo-deck.pdf).

## Project Name
**AgroSprout**

## High-Level Project Summary
*What did you develop? How does it address the challenge? Why is it important?*

> AgroSprout is a free app that helps a smallholder farmer decide what to plant, and when, on each of their own lots, using NASA data. The farmer draws each lot on a satellite map and picks the main crop. For every lot, the app takes 25 years of NASA POWER climate data (2001 to 2025) and compares the farmer's current crop with three other year-long rotations (best for water, best for soil, balanced) on rain, heat, waterlogging, soil building, erosion and pest cycles, and checks their planting months against better ones. Seven more NASA datasets (GPM IMERG rain, SMAP soil moisture, FLDAS, MODIS and HLS greenness, ECOSTRESS plant stress, SRTM elevation) are fetched for each lot and shown beside the results as independent checks. Every result says why, what it is based on, what is uncertain and what to check with the local agricultural technician; short notes written by SI explain the plan in plain words and are rejected if they contain any number the engine did not produce. The app works in English, Tagalog and Bisaya, needs no account, keeps farm data on the phone and keeps saved results offline. This matters now: PAGASA reports a very strong El Niño expected to last into the first half of 2027, and the Philippine Statistics Authority counted 7.73 million farms in 2022, 55.8 percent of them smaller than half a hectare, where one lost season is hard to absorb.

## Link to Project Demo
https://github.com/InovSea/agrosprout/blob/main/docs/submission/demo-deck.pdf (7 slides; opens in any browser, no login)

## Link to Final Project
- Web app (no login): https://agrosprout.inovsea.com
- Same app, second address: https://agrosprout.pages.dev
- Source code (MIT license): https://github.com/InovSea/agrosprout

Tip for judges, also on the start screen: tap **See a sample farm** to see full results without drawing anything and without signal.

## Detailed Project Description

**What exactly does it do?**

AgroSprout is a decision-support app for smallholder farmers and the agricultural technicians who advise them, starting with farmers in Bukidnon, Northern Mindanao, Philippines. The place search covers Bukidnon's towns and the NASA data is fetched for each lot the farmer draws; the built-in sample farm is in neighbouring Lanao del Norte. It answers the "Field Shift" question for one farm at a time: which crop rotation and which planting months fit this lot's water and weather, and what does the farmer gain or risk by changing.

1. **Draw your lots.** The farmer finds their barangay or town in the search box, then draws each lot on a satellite map with a finger, taps its corners, or drops a pin and types the area. The app cleans the outline and measures the area.
2. **Pick the main crop on each lot.** The app suggests the top 3 crops for that lot from its NASA climate data, with the planting months where each fits best, or the farmer searches any crop. The library has 22 crops, each value cited. For crops grown year-round, the app asks when the farmer usually plants and marks the months that suit the lot.
3. **See the answer first.** The dashboard opens with one suggested plan for the lot, a month-by-month calendar of "Suggestion" next to "You now", and what the farmer gains: fewer pests and diseases, soil built up, soil kept from washing away, each as a score next to their current crops.
4. **Compare.** "Compare this lot with the best option" shows the lot's shape twice, the current crops and the best other option, colored by soil health, crop fit, root-zone wetness or rain in a dry year.
5. **Check planting months.** "Your months vs better months" compares the farmer's months with the best months found for the lot, and calls a better month a trade-off when it clashes with another crop.
6. **Ask "what if".** The results are worked out again on the phone for less rain (down to 30%) or more heat (up to +2 °C), labelled a what-if, not a forecast.
7. **Read it in plain words.** A short SI note explains the suggested plan, each month and each technician section, in the chosen language. The note gets only the engine's numbers, never the location, and is rejected if it adds a number.
8. **Give more detail when ready.** Three optional questions (land type, water source, soil feel) sharpen the results; "I don't know" is always allowed and lowers the confidence instead of guessing. Places where the harvest is sold add travel time per lot to the market score.

A "Details for your technician" panel holds every plan with its scores, the NASA data behind each number (dataset, variables, grid size, years, formula) and a log of every data request the app made.

**How does it work?**

For each lot, the app requests NASA POWER monthly point data (2001 to 2025) for the lot's center rounded to 0.1°: rain, temperature and its daily range, humidity, wind, sunshine and root-zone soil wetness. On the phone it computes reference evaporation with FAO-56 Penman-Monteith, each crop's water need with FAO-56 crop coefficients, and effective rain (FAO Training Manual No. 3) in a dry year (20th percentile), a typical year (median) and a wet year (80th percentile). FAO Ecocrop temperature ranges set the heat and cold limits.

A rotation engine in TypeScript builds year-long rotations from the 22-crop library, drops those that break hard limits, and scores the rest on fit to rain, weather safety, soil building, erosion protection, pest-cycle breaks and, once the farmer adds a place, market access. The farmer's priorities change the weights. Confidence drops to Low when the best choice changes between a dry and a wet year or when key answers are "I don't know". The scores use NASA POWER only.

A small API on Cloudflare Workers fetches, for the same rounded point, NASA GPM IMERG, SMAP L4, FLDAS, SRTM and, through NASA AppEEARS, MODIS NDVI, HLS NDVI and ECOSTRESS. It holds the NASA Earthdata login and the SI key as server secrets, so neither is in the app. These datasets are shown beside the results and given to the SI notes, which cite them; they do not change the scores. The farm map can also show NASA GIBS layers (greenness, rain, soil moisture, land temperature).

This season's context is on the dashboard: the DOST-PAGASA El Niño advisory of 4 November 2026 and the NOAA Oceanic Niño Index, with the note that results come from past records, not a forecast.

Privacy: no login and no account. Farm data stays on the phone. The only location that leaves the phone is the lot center rounded to 0.1° (to NASA POWER and to our API for the NASA satellite checks) and, if the farmer adds a place, points rounded to about 100 m (to a road-routing server). The SI notes receive results only: no location, no lot shape, no names.

**What benefits does it have?**

- NASA data on the farmer's own lots and crops, in plain language and in their language, with an explainer on every chart.
- Trade-offs instead of one answer: the farmer's current crops are always on screen, so every suggestion is compared with what they already know.
- Honest about uncertainty: dry, typical and wet years; a confidence level with its reasons; assumptions labelled as assumptions; limits listed on a "Data and limits" page.
- Traceable: every NASA number opens to its dataset, variables, years and formula, and the SI notes cannot add numbers.
- Works where farmers are: in a phone browser, no account, results saved offline.
- A shared starting point for the farmer and the agricultural technician. It supports their judgment and doesn't replace it.

**Who it is for**

Smallholder farmers and municipal agricultural technicians, starting in Bukidnon, Northern Mindanao. The Philippine Statistics Authority's 2022 Census of Agriculture and Fisheries "recorded a total of 7.73 million farms", and "55.8 percent (4,312 thousand farms) had size of less than 0.5 hectares" (PSA, 2022 CAF Agricultural Farm and Parcel Characteristics, Final Results, released 6 July 2026: https://psa.gov.ph/content/2022-census-agriculture-and-fisheries-agricultural-farm-and-parcel-characteristics-final).

**What do you hope to achieve?**

That a farmer sees, before planting, which season on each lot is likely to run short of water this El Niño year, and which crop or planting month fits the rain better. Next steps:
- test the results with farmers and municipal agricultural technicians in Bukidnon, add Bukidnon PSA yields (the app now uses Lanao del Norte yields), and have native speakers check the Tagalog and Bisaya;
- add local planting calendars, prices and labor to the crop library, so income and work can be scored;
- replace the team's assumed score weights with values validated locally;
- a view for technicians and cooperatives that covers several farms;
- an installable Android app from the same code.

**Tools, languages, hardware, and software used**

- Languages: TypeScript, Python.
- App: Expo (React Native) with expo-router, one codebase for web and Android; React Native Web, react-native-svg, React Native Chart Kit, Lucide icons, AsyncStorage, Zustand, TanStack Query.
- Map: Leaflet, Terra Draw and Turf.js in an offline map page built with esbuild; Esri World Imagery basemap; NASA GIBS layers; GeoNames place names.
- API: Hono and Zod on Cloudflare Workers; NASA Earthdata (OPeNDAP, AppEEARS); Claude (Anthropic) for the SI notes.
- Data and methods: NASA POWER, GPM IMERG, SMAP L4, FLDAS, SRTM, MODIS, HLS, ECOSTRESS; FAO-56; FAO Training Manual No. 3; FAO Ecocrop; PSA OpenSTAT; NOAA ONI; DOST-PAGASA; OSRM on OpenStreetMap.
- Testing: Node.js test runner (527 tests for the engine, data and screen logic), Python unittest for the data pipeline.
- Hosting: Cloudflare Pages and Workers, GitHub.
- SI assistant: Claude Code (Anthropic); see "Use of SI".
- Hardware: none beyond a phone or laptop with a web browser.

## Use of Super Intelligence (SI)

> We used SI as an assistant, not to come up with the idea. The rotation concept comes from the team's initial proposal, and the design decisions are the team's, recorded in our decision log. Claude Code (Anthropic) helped us research the challenge materials and NASA datasets, write planning documents, write and review code and tests, and draft text, which the team reviewed. In the app, Claude writes short plain-language notes from the engine's own numbers; they are labelled "Written by SI (Claude, by Anthropic)… It can be wrong", get no location, and are rejected if they contain a number the engine did not send. The Tagalog and Bisaya texts were translated with SI and are labelled so in the app. Every SI use is logged with date, person, purpose and output in docs/si-usage-log.md. No SI-generated images are used, and no NASA branding appears in SI content.

## NASA Data
*Specific NASA data and resources used. Name the product, variables, period, and how each one is used.*

| Dataset | Variables | Period | Used for |
|---|---|---|---|
| NASA POWER monthly point API, Agroclimatology (https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), fetched per lot by the app | T2M, T2M_RANGE, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT | 2001-2025 | Every result for every lot: evaporation, water balance, dry-stress months, temperature fit, waterlogging, planting months |
| NASA POWER daily point API (https://power.larc.nasa.gov/docs/services/api/temporal/daily/), sample farm | T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT | 2001-2025 | The sample farm's climate, plus very heavy rain days (over 50 mm) for the washout score |
| NASA SRTM Global 1 arc second v3 (doi:10.5067/MEASURES/SRTM/SRTMGL1.003), via Open Topo Data, sample farm | Elevation | February 2000 | Sets the air pressure in the sample farm's evaporation |
| GPM IMERG Final Precipitation L3 1 month 0.1° V07 (doi:10.5067/GPM/IMERG/3B-MONTH/07), sample farm | Monthly precipitation | 2001 to 2025-09 | Satellite check of NASA POWER rain, shown side by side; not used in scores |
| SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture, SPL4SMGP Version 8 (doi:10.5067/T5RUATAQREF8), sample farm | Surface (0-5 cm) and root-zone (0-100 cm) soil moisture | 2015-04 to 2025-12 | Satellite check shown beside NASA POWER soil wetness; not used in scores |

| NASA MODIS Terra NDVI, MOD13Q1 v061 (NASA LP DAAC, via NASA AppEEARS) | NDVI (how green the ground is), 16-day composites | Sample farm 2001-01 to 2025-12; drawn lots the last 5 years | Satellite check shown beside the results; not used in scores |
| NASA HLS NDVI, HLSL30_VI and HLSS30_VI v2.0 (Landsat 8/9 and Sentinel-2, via NASA AppEEARS) | NDVI at 30 m | Sample farm 2013-05 to 2026-10; drawn lots the last 5 years | Satellite check; not used in scores |
| NASA ECOSTRESS, ECO_L4T_ESI and ECO_L3T_JET v002 (via NASA AppEEARS) | Evaporative Stress Index, daily evapotranspiration | Sample farm 2018-09 to 2026-09; drawn lots the last 5 years | Satellite check of plant water stress; not used in scores |
| NASA FLDAS Noah, FLDAS_NOAH01_C_GL_M v001 (NASA GES DISC) | Soil moisture, evapotranspiration, rain, runoff | Sample farm 2001-01 to 2025-12; drawn lots 2023-10 to 2026-09 | Model check beside NASA POWER; its numbers are given to the SI notes; not used in scores |
| NASA GIBS map layers (MODIS Terra NDVI 8-day, GPM IMERG daily rain, SMAP L4 root-zone soil moisture, MODIS Terra land surface temperature) | Map tiles | Mid-November 2026 (date shown on each layer) | Layer switcher on the dashboard farm map |

Drawn lots (decision D35, 2026-11-15): the app asks our API Worker for GPM IMERG (2022-10 to 2025-09), SMAP (2023-11 to 2026-10), FLDAS, SRTM slope and the AppEEARS products for the lot centre rounded to 0.1°. The Worker holds the NASA Earthdata login as a secret; no credential is in the app. These checks, and the SI notes that cite them, sit beside the scores; the scores use NASA POWER only.

Not used, and why: GRACE and GRACE-FO measure water storage over large regions, far coarser than a farm lot; GEDI measures forest and vegetation structure, not field crops.

## Space Agency Partner Data & Other References
*List ALL data, resources, and tools, open source included.* Versions, licenses and terms: [THIRD_PARTY.md](../../THIRD_PARTY.md).

**Space agency partner data**
- None.

**Other data**
- PSA 2022 Census of Agriculture and Fisheries, Agricultural Farm and Parcel Characteristics (Final Results), for the number and size of farms on this page. https://psa.gov.ph/content/2022-census-agriculture-and-fisheries-agricultural-farm-and-parcel-characteristics-final
- PSA OpenSTAT (Philippine Statistics Authority): crop production and area harvested, Lanao del Norte 2022-2024 (soybean: Northern Mindanao), used for typical yield per hectare and harvest trips. https://openstat.psa.gov.ph/
- NOAA Climate Prediction Center, Oceanic Niño Index. https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
- DOST-PAGASA press release, "Very Strong El Niño Is Present in the Tropical Pacific", 4 November 2026. https://pagasa.dost.gov.ph/press-release/233
- OpenStreetMap data (ODbL) through the FOSSGIS routing server (OSRM). https://routing.openstreetmap.de/
- Esri World Imagery basemap tiles (attribution shown on the map).
- FAO Ecocrop database via OpenCLIM/ecocrop (crop temperature ranges and crop names in search). https://github.com/OpenCLIM/ecocrop

**Methods and references**
- Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration. FAO Irrigation and Drainage Paper 56. https://www.fao.org/4/x0490e/x0490e00.htm
- Brouwer, C., Heibloem, M. (1986). Irrigation Water Management Training Manual No. 3: Irrigation Water Needs. FAO. https://www.fao.org/4/s2022e/s2022e08.htm
- Crop guides cited per crop in `mobile/assets/data/crops.json`: Department of Agriculture production guides (ATI, HVCDP, regional field offices), PhilRice, IRRI Rice Knowledge Bank, Tropical Forages, and others listed in the file.

**Software and tools (open source unless noted)**
- Expo, expo-router, React Native, React, React Native Web, react-native-webview, react-native-svg, AsyncStorage, NetInfo, TanStack Query, Zustand, Hono (API client); Hono and Zod (API Worker, not needed for results)
- React Native Chart Kit, Lucide icons
- Leaflet, Terra Draw, Turf.js, esbuild
- Workbox (installable web app, offline), ESLint, Node.js test runner
- EAS Build, Cloudflare Pages, GitHub
- Claude Code (Anthropic), SI assistant (not open source)

**Images, icons and fonts**
- Screenshots from the app itself; Lucide icons (ISC license); system fonts.
- AgroSprout logo and app icon: the team's own artwork (#178).
- Crop photos: 10 photos from Wikimedia Commons (CC BY, CC BY-SA, CC0 and public domain), cropped and resized; each credited in THIRD_PARTY.md and on the app's Licenses and credits screen. Our copies of the CC BY-SA photos are shared under the same license. Search-only crops show a Wikimedia Commons picture loaded at run time, credited under it.

## Final checks (see #150 section 1)
- [ ] All members confirmed at the Iligan City Local Event, 6 at most
- [ ] All required fields filled, all English
- [ ] Demo within limits; every link opens in a private window on a phone
- [x] Repo public after a secrets scan (gitleaks, all refs, 2026-11-15)
- [ ] No under-18 likeness; no NASA branding in SI content; SI images watermarked
- [ ] Terms checkbox ticked, **Submit for Judging** clicked (by 21:00 PHT Sun)
