# AgriResilience: Offline-First Predictive Crop Rotation Calendar
### NASA Space Apps Challenge 2026 Project Proposal & System Architecture

## 1. Executive Summary & Core Impact
Smallholder farmers globally navigate unpredictable weather patterns, escalating water scarcity, and severe soil degradation. While **NASA Earth Observations** provide immense amounts of climate and soil data, this critical information rarely reaches the farmers who need it most due to connectivity gaps, complex data structures, and the lack of actionable, localized advice.

**AgriResilience** solves this "last mile" translation problem. It is a Progressive Web App (PWA) designed to fuse massive global satellite pipelines with hyper-local farm mechanics. By processing data in the cloud and optimizing for an **offline-first user interface**, AgriResilience delivers a color-coded, dynamic 3-year crop rotation calendar directly to a farmer's smartphone—enabling smarter decision-making right in the field, even with zero internet connectivity.

---

## 2. System Architecture

The platform architecture splits data processing and user experience into two distinct environments to accommodate both high-bandwidth administrative analysis and low-bandwidth remote operations.

```
[ NASA POWER + SMAP + ESA Sentinel-2 ] ──> [ Cloud Analytics (Google Earth Engine) ]
                                                        │
         ┌──────────────────────────────────────────────┴──────────────────────────────┐
         ▼                                                                             ▼
📊 LOCAL ADMIN DASHBOARD (Online)                                     📱 FARMER'S SMART CALENDAR (Offline-First)
• Regional Risk Mapping                                               • Simple 3-Year Rotation Timelines
• Interactive Water & Soil Charts                                     • Color-coded "Plant / Wait / Cover" Flags
• Cooperative Data Overlays                                           • Cached NASA Data for Offline Use
```

### Key Functional Components
* **Cloud Ingestion Engine:** Aggregates satellite feeds, handles coordinate-based queries, and runs rotation optimization algorithms.
* **Farmer's Smart Mobile Calendar (PWA):** Features full offline-first functionality, local data caching (Service Workers / IndexedDB), visual risk alerts, and customizable rotation paths.
* **Cooperative & Extension Dashboard:** Offers regional visualization tools, predictive analytics for local agricultural officers, and targeted push-notification queues for distributing localized seed recommendations.

---

## 3. Data Integration Strategy

To build a high-scoring prototype for the NASA Space Apps Challenge judges, the system architecture natively unifies five foundational data layers:

| Data Layer | Source Platform | Metrics Extracted | Practical Application |
| :--- | :--- | :--- | :--- |
| **Soil Moisture** | NASA SMAP Satellite | Surface & root-zone soil moisture anomalies | Determines current soil saturation capacity to prevent planting high-water crops during stress cycles. |
| **Precipitation & Weather** | NASA GPM & POWER API | Historical rainfall, solar radiation, temperature variations | Predicts upcoming seasonal water availability and identifies shifting monsoon/planting windows. |
| **Vegetation Health** | MODIS / VIIRS (AppEEARS) | NDVI (Normalized Difference Vegetation Index) & Evapotranspiration (ET) | Evaluates historical land productivity trends and monitors local crop water loss metrics. |
| **Local Soil Mechanics** | FAO Harmonized World Soil Database | Soil texture, pH levels, organic carbon, drainage tier | Defines structural baseline constraints (e.g., matching sandy soils with drought-tolerant crop classes). |
| **Crop Characteristics** | FAO Ecocrop Database | Growth duration, volumetric water needs, nitrogen-fixation status | Configures algorithmic agronomic rulesets (e.g., automatically recommending a legume after a heavy nitrogen feeder). |

---

## 4. Key Data Visualizations

To fulfill the criteria for robust data presentation, AgriResilience incorporates three core visualization metrics. *(Note: Your frontend can implement these using charts built with libraries like Chart.js, D3.js, or Recharts).*

### Chart 1: Predictive Soil Moisture vs. Crop Water Demand (Farmer View)
* **X-Axis:** 12-Month Timeline (e.g., January 2027 to December 2027)
* **Y-Axis:** Volumetric Water Volume / Requirement (mm)
* **Visual Representation:** Dual lines plotting *Predicted Root-Zone Soil Moisture* against the *Optimal Water Demand* for a proposed Rice-to-Mungbean rotation. The app highlights a shaded **"Stress Window"** where crop water demands outpace environmental moisture supply, visually validating a recommended rotation pivot point.

### Chart 2: Soil Health Regeneration Curve (Cooperative & Judge View)
* **X-Axis:** 3-Year Operational Horizon (2027 to 2030)
* **Y-Axis:** Integrated Soil Health Index Score (Scale 0 - 100)
* **Visual Representation:** A comparative multi-line graph contrasting a *Monoculture Risk Trend Line* (continuous rice/corn planting showing steep degradation) against a *Regenerative Rotation Line* (incorporating legume cover crops). A callout marker highlights a projected **"+35% Nitrogen Retention Milestone"** at the 2-year interval.

### Chart 3: Regional Climate Risk Heatmap (Administrative View)
* **Base Map Platform:** Mapbox GL JS / Leaflet API
* **Data Overlay:** Real-time geospatial raster mapping derived from NASA GPM rainfall anomalies. 
* **Visual Representation:** Color-coded heatmaps distinguishing agricultural sectors into high, medium, and low environmental threat levels, giving agricultural technicians the macro-perspective required to deploy targeted offline sync arrays to field workers.

---

## 5. Technical Implementation Roadmap & Hackathon Milestones

To develop this platform efficiently over a hackathon weekend, execute the following phased development pipeline:

* **Phase 1: Backend Data Pipelines (Python / Flask or FastAPI)**
  * Construct localized wrappers for the `NASA POWER API` to fetch geographical weather history.
  * Wire up parsing algorithms to digest regional GeoTIFF formats for soil properties.
* **Phase 2: Algorithmic Logic Engine**
  * Establish a weighted scoring script evaluating next-step crop options based on soil moisture availability, nutrient replenishment needs, and user economic targets.
* **Phase 3: Frontend PWA UI (React or Vue.js)**
  * Code the visual 3-year grid calendar layout.
  * Configure service worker caching frameworks to ensure all generated charts, maps, and advice profiles remain fully browsable offline once cached.