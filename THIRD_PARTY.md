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
