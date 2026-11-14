# 04 — Gap Analysis: Initial Proposal vs. Challenge & Rubric

> Compares `docs/reference/initial-proposal.md` (the team's AgriResilience concept) with the official challenge text ([01](01-challenge-brief.md)) and the judging rubric ([02](02-submission-and-judging.md)).
> The concept itself (offline-first app, color-coded rotation calendar, NASA-driven, cloud processing with a light client) is **kept**. This doc only lists what to add, fix, or cut. *(Later the team chose Expo React Native, Android + web, instead of a PWA; see D4.)*

## What the proposal already does well

| Strength | Rubric criterion it serves |
|---|---|
| Offline-first app for low-connectivity fields: a real "last mile" angle | Impact, Creativity |
| Fuses several NASA layers (SMAP, GPM/POWER, MODIS/VIIRS) with soil and crop characteristics | Relevance |
| Rule example "legume after heavy N feeder" shows agronomic grounding | Validity |
| Rice → mungbean is a realistic Philippine rotation, a good demo anchor | Impact, Validity |
| Simple "Plant / Wait / Cover" flags suit farmers who aren't technical | Presentation, Impact |

## Gaps: required by the challenge, missing from the proposal

| # | Gap | Why it matters | Fix (see linked doc) |
|---|---|---|---|
| G1 | **No comparison of ≥3 strategies including the existing rotation.** The proposal shows a single recommended calendar. | Stated explicitly in the Objectives (R6). Missing it hurts Relevance. | Strategy comparison screen: **Current**, plus 2–3 alternatives ([05](05-mvp-scope.md), [07](07-rotation-engine.md)) |
| G2 | **No per-strategy explanation** of why it was suggested, its evidence, benefits, information gaps, and risks | Stated explicitly in the Objectives (R7). Also our main Validity lever. | "Why this? / Evidence / Benefits / Unknowns / Check locally" card on each strategy |
| G3 | **No farmer priority/constraint input** beyond "user economic targets" | R4 plus the farmer-centered design guidance | Priority chips (save water, soil health, income, less work) and constraints: lot details (land type, water, soil), crops per lot, **harvest destination + transport mode + travel time** (team-defined, D17) |
| G4 | **No uncertainty handling** and no "supports, not replaces" messaging | R8 plus the SI-modeling guidance | Confidence badge per strategy; wet-year vs dry-year range; persistent "check with your agricultural technician" notes |
| G5 | **No plain-language explanations** of ET, soil-moisture anomaly, NDVI, water balance, or satellite vs ground | The challenge suggests this directly; it's cheap points | `Learn` screen plus inline tooltips |
| G6 | **Bare-field periods / vulnerable seasons** only implied ("stress window") | R5 | Calendar shading for bare months; stress window from the water balance; NDVI seasonal curve if time allows |
| G7 | **No data harmonization approach** | SI/modeling guidance | Point × month harmonization with provenance ([03](03-data-sources.md#harmonization-approach-answers-the-common-grid-consideration)) |
| G8 | **No erosion / terrain** (SRTM) | Erosion appears throughout the challenge text; SRTM is cheap | Slope from SRTM × heavy-rain months × bare months → erosion-risk score |
| G9 | **No SI disclosure plan** and no "SI" terminology | Submission rule | `si-usage-log.md`; README "Use of SI" section; watermark any SI images |

## Things to fix in the proposal (Validity risks)

| # | Issue in proposal | Problem | Fix |
|---|---|---|---|
| F1 | Chart 2: "**+35% Nitrogen Retention Milestone**" | No source and not computed. Judges score **Validity**; an invented number hurts more than having no number. | Show only values our model computes, labeled as a model estimate, or cite a specific study. Otherwise remove it. |
| F2 | Chart 2: "Integrated Soil Health Index 0–100" with no definition | A black-box index can't be defended | Define a **transparent formula** with visible components (N balance proxy, bare-days, residue/organic input, erosion) ([07](07-rotation-engine.md)) |
| F3 | Chart 1 puts soil moisture and crop water demand on one "mm" axis | Soil moisture is a volumetric fraction (m³/m³) or a 0–1 wetness index; demand is mm. The units don't match. | Plot a **water balance in mm/month**: supply = effective rain (+ irrigation) and demand = crop ET (Kc × ET₀). Show soil moisture separately as a 0–1 or anomaly line. |
| F4 | Chart 2 x-axis "3-year horizon (2027 to 2030)" | That span is 4 years | "Year 1–3" (relative) or 2027–2029 |
| F5 | Chart 3 "**real-time** GPM raster" | IMERG Early has hours of latency and Final has months; a raster heatmap is heavy for 40 hours | Call it **historical/near-real-time anomaly**; downgrade to stretch |
| F6 | Diagram: data flows through **Google Earth Engine** | GEE needs account registration and has a learning curve; POWER already gives us a no-auth backbone | MVP uses a **Python precompute** with NASA POWER (verified working) plus AppEEARS extracts. GEE is optional. |
| F7 | Uses **FAO HWSD + Ecocrop** as if they were easy, reliable APIs | Availability and format effort are unknown | Check early. Fallback: the farmer picks the soil texture; crop parameters come from FAO-56 tables plus a curated JSON |
| F8 | **Three products** (admin dashboard, farmer app, cloud engine) | Too much for 40 hours; spreads polish thin | **Farmer app first.** Admin/cooperative becomes one stretch "Regional view" page |

## Cuts / deferrals

| Item | Decision (proposed) | Reason |
|---|---|---|
| Push-notification queues for cooperatives | Cut; mention as future work | Needs a backend and accounts |
| Regional risk heatmap (Mapbox/Leaflet raster) | Stretch | High effort; the farmer flow is what gets scored |
| Live arbitrary-location analysis | **Now Must** (team's map-lot onboarding, D13) | Browser fetches NASA POWER per lot (CORS verified); demo farm stays precomputed as a fallback |
| User accounts / login | **Cut, by team decision (D12)** | Data stays on the device |
| Multi-language (Cebuano/Filipino) | Stretch (UI labels only) | Big impact story, but English is required for the submission |

## Net result

The **core idea doesn't change**. We add the **comparison + explanation layer** (G1–G5) as the centerpiece, because that's what the challenge asks for verbatim, and we replace unsupported numbers with **transparent, sourced model outputs** (F1–F3).
