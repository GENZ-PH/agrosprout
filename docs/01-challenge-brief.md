# 01 — Challenge Brief: "Field Shift: Adapting Farms with NASA Data"

> Source: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/ (Details tab), read 2026-11-14.
> This is our paraphrase, organized as a requirements checklist. Re-read the original page before final submission in case it changes ("more resources may be added").

## Event facts

| Item | Value |
|---|---|
| Event | 2026 NASA Space Apps Challenge, **Nov 14–15, 2026** |
| Our team | **Jeoleecation** (team URL slug `houston-no-problem`) — https://www.spaceappschallenge.org/2026/find-a-team/houston-no-problem/ |
| Local event | **Iligan City, Philippines** → all deadlines are in **PHT (UTC+8)** |
| Challenge difficulty | Intermediate / Advanced |
| Subjects | Arts & Multimedia, Earth Science, Software |
| Submission window | Opens **Sat Nov 14, 9:00 AM PHT** · Closes **Sun Nov 15, 11:59 PM PHT** |
| Local judging | May follow a different schedule than the global deadline. **Ask the Iligan City Local Lead.** |

## The problem (paraphrased)

Farmers are dealing with shifting temperatures, less predictable rain, water shortages, extreme weather, and declining soil health. That makes it hard to pick crop rotations that protect fields, save water, and hold up over the long term. A crop that helps soil in one place can use too much water, bring disease, have no local market, or not fit the growing season somewhere else.

**Task:** build a *decision-support tool* that combines **NASA Earth observations** with **local soil information, crop characteristics, and farmer priorities**. The tool helps farmers explore rotation strategies that could improve soil health and help their farms adapt.

## Objectives → our requirement checklist

The challenge page frames these as "you may" suggestions. Judges score **Relevance** against them, so we treat each one as a requirement:

| # | Requirement (derived from Objectives) | Priority for us |
|---|---|---|
| R1 | Form: an app, model, interactive map, or other decision-support tool | Must |
| R2 | Use NASA datasets such as SMAP, ECOSTRESS, GPM, Landsat, MODIS, NASA POWER, GRACE/GRACE-FO, SRTM | Must (≥1 required for Global Award eligibility; more = stronger Relevance) |
| R3 | Analyze patterns in temperature, heat stress, rainfall, soil moisture, evaporation, frost risk, extreme precipitation, vegetation stress, long-term water trends | Must (a subset relevant to the demo site) |
| R4 | Include local soil info, crop characteristics, and **farmer priorities** (water use, forage value, N-fixing, erosion reduction, organic matter, market suitability) | Must |
| R5 | Highlight **bare-field periods**, **seasons when current crops are vulnerable**, and rotation opportunities (pest-cycle break, lower water demand, better infiltration, extra income) | Must (at least vulnerable seasons and bare periods) |
| R6 | **Compare at least three rotation strategies, including the farmer's existing rotation** | **Must, and missing from the initial proposal** |
| R7 | For each strategy, explain **why it was suggested, the supporting evidence, its benefits, the information gaps, and the risks that need local review** | **Must, and missing from the initial proposal** |
| R8 | Position the tool as **supportive**: it does not replace farmer judgment or local expertise | Must (UI copy and disclaimers) |

## Potential considerations (optional, but they earn points)

**Understanding conditions & data**
- Show how temperature, soil moisture, rainfall, evaporation, and vegetation stress relate to crop vulnerability and soil health.
- Explain the jargon: evapotranspiration, soil-moisture anomalies, NDVI, frost risk, water balance. → **Glossary/tooltips**
- Explain how satellite observations differ from ground measurements and why combining them helps.

**SI (Super Intelligence = the event's official term for AI), modeling, data fusion**
- Compare different SI or **statistical** approaches for finding patterns in historical climate and soil data.
- Use SI to surface seasonal transitions, bare-field periods, and stress periods.
- Explain how the model handles **uncertainty** and where local experts need to validate results.
- **Harmonize** datasets that differ in spatial and temporal resolution onto a common analysis grid. The page names SMAP, ECOSTRESS LST, GPM, Landsat/MODIS VIs, GEDI biomass, and soil data.

**Rotation strategy exploration**
- Compare scenarios on nutrient cycling, erosion risk, organic matter, pest-cycle disruption, water use, forage potential, and market.
- Map which rotation ideas fit which farmer priorities (save water, extra income, soil structure).
- Briefly explain how N-fixing, cover, deep-rooting, and drought-tolerant crops help soil health.

**Geospatial mapping & visualization**
- Interactive maps of long-term trends (soil moisture, heat waves, water-storage decline).
- Field-level vulnerability zones (erosion risk, water-stress hotspots, frost-prone areas).
- Optional add-ons: timelines, dataset-comparison overlays, **scenario sliders for rainfall/temperature**.

**Farmer-centered design**
- Easy to read for farmers with little technical or GIS background.
- Farmers can enter their own priorities and constraints (water availability, equipment, market preferences).
- Remind users that the tool supports local expertise and does not replace it, and point out where human judgment matters most.

## Terminology note: "SI"

The challenge pages and FAQ use **SI ("Super Intelligence")** in place of "AI", following a U.S. Executive Order dated Sept 29, 2026. **Use "SI" in all submission text, slides, and the app's "About" page.** See [02-submission-and-judging.md](02-submission-and-judging.md) for the SI disclosure rules.
