# Submission Form — Working Draft

> Paste-ready drafts for each field on the team's Project Submission page. **English only.** Fill in progressively; final copy by Sun 19:00 PHT. Requirements: [../02-submission-and-judging.md](../02-submission-and-judging.md).

## Project Name
`TBD (decision D7)`

## High-Level Project Summary
*What did you develop? How does it address the challenge? Why is it important?* (~150 words)

> TBD

## Link to Project Demo
`TBD` (public link; ≤7 slides or ≤30-second video; tested in incognito ☐)

## Link to Final Project
`TBD` (web build URL + Android APK link + public GitHub repo; tested in incognito ☐)

## Detailed Project Description
- What exactly does it do?
- How does it work?
- What benefits does it have?
- What do you hope to achieve?
- Tools, languages, hardware, software used:

> **Draft v1 (#39, Sat Nov 14).** Written from what is merged on `main` plus the screens planned in `docs/11-user-flow.md`. Before pasting, check every sentence against the final app and drop anything that didn't ship. Owner of the final edit: Story lead.

**What exactly does it do?**

AgriResilience is an offline-first decision-support app for smallholder farmers. A farmer sketches each of their lots on a satellite map with a finger, picks the crops planted on each lot, and gets a dashboard per lot that compares at least three rotation strategies side by side: their current crops, the option that best fits the local rain, the option that best builds soil, and a balanced option for the priorities they choose (save water, build soil, extra income, less work). Each strategy explains why it was suggested, the supporting evidence, its benefits, the information gaps, and the risks to check with a local technician, with a High, Medium, or Low confidence level. If the farmer enters their planting months, the app compares "your months vs better months" for every crop. If they add where their harvest goes and how they get it there, the app estimates travel time per lot and adds market access to the comparison. It runs as an Android app for farmers and as a web app for judges, with no login and no account.

**How does it work?**

For each lot, the app requests monthly NASA POWER agroclimatology data for 2001–2025 at the lot's location: temperature and its daily range, rainfall, humidity, wind, solar radiation, and root-zone soil wetness. On the phone, it computes reference evapotranspiration (ET₀) with the FAO-56 Penman-Monteith method, multiplies it by each crop's coefficient to get the crop's water need month by month, and compares that with effective rainfall in a dry year (20th percentile), a typical year (median), and a wet year (80th percentile). A rotation engine written in TypeScript then builds candidate 12-month rotations from a crop library with cited values, removes the ones that fail hard limits, and scores the rest on eight components: fits your rain, weather safety, builds soil, protects from washout, breaks pest cycles, income, easy to get to market, and easy to manage. The farmer's priorities weight the scores. The explanations are fixed templates filled with the computed numbers, so every sentence traces back to a data source. Confidence drops when the ranking changes between a dry and a wet year or when key inputs are the farmer's guesses. A 3-year Soil Health Index line shows how each option trends, labeled as a relative indicator from this model and not a soil test.

The app fetches NASA data once per lot and saves it on the phone, so the dashboard and comparisons work offline in the field. A demo farm in Lanao del Norte, built from NASA POWER daily data by a Python pipeline, is bundled for use without a connection. The only location data that leaves the phone is the lot's center rounded to 0.1° (to NASA POWER) and, if the farmer adds a destination, points rounded to about 100 m (to a road-routing server).

**What benefits does it have?**

- It brings NASA climate data to the farmer's own lots and crops, in plain language, with a "What am I looking at?" explainer on every chart.
- It shows trade-offs instead of a single answer. The farmer's current rotation is always one of the options, so every suggestion is compared with what they already know.
- It works where farmers are: offline after setup, on a basic Android phone, with no account, and with farm data kept on the phone.
- It is transparent. Every number carries its source, resolution, and period; every assumption is labeled; and uncertainty is shown as dry-year and wet-year ranges and a confidence level.
- It gives the farmer and the agricultural technician a shared starting point: each option lists what to check locally. It supports their judgment and doesn't replace it.

**What do you hope to achieve?**

We want a farmer to see, before planting, which season on each lot is likely to run short of water and which rotation or planting month fits the rain better, without needing a signal or an account. Next steps: test the results with farmers and municipal agricultural technicians in Lanao del Norte, add local planting calendars and prices to the crop library, add Filipino and Cebuano, add a view for technicians and cooperatives that covers several farms, and bring in satellite soil-moisture and vegetation data where it adds detail.

**Tools, languages, hardware, and software used**

- Languages: TypeScript, Python 3.11+.
- App: Expo (React Native) with expo-router, building an Android app and a web app from one codebase; react-native-webview, react-native-svg, AsyncStorage, Zustand, TanStack Query.
- Map: Leaflet, Terra Draw, and Turf.js, bundled into an offline map page with esbuild.
- Data and methods: NASA POWER API (monthly and daily point data); NASA SRTM elevation via Open Topo Data; FAO-56 Penman-Monteith ET₀ and crop coefficients (Allen et al., 1998); FAO effective-rainfall rules; FOSSGIS road-routing server (OSRM, OpenStreetMap data) for travel time.
- Testing: Node.js built-in test runner for the engine and data code; Python `unittest` for the pipeline.
- Build and hosting: EAS Build for the Android APK; Cloudflare Pages for the web app; GitHub for code and issues.
- SI assistant: Claude Code (Anthropic), see "Use of SI".
- Hardware: Android phones and laptops for development and testing.

<!-- Team: add the chart library (D30), the basemap provider (D25), and any NASA or partner dataset that ships (SMAP, MODIS, Sentinel-2). -->


## Use of Super Intelligence (SI)
> Draft lives in [../si-usage-log.md](../si-usage-log.md#draft-answer-for-the-use-of-si-form-field-update-before-submitting). Copy the final version here.

## NASA Data
*Specific NASA data and resources used. Name the product, variables, period, and how each one is used.*

| Dataset | Variables | Period | Used for |
|---|---|---|---|
| NASA POWER monthly point API (Agroclimatology), fetched per lot by the app | T2M, T2M_RANGE, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT | 2001–2025 | ET₀, water balance, stress months, crop temperature fit, waterlogging risk |
| NASA POWER daily point API (Agroclimatology), bundled demo farm | T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT | 2001–2025 | Same, plus days above 35 °C, days above 50 mm of rain, long-term trends |
| SRTM Global 1 arc-second v3 (SRTMGL1, NASA JPL via LP DAAC, https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003), served by Open Topo Data, bundled demo farm | Elevation, slope | Feb 2000 | Elevation sets the air pressure in the demo farm's ET₀; slope saved with the farm, not yet used in the scores |
| *(add SMAP, SRTM, MODIS, IMERG… only if actually used)* | | | |

## Space Agency Partner Data & Other References
*List ALL data, resources, and tools, open source included.*

- *(e.g. ESA Copernicus Sentinel-2, if used)*
- FAO-56 (Allen et al., 1998), crop coefficients and Penman-Monteith method
- *(libraries: Expo / React Native, expo-router, react-native-webview, Leaflet, Terra Draw, Turf.js, AsyncStorage, chart library, pandas…)*
- *(images, fonts, icons with licenses)*

## Final checks
- [ ] All members confirmed at the Iligan City Local Event
- [ ] All required fields filled, all English
- [ ] Demo within limits; links public
- [ ] No under-18 likeness; no NASA branding in SI content; SI images watermarked
- [ ] Terms checkbox ticked → **Submit for Judging** clicked (by 21:00 PHT Sun)
