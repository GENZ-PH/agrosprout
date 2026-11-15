# Offline place search on the lots map (S1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A search box at the top left of `/lots` that finds any Philippine city or municipality offline and flies the map there (#196).

**Architecture:** A Python pipeline turns the GeoNames Philippines dump into a small bundled JSON list of towns. A pure-TypeScript matcher ranks towns for the typed text. A React Native `PlaceSearch` overlay on S1 shows results and sends a new `flyTo` bridge message to the Leaflet map page.

**Tech Stack:** Python 3.11 stdlib (pipeline, `unittest`), TypeScript + Node `node:test`, Expo React Native + react-native-web, Leaflet (map page built by `npm run build:map`).

**Spec:** `docs/superpowers/specs/2026-11-15-place-search-design.md`

## Global Constraints
- Nothing typed in the box leaves the device: no network request when searching (rule 8).
- Towns only in this PR (GeoNames feature code `ADM3`, 1,646 rows). No barangays.
- Lat/lon rounded to 3 decimals. Population is used for ordering only, not stored.
- Results from 2 characters, at most 6. Town zoom 13; typed-coordinates zoom 16.
- Box: top left between back (left 10, 48 px) and Find me (right 10, 48 px), 48 px tall like the round buttons; wide (`winWidth >= WIDE`) width 360. Hidden while `drawing` (sketch, corners, pin).
- English copy, plain words, "SI" never "AI". Credit text: "Town names and positions: GeoNames (CC BY 4.0)".
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `pipeline/raw/`.

## Review Focus
1. Same-named towns (111 names repeat): each result must show its province so they can be told apart. (Task 2 test `same name in two provinces`.)
2. Accents: "Penaranda" and "Peñaranda" must both find Peñaranda. (Task 2 test `accents`.)
3. "City of X" / "Municipality of X" / "X City" names: typing "vigan" or "iligan" must put that city first. (Task 2 test `core name first`.)
4. Metro Manila: GeoNames gives NCR districts ("Capital District"), which farmers won't recognise; show "Metro Manila". (Task 1 test `ncr`.)
5. Narrow phones (320 px): the box must not overlap the back or Find me buttons, and the results must not run off screen. (Task 4 browser check.)

---

### Task 1: Town list from GeoNames

**Files:**
- Create: `pipeline/build_places.py`
- Create: `pipeline/test_places.py`
- Create: `mobile/assets/data/places-ph.json` (generated)

**Interfaces:**
- Produces: `places-ph.json` = `{ "meta": { "source", "url", "licence", "credit", "retrieved", "count" }, "places": [[name, province, lat, lon], ...] }`, sorted by population descending, then name.
- Python: `parse(lines: Iterable[str]) -> list[list[str]]`, `build(rows, retrieved: str) -> dict`, `main(argv) -> int` with `--offline` (cache in `pipeline/raw/geonames/PH.zip`, like `build_ecocrop_names.py`).

- [ ] **Step 1: Write the failing tests** in `pipeline/test_places.py` (unittest, made-up tab-separated rows in GeoNames' 19 columns: 1 name, 4 lat, 5 lon, 7 feature code, 10 admin1, 11 admin2, 14 population):
  - `test_only_adm3`: ADM2 + ADM3 + PPL rows → only the ADM3 is in `places`.
  - `test_province_prefix_removed`: ADM2 "Province of Lanao del Norte" → province "Lanao del Norte".
  - `test_ncr`: ADM3 with admin1 "NCR" and ADM2 "Capital District" → province "Metro Manila".
  - `test_order_and_rounding`: two towns, populations 100 and 5,000 → bigger first; 8.231374 → 8.231.
  - `test_meta`: `meta.licence` contains "CC BY 4.0", `meta.count == len(places)`, `meta.retrieved` as given.
- [ ] **Step 2:** `python3 -m unittest pipeline.test_places -v` from repo root → FAIL (module missing).
- [ ] **Step 3:** Implement `pipeline/build_places.py`. URL `https://download.geonames.org/export/dump/PH.zip`; read `PH.txt` from the zip, `csv` with `delimiter="\t"`, `quoting=csv.QUOTE_NONE`. Province from ADM2 keyed by (admin1, admin2); strip `"Province of "`; NCR → "Metro Manila". Docstring states source, licence (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/), credit and "towns only, barangays later (#196)".
- [ ] **Step 4:** Tests pass; run `python3 pipeline/build_places.py` → writes the JSON with count 1,646. Check size (expect well under 150 KB).
- [ ] **Step 5:** Commit `feat(data): offline town list for the map search from GeoNames (Refs #196)`.

### Task 2: Matcher

**Files:**
- Create: `mobile/src/map/place-search-core.ts`
- Create: `mobile/src/map/place-search-core.test.ts`
- Create: `mobile/src/data/places.ts` (`import raw from "../../assets/data/places-ph.json"`; exports `PLACES: readonly Place[]` and `PLACES_CREDIT`)

**Interfaces:**
- Consumes: `places-ph.json` (Task 1).
- Produces:
  ```ts
  export interface Place { name: string; province: string; lat: number; lon: number }
  export interface PlaceHit { key: string; title: string; detail: string; lat: number; lon: number; zoom: number }
  export const MIN_QUERY = 2, MAX_HITS = 6, TOWN_ZOOM = 13, COORDS_ZOOM = 16;
  export function toPlaces(rows: readonly (readonly [string, string, number, number])[]): Place[];
  export function normalize(s: string): string;            // lower case, NFD minus marks, ñ→n, collapse spaces
  export function parseCoords(q: string): { lat: number; lon: number } | null; // "8.23, 124.24" or "8.23 124.24"; |lat|≤90, |lon|≤180
  export function searchPlaces(places: readonly Place[], query: string): PlaceHit[];
  ```
  Coordinates hit: `title: "Go to 8.23, 124.24"`, `detail: "Coordinates"`. Town hit: `title` = name, `detail` = province.

- [ ] **Step 1: Write the failing tests** (`node:test`, real `places-ph.json` read like `crop-search-core.test.ts` does):
  - `core name first`: `searchPlaces(P, "iligan")[0].title === "Iligan City"`, detail "Lanao del Norte"; `searchPlaces(P, "vigan")[0].title === "City of Vigan"`.
  - `word start`: "ili" includes "Iligan City"; "lanao" does not match by province (names only).
  - `accents`: "penaranda" and "Peñaranda" both return "Peñaranda" first.
  - `same name in two provinces`: "tubod" → ≥2 hits, all titles "Tubod", distinct details.
  - `limits`: "a" → `[]`; "san" → length 6.
  - `coords`: "8.23, 124.24" → one hit, lat 8.23, lon 124.24, zoom 16; "91, 10" → `[]`.
  - `trim and case`: "  ILIGAN " same first hit as "iligan".
- [ ] **Step 2:** `node --import ./scripts/node-test-resolve.mjs --test src/map/place-search-core.test.ts` (in `mobile/`) → FAIL.
- [ ] **Step 3:** Implement. Ranking per spec: 0 = core name equals query (core = name without leading "City of "/"Municipality of " and trailing " City"), 1 = name starts with query, 2 = a later word starts with query; ties keep file order (population).
- [ ] **Step 4:** Tests pass; `npm run -s typecheck` passes.
- [ ] **Step 5:** Commit `feat(map): town search logic for S1 (Refs #196)`.

### Task 3: `flyTo` on the map page

**Files:**
- Modify: `mobile/src/map/bridge.ts` (AppToMap union)
- Modify: `mobile/map-src/main.ts` (switch in `receive`, near `case "zoomIn"`)
- Regenerate: `mobile/src/map/map-html.generated.ts` via `npm run build:map`

**Interfaces:**
- Produces: `| { type: "flyTo"; lat: number; lon: number; zoom: number; label?: string }`

- [ ] **Step 1:** Add the union member with a doc comment ("Move to a searched place; shows `label` for a few seconds").
- [ ] **Step 2:** Handler: `map.flyTo([lat, lon], zoom, { duration: 1.2 })`; if `label`, a non-interactive `L.tooltip({ permanent: true, direction: "top" })` at the point, removed after 4 s or on the next `flyTo`. Respect `prefers-reduced-motion`: use `setView` instead of `flyTo`.
- [ ] **Step 3:** `npm run build:map`, `npm run -s typecheck`, `npm test` → all pass.
- [ ] **Step 4:** Commit `feat(map): flyTo message for the place search (Refs #196)`.

### Task 4: `PlaceSearch` on S1

**Files:**
- Create: `mobile/src/components/PlaceSearch.tsx`
- Modify: `mobile/app/lots.tsx` (render after the Find me button; hide when `drawing`)

**Interfaces:**
- Consumes: `searchPlaces`, `PlaceHit` (Task 2), `PLACES` (Task 2), `flyTo` (Task 3).
- Produces: `export function PlaceSearch(props: { wide: boolean; onPick: (hit: PlaceHit) => void }): JSX.Element`. `lots.tsx` passes `onPick={(h) => mapRef.current?.send({ type: "flyTo", lat: h.lat, lon: h.lon, zoom: h.zoom, label: h.title })}`.

- [ ] **Step 1:** Component: absolute, `top: 10`, `left: 66`, phone `right: 66`, wide `width: 360`; white, radius 24, `ROUND_SHADOW`-like shadow, 48 px tall; search icon, `TextInput` (placeholder "Search a town or city", `accessibilityLabel="Search a place on the map"`, `returnKeyType="search"`, no autocorrect), clear (×) button 44 px when text is present.
- [ ] **Step 2:** Results card under the box, same left/right/width: rows ≥ 44 px, title bold + detail muted; `accessibilityRole="button"`, label `"<title>, <detail>"`. A visually hidden live text: "N places found" / "No place found. Try the town name, or tap Find me." (`accessibilityLiveRegion="polite"`). Web keys on the input: ArrowDown/ArrowUp move the highlight, Enter picks it (first by default), Escape closes. Picking: set text to the title, close the list, `Keyboard.dismiss()`, call `onPick`.
- [ ] **Step 3:** `npm run -s typecheck`, `npm run -s lint`, `npm test` pass.
- [ ] **Step 4: Browser check** on `http://127.0.0.1:8081/lots` (fresh tab, clear its localStorage, close after): at 320, 390 and 1280 px, type "iligan" → Iligan City first → tap → map flies there with the label; no overlap with back/Find me/zoom/sheet; no horizontal overflow (`kbd-scan.js`); keyboard: Tab to the box, arrows, Enter, Escape; offline (CDP offline) search still works and DevTools shows no request while typing; box hidden after "Draw with your finger". Screenshots for the PR.
- [ ] **Step 5:** Commit `feat(map): place search box on the lots map (Closes #196)`.

### Task 5: Credits, docs, PR

**Files:**
- Modify: `mobile/src/content/credits.ts` (`OTHER_DATA_CREDITS`: GeoNames entry, url https://www.geonames.org/)
- Modify: `mobile/src/content/explainers.ts` (`DATA_SOURCES`: "GeoNames Philippines (towns and cities)", used_for "Town names and positions for the map search. The list is on your phone; nothing you type is sent.", period = retrieval date, resolution "1,646 cities and municipalities, positions to about 100 m")
- Modify: `THIRD_PARTY.md` (row like the Ecocrop one), `docs/11-user-flow.md:39` (S1: offline town search, nothing sent), `docs/decision-log.md` (new row: place search returns, offline only, team via johnrald1, #196), `docs/si-usage-log.md` (row: issue #196 draft, design, plan, build)

- [ ] **Step 1:** Edit the files above; `npm test` (explainers tests require `period`, `resolution`, `used_for`).
- [ ] **Step 2:** Commit `docs: credit GeoNames and log the place search (Refs #196)`.
- [ ] **Step 3:** Push `fe/place-search`, open the PR into `main` (conventional title, `Closes #196`, screenshots, test counts, footer "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), switch local back to `main`.
