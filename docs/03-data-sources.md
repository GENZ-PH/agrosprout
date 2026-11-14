# 03 — Data Sources: Catalog, Selection & Access Plan

> The full resource list comes from the challenge Resources tab (read 2026-11-14). The "Our use" column holds **proposals** for the team to confirm (see `decision-log.md`, D2).
> **The most important filter: our demo site is in the Philippines.** About half the listed resources are **U.S.-only** (USDA/USGS/PRISM/OpenET/LANDFIRE/CoCoRaHS) and won't cover an Iligan farm.

## Verified so far

| Check | Result (2026-11-14) |
|---|---|
| NASA POWER API reachable from our network, **no login** | ✅ HTTP 200 in ~1.8 s. Daily point query at 8.23°N, 124.24°E returned `T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, GWETTOP, RH2M, ALLSKY_SFC_SW_DWN, WS2M` (sources: MERRA-2, SYN1DEG, POWER) |
| NASA POWER **CORS** (browser calls with no proxy) | ✅ `access-control-allow-origin: *` |
| NASA POWER **monthly** endpoint, 2001–2024, 7 params | ✅ HTTP 200, ~33 KB, ~1.5 s. ⚠️ Monthly `PRECTOTCORR` is **mm/day** (× days in month); key `YYYY13` = annual value; `-999` = missing. The 2024 sample shows a clear Mar–Apr dry spell at the Iligan cell (0.75–1.2 mm/day; root-zone wetness down to 0.63). |
| `spaceappschallenge.org` via curl/WebFetch | ❌ TLS "untrusted root" on this network. Works in a normal browser. *(GitHub and NASA POWER work fine.)* |
| POWER grid-cell caveat | ⚠️ Early Jan 2024 T2M ≈ 23 °C at the Iligan cell, cooler than lowland coastal normals. The ~0.5° × 0.625° MERRA-2 cell likely includes highland terrain (Lanao plateau). **Pick a lowland farm point and/or correct with SRTM elevation, and state this limitation.** |

Example query (reuse in the pipeline):
```
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,RH2M,ALLSKY_SFC_SW_DWN,WS2M&community=AG&longitude=124.24&latitude=8.23&start=20010101&end=20251231&format=JSON
```

## Tiering

- **Core**: the MVP can't work without it. Must be reliable and need no auth, or only quick auth.
- **Enrich**: adds Relevance or Validity if time allows; MVP has a fallback without it.
- **Partner**: Space Agency Partner data (its own form field; "highly encouraged").
- **Skip**: not applicable to a Philippine site, or poor value for 40 hours.

## NASA data & resources (from the challenge page)

| Resource | URL | Coverage | What it gives us | Our use | Access / auth |
|---|---|---|---|---|---|
| **NASA POWER** (Agroclimatology) | https://power.larc.nasa.gov/ | Global, ~0.5° | Daily T, Tmax/Tmin, precip, RH, wind, solar, **root-zone & surface soil wetness** (`GWETROOT`/`GWETTOP`); everything needed for FAO-56 ET₀ | **Core**: climate normals, ET₀, water balance, heat-stress days, trends 2001–2025 | REST API, no auth ✅ |
| **SMAP** (soil moisture) | https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap | Global, 9 km (L4) | Surface and root-zone soil moisture, 2015→ | **Enrich**: real satellite soil moisture next to the POWER model values; anomaly chart | Earthdata login; easiest as an **AppEEARS point request** (SPL4SMGP / SPL3SMP_E). *Verify products in AppEEARS.* |
| **GPM / IMERG** | https://gpm.nasa.gov/data | Global, 0.1° | Precip rate and accumulation, extreme storms | **Enrich**: rainfall reliability, extreme-rain months (erosion), cross-check with POWER precip | Earthdata login; monthly area-average CSV via **Giovanni**, or Worldview images for the slides |
| **MODIS / VIIRS** (NDVI, ET) | https://lpdaac.usgs.gov/products/ · https://search.earthdata.nasa.gov/ | Global, 250 m–1 km | NDVI/EVI (MOD13Q1), ET (MOD16A2) | **Enrich**: seasonal NDVI curve showing **bare-field periods** and stress | AppEEARS point request (Earthdata login) |
| **Landsat** | https://earthexplorer.usgs.gov/ | Global, 30 m | Reflectance, NDVI, field-scale | **Enrich (slides)**: field-scale image of the demo farm | EarthExplorer (USGS login) |
| **SRTM** (elevation) | https://www.earthdata.nasa.gov/data/instruments/srtm | Global, 30 m | Elevation, slope | **Enrich → near-Core**: slope feeds erosion risk; elevation feeds the temperature correction | AppEEARS area request, or OpenTopography (API key) |
| **ECOSTRESS** | https://ecostress.jpl.nasa.gov/data | Irregular overpasses, 70 m | Land-surface temperature, ET | **Enrich (stretch)**: heat-stress hotspot story | AppEEARS (Earthdata login) |
| **NLDAS / GLDAS** | https://www.earthdata.nasa.gov/ (search "GLDAS") | **GLDAS global**; NLDAS = N. America | Gridded soil moisture, ET, met | **Enrich (alt)**: GLDAS as another soil-moisture/ET series if SMAP is hard to get | Earthdata/Giovanni |
| **GEDI** | https://gedi.umd.edu/data | Global (forests) | Canopy height, biomass | **Skip**: little value for paddy and annual crops | — |
| **GRACE / GRACE-FO** *(named in Objectives, not on Resources tab)* | via Earthdata | Global, coarse | Water-storage trends | **Skip / stretch**: one "long-term water trend" chart at most | Earthdata |

## U.S.-only resources (listed on the page): **Skip for a Philippine site**

| Resource | URL | Why skip |
|---|---|---|
| USDA Ag Data Commons | https://www.nal.usda.gov/services/agdatacommons | U.S. datasets |
| Web Soil Survey (WSS) | https://websoilsurvey.nrcs.usda.gov/app/ | U.S. soils only |
| Cropland Data Layer (CropScape) | https://nassgeodata.gmu.edu/CropScape/ | U.S. only |
| PRISM | https://prism.oregonstate.edu/ | U.S. only |
| SSURGO / STATSGO2 | https://www.nrcs.usda.gov/resources/data-and-reports/soils | U.S. only |
| NAIP | https://naip-usdaonline.hub.arcgis.com/ | U.S. only |
| USGS NLCD | https://www.usgs.gov/centers/eros/science/national-land-cover-database | U.S. only |
| CoCoRaHS | https://www.cocorahs.org/Maps | North America only |
| USGS NWIS | https://waterdata.usgs.gov/nwis | U.S. only |
| USDA AMS Market News | https://www.ams.usda.gov/market-news | U.S. markets |
| USDA NASS QuickStats | https://quickstats.nass.usda.gov/ | U.S. stats |
| OpenET | https://openetdata.org/ | Western U.S. only |
| USFS LANDFIRE | https://www.landfire.gov/ | U.S. only |

> Some of these are worth a sentence in the description, e.g. "the architecture can plug in SSURGO/CDL for U.S. deployments." Don't build anything with them.

## Global non-NASA resources (from the page)

| Resource | URL | Our use |
|---|---|---|
| **FAO GAEZ** (agro-ecological zones) | https://gaez.fao.org/ | **Enrich**: check that candidate crops are climatically and soil-suitable at the site; cite as "evidence" in strategy cards |

## Space Agency Partner resources

| Resource | Agency | URL | Our use |
|---|---|---|---|
| **Copernicus Sentinel-2** | ESA | https://dataspace.copernicus.eu/ | **Partner**: 10 m NDVI image(s) of the demo field across a season, showing bare vs. vegetated periods. Use in the app's "Field view" and the slides. Export manually from the Copernicus Browser. |
| **ERA5 reanalysis** | ECMWF (Copernicus) | https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview | **Partner (optional)**: cross-check POWER temperature and precip; soil temperature. Needs a CDS account. |

## Non-listed sources to consider (verify before relying on them)

| Source | Why | Status |
|---|---|---|
| FAO-56 (Allen et al., 1998) Penman-Monteith and crop coefficients (Kc tables) | Standard method for ET₀ and crop water demand. Gives us a defensible Validity story. | Method is well established. **Copy the Kc values from the FAO-56 tables directly and cite them.** |
| FAO Ecocrop | Crop temperature/rainfall ranges, cycle length | Site availability varies, **check early**. Fallback: FAO-56 plus GAEZ plus extension literature. |
| ISRIC SoilGrids / HWSD v2 (global soil) | Soil texture, organic carbon, pH at the farm point | **Verify the API is up.** Fallback: the farmer picks the soil texture (sand/loam/clay) by hand. |
| Philippine sources: PhilRice, PAGASA, DA/BSWM, PSA OpenSTAT | Local crop calendars, rotation practice, local prices | For "evidence" and "market" inputs. Team to check which are reachable. |

## Harmonization approach (answers the "common grid" consideration)

The farm is a **single point**. For the MVP we harmonize to **point × month**:
1. **Spatial**: sample every dataset at the farm coordinate. Use the nearest grid cell for coarse grids; for 10–30 m imagery, take the mean over a small buffer (e.g. 100 m) around the point. Record each source's native resolution in the output JSON, because the UI shows it as part of "confidence".
2. **Temporal**: aggregate daily or 8–16-day data to **monthly** values (sum for precip and ET; mean for temperature, soil moisture, NDVI; count for heat-stress days). Build **climatology** from 2001–2025 (POWER), or from the sensor's start year (SMAP 2015→).
3. **Anomalies**: each month's deviation from its climatology. Trends: the last 10 years against the earlier period.
4. Keep the provenance on every derived number: `{value, unit, source, native_resolution, period}`.

## Accounts to create (do this in hour 1, because some requests queue)

- [ ] **NASA Earthdata Login** (free), for AppEEARS, Giovanni, and Earthdata Search. Each person creates their own; no shared passwords.
- [ ] **Submit the AppEEARS point request early** (SMAP L4 root zone, MOD13Q1 NDVI, MOD16A2 ET for the farm point, 2015–2025). Requests can sit in a queue.
- [ ] Copernicus Data Space account (Sentinel-2 browser export).
- [ ] *(Optional)* CDS account for ERA5.
