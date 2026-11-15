# Offline place search on the lots map (S1): design

Issue #196 · Approved by johnrald1, 2026-11-15 · Short design (small change)

## Intent
The lots map (S1, `/lots`) starts at Iligan. Anyone not standing on their farm (a farmer setting up at home or with a technician, the web build, a judge trying their own town) has to move the map a long way by hand. A search box like other map apps fixes that: type a town, tap it, the map moves there.

## Goals, non-goals, anti-goals
- **Goals:** find any Philippine city or municipality by name in one tap, on Android and web, offline.
- **Non-goals (this PR):** barangays, streets, landmarks. Barangays are a follow-up PR (GeoNames has 19,168 `ADM4` barangays, under half of the country's, so coverage needs a closer look first).
- **Anti-goals:** sending what the farmer types to any service (rule 8, PR #140); covering the lot while drawing; a box that breaks the layout at 320 px.

## Constraints
- Rule 8: outbound location data only for NASA POWER and OSRM. Search must run on the device.
- Feature freeze Sun 12:00 PHT. Target PR about 11:30; if not merged by 12:00 it waits.
- Leaflet + Terra Draw have no search. The map runs in a WebView (Android) or iframe (web), driven by typed bridge messages.

## Approaches
1. **Own React Native search box + bundled town list (picked).** Matches the app's look, TalkBack and keyboard work like the other screens, the search logic is plain TypeScript tested in Node.
2. **Leaflet add-on (leaflet-control-geocoder with a custom offline geocoder).** Gives a ready box, but it draws inside the map's web page: CSS overrides to match the app, weaker TalkBack and keyboard in the WebView, and it competes with the back button for the top-left corner.
3. **Online geocoder (Nominatim, Photon).** Breaks rule 8, and Nominatim's public server does not allow search-as-you-type. Ruled out.

johnrald1 picked 1, towns and cities now, barangays later.

## Design
- **Data:** `pipeline/build_places.py` reads the GeoNames Philippines dump (`PH.zip`, CC BY 4.0) and writes `mobile/assets/data/places-ph.json`: every `ADM3` (1,646 cities and municipalities) with its name, province (from `ADM2`, "Province of " removed), and lat/lon rounded to 3 decimals (about 100 m). Sorted by population, largest first, so ties rank big towns first; population itself is not stored. `meta` holds source URL, licence, credit and retrieval date, like `ecocrop-names.json`.
- **Search logic:** `mobile/src/map/place-search-core.ts`, no React Native imports. Normalise (lower case, strip accents, so ñ = n), match the start of any word, rank exact name > name starts with query > a later word starts with it, then file order. Up to 6 results, from 2 characters. Typed coordinates ("8.23, 124.24", within the Philippines' rough bounds or any valid lat/lon) give one "Go to these coordinates" result.
- **Box:** `mobile/src/components/PlaceSearch.tsx`, top left on `/lots`, between the back button and Find me, same look as the map buttons (white, rounded, 44 px). Phone: fills the gap; wide: about 360 px. Results list under it: name in bold, province muted, 44 px rows. Clear (×) button. Hidden while a drawing mode is on. Enter picks the first result (web); arrows, Escape on the web.
- **Map:** new bridge message `{ type: "flyTo"; lat; lon; zoom; label? }` (`src/map/bridge.ts`, `map-src/main.ts`): `map.flyTo` at zoom 13 for a town, with a tooltip label that fades after a few seconds.
- **Credits and docs:** `THIRD_PARTY.md`, the Data and limits sources, S1 line in `docs/11-user-flow.md`, a decision-log row, an SI-log row.

## Left to the builder
Exact pixel offsets, the label's fade time, how the places file is loaded (lazy on first focus if the bundler allows it cleanly, otherwise a normal import; it is about 100 KB).
