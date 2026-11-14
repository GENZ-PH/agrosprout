# Third-party services and data

Free public services the app calls from the device. Light use only. None needs an account or a key.

## NASA POWER (climate per lot)

- Monthly point API, called once per lot with the centroid rounded to 0.1°.
- Source and terms: https://power.larc.nasa.gov/docs/services/api/

## Road routing (travel time to harvest destinations, optional)

- **FOSSGIS routing server**, `https://routing.openstreetmap.de` (car, bike and foot profiles). Code: `mobile/src/data/routing.ts`.
- Policy (https://routing.openstreetmap.de/about.html, read 2026-11-14): at most one request per second, no scraping or heavy use, a valid User-Agent, and the required OpenStreetMap attribution with a link to "fix the map" (https://www.openstreetmap.org/fixthemap). Request URLs are saved in the server's log file. The full German usage policy (fossgis.de) could not be read from our network on 2026-11-14 and still needs a human check.
- The OSRM demo server (`router.project-osrm.org`, car only) is not used. Its policy: at most one request per second, "reasonable, non-commercial use-cases", no uptime guarantee (https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server).
- Only points rounded to about 100 m (3 decimals) are sent, one request per lot and destination, and only when the farmer adds or moves a destination.
- Attribution shown wherever a road route is used: "Routing © OpenStreetMap contributors". The exact wording the OSM Foundation asks for is in https://osmfoundation.org/wiki/Licence/Attribution_Guidelines and was not checked.
- OpenStreetMap data is under the ODbL: https://www.openstreetmap.org/copyright.

## Map tiles (S1 lot map, S6 places)

- Basemap is decision **D25, still open**. Until the team picks, the map page uses **Esri World Imagery** as a placeholder (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`). Switching to EOX Sentinel-2 cloudless or OpenStreetMap is one line in `mobile/map-src/main.ts` (`DEFAULT_BASEMAP`). The terms of use of each option were not checked here; that is part of D25.
- The provider's attribution is always shown on the map (Leaflet attribution control).
- Tiles are requested only for the area on screen, as the farmer looks around. No bulk download or tile caching. Offline, lot shapes still draw on a plain background.
- Like any web map, tile requests show the tile server which area is being viewed (zoom level and tile numbers). No lot shapes, names, or other farm data are sent.

## Bundled map libraries (`mobile/map-src/`, built into one offline HTML file)

- Leaflet 1.9.4, BSD-2-Clause: https://leafletjs.com
- Terra Draw 1.39.0 and terra-draw-leaflet-adapter 1.4.0, MIT: https://terradraw.io
- Turf.js 7.4.0 (`@turf/area`, `centroid`, `convex`, `helpers`, `simplify`, `unkink-polygon`), MIT: https://turfjs.org

## Pipeline-only data (not called by the app)

- **NASA SRTM v3 elevation and slope for the demo farm**, through Open Topo Data (`https://api.opentopodata.org/v1/srtm30m`). Code: `pipeline/fetch_srtm.py`. The app never calls it: only the resulting numbers ship in `mobile/assets/data/demo/`.
- Data: NASA says the dataset "is openly shared, without restriction" and asks for citation (read 2026-11-14 at https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl1-003): NASA JPL. (2013). NASA Shuttle Radar Topography Mission Global 1 arc second [Data set]. NASA Land Processes Distributed Active Archive Center. https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1.003
- Service: the public API is free, limited to 100 locations per request, 1 call per second and 1000 calls per day (https://www.opentopodata.org/). It publishes no terms of use for the public instance. We make one request per demo point, wait over a second between requests and cache the answer, so a re-run makes no call. Only the team's demo coordinates are sent, never a farmer's data (rule 8). Software: MIT (https://github.com/ajnisbet/opentopodata).
