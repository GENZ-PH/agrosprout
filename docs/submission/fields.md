# Submission Form: Working Draft

> Paste-ready drafts for each field on the team's Project Submission page. **English only.** Requirements: [../02-submission-and-judging.md](../02-submission-and-judging.md). Win plan and gates: issue #150.
>
> **Draft v2 (Sat Nov 14, 23:50 PHT), written with SI (Claude Code) from what is merged on `main` at `85c11fa`.** Every sentence was checked against the code or the bundled data; anything that is not in the app is under "What's next". The team owns the final wording: drop or change anything you disagree with, and recheck it against the frozen build after 12:00.
>
> Open team decisions this page depends on: **D7 project name** (this draft uses AgriResilience, the name the app shows) and **D6 demo format** (#150 recommends the 30-second video; script in [demo-video-script.md](demo-video-script.md)).

## Project Name
**AgriResilience** *(D7 still open; the app and the docs use this name today)*

## High-Level Project Summary
*What did you develop? How does it address the challenge? Why is it important?*

> AgriResilience is a free app that helps a smallholder farmer decide what to plant, and when, on each of their own lots. The farmer draws their lots on a satellite map with a finger and picks the crop on each lot. The app then pulls 25 years of NASA POWER climate data for each lot and compares the farmer's current crop with three other rotations (best for water, best for soil, and balanced) on rain, heat, soil health, erosion and pest cycles, plus market access once the farmer adds where the harvest goes. It also checks the farmer's planting months against better ones. Every result says why, what it is based on, what is uncertain, and what to check with the local agricultural technician. It runs in a phone or laptop browser, needs no account, and saved results work offline. This matters now: PAGASA reports a very strong El Niño expected to last into the first half of 2027, so choosing a crop and planting month that fit a dry year protects the harvest. It is built for small farms: the Philippine Statistics Authority's 2022 Census of Agriculture and Fisheries counted 7.73 million farms, and 55.8 percent were smaller than half a hectare.

## Link to Project Demo
`TBD` (public link; 30-second video or 7 slides at most; open it in a private window on a phone before submitting)

## Link to Final Project
- Web app (no login): https://agrosprout.pages.dev (primary; Cloudflare Pages, no domain to renew)
- Same app on our domain: https://agrosprout.inovsea.com
- Source code: https://github.com/GENZ-PH/agrosprout *(repo must be public before submitting, #54)*

Tip for judges, also on the start screen: tap **See a sample farm** to see full results without drawing anything and without signal.

## Detailed Project Description

**What exactly does it do?**

AgriResilience is a decision-support app for smallholder farmers in Lanao del Norte, Philippines, built for the "Field Shift: Adapting Farms with NASA Data" challenge.

1. **Draw your lots.** The farmer sketches each lot on a satellite map with a finger; the app turns the sketch into a clean plot with points they can drag, and measures its area.
2. **Pick the crop on each lot.** For each lot the app suggests the top 3 crops for that lot's climate, with the planting months where each fits best, and the farmer can search for any crop they grow (crops outside the 10 in the library are saved but not scored).
3. **See the results for each lot.** The dashboard compares the farmer's current crops (option A) with three other 12-month rotations: best for water, best for soil, and balanced. The farmer taps what matters to them (save water, build soil) and the scores are worked out again on the phone.
4. **Understand each option.** Each option lists why it was suggested, the evidence, benefits, trade-offs, what we don't know and what to check locally, with a High, Medium or Low confidence level.
5. **Check your planting months.** "Your months vs better months" compares the farmer's months with the best months found for that lot, and calls a better month a trade-off when it clashes with another crop on the lot.
6. **Plan the year.** A month-by-month calendar shows what to plant, harvest or watch for in each month of the chosen plan; a 3-year soil health line shows how each option trends (a relative indicator from the model, not a soil test).
7. **Ask "what if".** A what-if card recomputes everything for drier (down to 30% less rain) or warmer (up to +2 °C) conditions. It is labeled a what-if, not a forecast.
8. **Getting the harvest out.** Optionally, the farmer adds where the harvest goes; the app estimates travel time per lot (by road, or a labeled rough estimate when no route is found; a time the farmer types always wins) and counts it in the market score.

Every chart and card has a "What am I looking at?" explainer. NASA source chips on the cards open a panel that names the NASA dataset, the variables, the grid size, the years and the formula behind each number, and a request log lists every data request the app made in this session.

**How does it work?**

For each lot, the app requests NASA POWER monthly point data (2001-2025) for the lot's center, rounded to 0.1°: rain, temperature and its daily range, humidity, wind, sunshine and root-zone soil wetness. On the phone, it computes reference evaporation with the FAO-56 Penman-Monteith method, turns it into each crop's water need with FAO-56 crop coefficients, and compares that with effective rain (FAO Training Manual No. 3) in a dry year (20th percentile), a typical year (median) and a wet year (80th percentile). FAO Ecocrop temperature ranges set heat and cold limits.

A rotation engine in TypeScript builds 12-month rotations from a library of 10 crops (rice, corn, mungbean, peanut, soybean, string bean, sweet potato, sorghum, eggplant and the green manure Sesbania rostrata), each value cited in the library file. It drops rotations that break hard limits and scores the rest on eight parts: fits your rain, weather safety, builds soil, protects from washout, breaks pest cycles, income potential, easy to get to market, and easy to manage. Income and work are not scored yet, because the crop library has no local price or labor data; market access counts once the farmer adds a destination. The farmer's priorities change the weights. Explanations are fixed templates filled with the computed numbers, so every sentence traces to a source. Confidence drops to Low when the ranking flips between a dry and a wet year, or when key answers are unknown.

A Python pipeline prepares a sample farm in Lanao del Norte from NASA POWER daily data (which also gives heavy-rain days), NASA SRTM elevation, and two satellite checks shown beside the POWER values: GPM IMERG monthly rain and SMAP Level 4 soil moisture. For that farm, the twelve monthly medians add up to about 2390 mm (NASA POWER) and about 2275 mm (IMERG, 2001 to 2025-09): within about 5%. The checks are shown, not used in the scores.

This season's context is on the dashboard: the DOST-PAGASA El Niño advisory of 4 November 2026 and the NOAA Oceanic Niño Index (+2.46 °C for Aug-Oct 2026), with the note that results come from past records, not a forecast.

Privacy: no login and no account. Farm data stays on the phone. The only location data that leaves the phone is the lot center rounded to 0.1° (to NASA POWER) and, if the farmer adds a destination, points rounded to about 100 m (to a road-routing server). The map also loads satellite image tiles from Esri for the area on screen.

**What benefits does it have?**

- It brings NASA data to the farmer's own lots and crops, in plain language, with an explainer on every chart.
- It shows trade-offs instead of one answer. The farmer's current crops are always one of the options, so every suggestion is compared with what they already know.
- It is honest about uncertainty: dry, typical and wet years; a confidence level with its reasons; assumptions labeled as assumptions; limits listed on a "Data and limits" page.
- It is traceable: every NASA number can be opened to see the dataset, the variables, the grid size, the years and the formula.
- It works where farmers are: in a phone browser, with no account, and saved results stay available offline.
- It gives the farmer and the agricultural technician a shared starting point. It supports their judgment and doesn't replace it.

**Who it is for**

Smallholder farmers and the agricultural technicians who advise them, starting in Lanao del Norte. The Philippine Statistics Authority's 2022 Census of Agriculture and Fisheries "recorded a total of 7.73 million farms", and "55.8 percent (4,312 thousand farms) had size of less than 0.5 hectares" (PSA, 2022 CAF Agricultural Farm and Parcel Characteristics, Final Results, released 6 July 2026: https://psa.gov.ph/content/2022-census-agriculture-and-fisheries-agricultural-farm-and-parcel-characteristics-final). On a farm that small there is little room for a season lost to the wrong crop or planting month.

**What do you hope to achieve?**

We want a farmer to see, before planting, which season on each lot is likely to run short of water this El Niño year, and which crop or planting month fits the rain better. Next steps:
- test the results with farmers and municipal agricultural technicians in Lanao del Norte;
- add local planting calendars, prices and labor to the crop library;
- add Filipino and Cebuano;
- a view for technicians and cooperatives that covers several farms;
- bring satellite data to every lot the farmer draws, not only the sample farm: SMAP soil moisture, GPM IMERG rain, MODIS and HLS greenness, ECOSTRESS evaporative stress, FLDAS, and SRTM elevation for live lots;
- local soil data in place of the farmer's soil answer;
- an installable Android app built from the same code (the web app already runs in a phone browser).

**Tools, languages, hardware, and software used**

- Languages: TypeScript, Python.
- App: Expo (React Native) with expo-router, one codebase for Android and the web; react-native-webview, react-native-svg, React Native Chart Kit (charts), Lucide icons, AsyncStorage, Zustand, TanStack Query.
- Map: Leaflet, Terra Draw and Turf.js, bundled into an offline map page with esbuild; Esri World Imagery basemap.
- Data and methods: NASA POWER API (monthly per lot; daily for the sample farm), NASA SRTM v3 via Open Topo Data, GPM IMERG and SMAP L4 via NASA Earthdata; FAO-56; FAO Training Manual No. 3; FAO Ecocrop; PSA OpenSTAT yields; NOAA ONI; DOST-PAGASA; OSRM road routing on OpenStreetMap data.
- Testing: Node.js test runner (over 400 tests for the engine, data and screens' logic), Python unittest for the pipeline.
- Hosting and build: Cloudflare Pages (web), GitHub.
- SI assistant: Claude Code (Anthropic); see "Use of SI".
- Hardware: none needed beyond a phone or laptop with a web browser.

## Use of Super Intelligence (SI)
> Draft lives in [../si-usage-log.md](../si-usage-log.md#draft-answer-for-the-use-of-si-form-field-update-before-submitting). Copy the final version here. Judges do not see this field, but they see the SI labels in the project, so both must match.

## NASA Data
*Specific NASA data and resources used. Name the product, variables, period, and how each one is used.*

| Dataset | Variables | Period | Used for |
|---|---|---|---|
| NASA POWER monthly point API, Agroclimatology (https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), fetched per lot by the app | T2M, T2M_RANGE, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT | 2001-2025 | Every result for every lot: evaporation, water balance, dry-stress months, temperature fit, waterlogging, planting months |
| NASA POWER daily point API (https://power.larc.nasa.gov/docs/services/api/temporal/daily/), sample farm | T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT | 2001-2025 | The sample farm's climate, plus very heavy rain days (over 50 mm) for the washout score |
| NASA SRTM Global 1 arc second v3 (doi:10.5067/MEASURES/SRTM/SRTMGL1.003), via Open Topo Data, sample farm | Elevation | February 2000 | Sets the air pressure in the sample farm's evaporation |
| GPM IMERG Final Precipitation L3 1 month 0.1° V07 (doi:10.5067/GPM/IMERG/3B-MONTH/07), sample farm | Monthly precipitation | 2001 to 2025-09 | Satellite check of NASA POWER rain, shown side by side; not used in scores |
| SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture, SPL4SMGP Version 8 (doi:10.5067/T5RUATAQREF8), sample farm | Surface (0-5 cm) and root-zone (0-100 cm) soil moisture | 2015-04 to 2025-12 | Satellite check shown beside NASA POWER soil wetness; not used in scores |

Not used, and why: GRACE and GRACE-FO measure water storage over large regions, far coarser than a farm lot; GEDI measures forest and vegetation structure, not field crops. (The app's Data and limits page lists GRACE as not needed and does not mention GEDI yet.) MODIS, HLS, ECOSTRESS and FLDAS are not in the app: next steps.

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
- [ ] Repo public after a secrets scan
- [ ] No under-18 likeness; no NASA branding in SI content; SI images watermarked
- [ ] Terms checkbox ticked, **Submit for Judging** clicked (by 21:00 PHT Sun)
