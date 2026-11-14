# S2 Top 5 + Crop Search Implementation Plan

> **Changed after Task 4 (johnrald1 for the team, 2026-11-14):** top 3 instead of 5, and one crop per lot (D13). `addCrop` became `chooseCrop`; rows are a radio group. See the spec's note.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On S2 (`/crops`), show each lot's top 5 library crops ranked by the engine on its NASA data (tap to pick), and replace the fixed crop grid with an offline search over our crops + FAO Ecocrop names.

**Architecture:** A stdlib-Python pipeline step turns the pinned FAO Ecocrop CSV into a bundled name index. Two pure TypeScript cores in `mobile/src/lots/` do the ranking (`suggest-core.ts`, extended) and the matching (`crop-search-core.ts`, new); the screen only renders them. No engine or dashboard change: Ecocrop picks save as today's `other:<name>`.

**Tech Stack:** Python 3.11 stdlib + unittest (`pipeline/`); Expo React Native + TypeScript, `node --test` (`mobile/`); headless Chrome via DevTools protocol for the screen check.

**Spec:** `docs/superpowers/specs/2026-11-14-s2-top5-and-crop-search-design.md` (issue #152). Part 2 (more crops in `crops.json`) is a separate follow-up, not in this plan.

## Global Constraints

- Branch: rename `fe/crops-suggested` → `fe/s2-top5-search`; PR into `main` with `Closes #152`. `main` must still start and export for web.
- Engine stays pure TS (`mobile/src/engine/`), untouched. New logic in `mobile/src/lots/*-core.ts`: no React Native imports, Node-testable.
- Pipeline: Python 3.11+, standard library only; downloads cached in `pipeline/raw/` (gitignored); never commit `pipeline/raw/`.
- Ecocrop source: `https://raw.githubusercontent.com/OpenCLIM/ecocrop/f13577f4237604b15d85d8e43741714a2d1eb2d4/EcoCrop_DB.csv` (latin-1).
- Credit text, verbatim: `Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop`.
- Copy: "SI", never "AI"; the app supports, doesn't replace, the farmer and technician. Every number traces to a source (rule 3).
- UI: works on Android and web, tap targets ≥ 44 px (rows ≥ 56 px), every control has a screen-reader label; selected state via `accessibilityState` **and** `aria-checked` (RN Web drops the former).
- Log the SI use in `docs/si-usage-log.md` (Who = johnrald1).

## Review Focus

1. **A lot whose NASA data isn't on the phone yet** (pending, offline, or failed): the top 5 is simply absent, the search still works and Next still follows the "pick at least one crop" rule. → Task 4, Step 5 check (b).
2. **Messy typing** ("  KAMOTE ", "Kamóte", "sweet  pot"): matches like clean text. → Task 2 test `normalizes case, accents and spaces`.
3. **One-letter query** ("s"): at most 8 results, library crops first. → Task 2 test `caps at 8 with library first`.
4. **Same crop picked twice** (top 5, then search): stored once. → Task 3 test `addCrop never duplicates`.
5. **A farm saved before this change** (library crops + `other:` crops): every pick shows as a removable chip; removing one keeps the others. → Task 4, Step 5 check (c).

---

### Task 0: Commit the groundwork

**Files:** `docs/03-data-sources.md`, `docs/si-usage-log.md` (first new row), `docs/superpowers/specs/…-design.md`, this plan.

- [ ] **Step 1:** `git branch -m fe/crops-suggested fe/s2-top5-search`
- [ ] **Step 2:** Commit the data-source research alone: `docs/03-data-sources.md` + only the first new SI-log row (stage with `git add -p`). Message: `docs(data): API probes for GAEZ, ORNL, plant APIs and the resources re-check (Refs #152)`.
- [ ] **Step 3:** Commit spec + plan: `docs(spec): S2 top 5 and crop search design and plan (Refs #152)`.

---

### Task 1: Ecocrop name index (pipeline)

**Files:**
- Create: `pipeline/build_ecocrop_names.py`, `pipeline/test_ecocrop_names.py`
- Create (generated): `mobile/assets/data/ecocrop-names.json`
- Modify: `pipeline/README.md` (table row), `THIRD_PARTY.md` (Other data row; replace the line-39 "pending" note's Ecocrop mention if needed)

**Interfaces:**
- Produces `ecocrop-names.json`:
  ```jsonc
  { "meta": { "source": "...", "url": "<pinned CSV url>", "commit": "f13577f…", "retrieved": "YYYY-MM-DD",
              "licence": "...", "credit": "Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop", "species_count": 0 },
    "library": { "<crop_id>": { "sci": "Ipomoea batatas", "names": ["sweet potato", "camote", "..."] } },
    "species": [ { "code": "1420", "sci": "Manihot esculenta", "names": ["cassava", "tapioca plant", "..."] } ] }
  ```
- `MAPPING: dict[str, list[str]]` (crop_id → EcoPortCodes, first code's `ScientificName` is `sci`), exactly:
  `lowland-rice: [1574, 8143]`, `corn: [2175, 238663]`, `mungbean: [2150]`, `peanut: [2199]`, `soybean: [1150]`,
  `string-bean: [10834]`, `sweet-potato: [1265]`, `sorghum: [48747, 1982]`, `eggplant: [1965]`, `sesbania-rostrata: [43996]`
  (codes already cited in `crops.json`, plus the named parent species for rice and corn).
- Functions: `split_names(comname: str, cap: int = 12) -> list[str]`; `build_index(rows: list[dict], mapping: dict[str, list[str]], retrieved: str) -> dict`; `main(argv=None)`; `--offline` flag uses the cache only (like `build_demo.py`).

- [ ] **Step 1: Write failing tests** in `pipeline/test_ecocrop_names.py` (no network, synthetic rows):
  - `test_split_names_drops_parentheses_and_duplicates`: `split_names("green gram (India), mung bean (Aust), Mung Bean, , judia")` → `["green gram", "mung bean", "judia"]`.
  - `test_split_names_caps_at_12`: 20 names in → 12 out.
  - `test_library_rows_leave_species_and_merge_names`: rows for codes 1265 and 1420; mapping `{"sweet-potato": ["1265"]}` → `library["sweet-potato"] == {"sci": "Ipomoea batatas", "names": [...]}` and only 1420 in `species`.
  - `test_all_mapped_codes_of_a_crop_merge_names`: two codes for one crop → names from both, de-duplicated, first code's sci.
  - `test_unknown_mapped_code_raises`: mapping to a code not in rows → `ValueError` naming the code.
  - `test_species_without_common_name_is_kept`: empty COMNAME → entry with `names == []`.
  - `test_every_library_crop_is_mapped`: read `mobile/assets/data/crops.json` (path from `Path(__file__)`), assert `set(MAPPING) == {c["id"] for c in crops}`.
- [ ] **Step 2:** Run `cd pipeline && python3 -m unittest test_ecocrop_names -v` → FAIL (module missing).
- [ ] **Step 3: Implement** `pipeline/build_ecocrop_names.py`: module docstring with source, pinned commit, FAO terms quote (from the spec), why names are capped. Download with a browser `User-Agent` to `pipeline/raw/EcoCrop_DB_f13577f.csv`, reuse when present. `species` sorted by `sci`; skip rows with an empty `ScientificName`. Write JSON with `ensure_ascii=False`, compact separators, trailing newline.
- [ ] **Step 4:** Run the tests → PASS. Run `python3 pipeline/build_ecocrop_names.py` → writes the file; expect `species_count` ≈ 2,550 and file size 250–350 KB (`ls -la`). Spot check: `library["sweet-potato"].names` contains `camote` and `kamote`; a `species` entry has `sci == "Manihot esculenta"`.
- [ ] **Step 5:** Run the whole pipeline suite `python3 -m unittest discover -s pipeline` → all pass. Add the README row and the `THIRD_PARTY.md` row (Data: FAO Ecocrop names via OpenCLIM/ecocrop @ commit; Code: `pipeline/build_ecocrop_names.py`; Ships: `mobile/assets/data/ecocrop-names.json`; Terms: FAO website terms, non-commercial use with acknowledgement, URL + read date; repo code OGL v3).
- [ ] **Step 6: Commit** `feat(pipeline): FAO Ecocrop name index for crop search (Refs #152)`.

---

### Task 2: Crop search core

**Files:**
- Create: `mobile/src/data/ecocrop.ts`, `mobile/src/lots/crop-search-core.ts`, `mobile/src/lots/crop-search-core.test.ts`
- Modify: `mobile/src/types.ts` (add `EcocropNames` type matching Task 1's JSON)

**Interfaces:**
- Consumes: `ecocrop-names.json` (Task 1); `CropLibrary`, `cropShortName` (`src/lots/crop-picks.ts`).
- Produces:
  ```ts
  // src/data/ecocrop.ts
  export const ECOCROP_SEARCH_ENABLED: boolean;           // true; false = library-only search + Add row
  export const ECOCROP_NAMES: EcocropNames | null;        // null when disabled
  // src/lots/crop-search-core.ts
  export type SearchEntry =
    | { kind: "library"; crop_id: string; title: string; local: string | null; sci: string | null; names: string[] }
    | { kind: "ecocrop"; code: string; sci: string; names: string[] };
  export interface SearchResult { entry: SearchEntry; title: string; matched: string | null; }
  export interface SearchOutput { results: SearchResult[]; add: string | null; }
  export function normalizeName(s: string): string;
  export function buildSearchEntries(library: CropLibrary, index: EcocropNames | null): SearchEntry[];
  export function searchCrops(entries: readonly SearchEntry[], query: string, max?: number /* 8 */): SearchOutput;
  ```
- Rules (from the spec):
  - Library entry: `title = cropShortName(crop)`, `local = crop.local_name`; `names` = full name, short name, local name split on "(" ")" (e.g. "Batong (balatong)" → "Batong", "balatong"), `index.library[id].names`, `index.library[id].sci`.
  - Ecocrop entry: `names` = its names + `sci`.
  - Match: `(" " + normalizeName(name)).includes(" " + q)` (prefix of any word, multi-word aware).
  - Order: library before Ecocrop; then tier 0 exact name, 1 match on the main name (library title / Ecocrop `names[0]` or sci when no names), 2 other names; then `title` A–Z.
  - `title` of a result: library → entry title; Ecocrop → the matched common name with its first letter upper-cased (so "okra" shows "Okra", not Ecocrop's first name "abelmoskus"); when only the scientific name matched → `names[0]` capitalized, or `sci` when there are no names. `matched` = the matched name when it differs (normalized) from `title`, else `null`. *(Planning call: the spec said "first common name"; the spec is updated to match.)*
  - Empty query → every library entry in library order, no cap, `add: null`.
  - `add` = cleaned query (trim, collapse spaces, max 40 chars) unless empty or equal (normalized) to **any name of a shown result**.

- [ ] **Step 1: Write failing tests** (`crop-search-core.test.ts`; load `crops.json` and `ecocrop-names.json` from disk with `readFileSync`, like `suggest-core.test.ts`):
  - `empty query lists our crops in library order and offers no Add`.
  - `kamote and camote find Sweet potato from our list, once`: library result first; no Ecocrop result with sci `Ipomoea batatas`; for "camote" `matched === "camote"`.
  - `cassava finds Ecocrop Manihot esculenta titled Cassava`.
  - `okra shows the matched name, not the first Ecocrop name`: title `"Okra"`, sci `Abelmoschus esculentus` among results; `add === null`.
  - `sili offers Add "sili" next to carob`: results include sci `Ceratonia siliqua`; `add === "sili"`.
  - `normalizes case, accents and spaces`: `"  KAMÓTE "` gives the same first result as `"kamote"`; `"sweet  pot"` finds Sweet potato.
  - `caps at 8 with library first`: `"s"` → `results.length === 8`, every library result before the first Ecocrop one.
  - `exact name ranks above other matches`: `"corn"` → first result is library Corn.
  - `a species with no common name is found and titled by its scientific name` (pick any `species` entry with `names.length === 0` from the JSON; query its first word → a result with `title === sci`).
  - `with the index disabled only our crops and Add remain`: `buildSearchEntries(lib, null)`; `"cassava"` → `results.length === 0`, `add === "cassava"`.
- [ ] **Step 2:** `cd mobile && node --import ./scripts/node-test-resolve.mjs --test src/lots/crop-search-core.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/data/ecocrop.ts` (JSON import cast to `EcocropNames`, switch constant) and `src/lots/crop-search-core.ts` (pure; precompute normalized names once in `buildSearchEntries`).
- [ ] **Step 4:** Run the file → PASS; `npm run typecheck` → no errors.
- [ ] **Step 5: Commit** `feat(crops): offline crop search over our list and FAO Ecocrop names (Refs #152)`.

---

### Task 3: Top-5 ranking and add-only pick

**Files:**
- Modify: `mobile/src/lots/suggest-core.ts`, `mobile/src/lots/suggest-core.test.ts`, `mobile/src/lots/crop-picks.ts`, `mobile/src/lots/crop-picks.test.ts`

**Interfaces:**
- Consumes: `cropFit`, `FitLevel`, `FitReason` (`src/engine/cropFit.ts`); existing `lotSuggestions`, `goodMonthsText`.
- Produces:
  ```ts
  export interface CropSuggestion {
    crop_id: string; level: FitLevel; good_months: number[];
    best_months: number[];   // planting months that reach `level` (empty when unknown)
    reasons: FitReason[];    // cropFit reasons at the first best month (empty for good/unknown)
  }
  export interface LotSuggestions { crops: CropSuggestion[] }   // `suggested` is removed (no user left)
  export function topCrops(s: LotSuggestions, n?: number /* 5 */): CropSuggestion[];
  // crop-picks.ts
  export function addCrop(crops: LotCrop[], cropId: string): LotCrop[];  // appends {crop_id, seasons: []} if absent, else returns `crops` unchanged
  ```
- Ranking: drop `unknown`; sort by level (good < watch < poor), then `best_months.length` descending, then library order (stable). Take `n`.

- [ ] **Step 1: Write failing tests:**
  - suggest-core: `best months are the months at the crop's best level, with that month's reasons` (rebuild expected from direct `cropFit` calls as the existing tests do; for a watch crop `reasons.length > 0`, for good `reasons` empty).
  - suggest-core: `top crops: at most 5, never unknown, sorted by level then month count then library order` (assert the order with a comparator over the returned list, and that every excluded rated crop would not sort before the 5th).
  - suggest-core: `fewer than 5 rated crops returns all of them` (library of 3 crops).
  - suggest-core: delete the old `suggested = …` test (field removed).
  - crop-picks: `addCrop never duplicates` (add twice → one entry; existing months kept).
- [ ] **Step 2:** Run both files → FAIL.
- [ ] **Step 3: Implement** in `suggest-core.ts` (keep the one-season-per-planting-month scan; record the per-month `CropFit` so `reasons` come from the first best month) and `addCrop` in `crop-picks.ts`.
- [ ] **Step 4:** Run both files → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(crops): rank the top 5 crops for a lot from the engine's crop fit (Refs #152)`.

---

### Task 4: S2 screen, explainer and credits

**Files:**
- Create: `mobile/src/components/TopCrops.tsx`, `mobile/src/components/CropSearch.tsx`
- Modify: `mobile/app/crops.tsx` (compose; remove grid, "+ Other" box and `SuitsThisLot`), `mobile/src/content/explainers.ts` (rename `crop-suggestions` → `top5`, rewrite text; add Ecocrop credit to the existing "FAO Ecocrop database" `DATA_SOURCES` entry), `docs/si-usage-log.md`

**Interfaces:**
- Consumes: `useLotData` (`src/components/useLotAnalysis.ts`), `lotSuggestions`, `topCrops`, `goodMonthsText` (Task 3), `buildSearchEntries`, `searchCrops`, `ECOCROP_NAMES` (Task 2), `addCrop`, `toggleCrop`, `otherCropId`, `isOtherCrop`, `otherCropName`, `cropShortName` (`crop-picks.ts`), `FIT_LABELS`, `fitReasonText` (`src/components/recommendations-core.ts`), `ExplainerBox` (`src/components/InfoCard.tsx`), `FIT_COLORS` / badge look from `CropFitCard.tsx`.
- Produces:
  - `TopCrops({ lotName, top, period, picked, onToggle })`: header "Top 5 for this lot" + ⓘ (`top5`); one checkbox row per crop: rank, name · local name, fit badge, "if planted in <months>", and for watch/poor the first reason's `fitReasonText`; caption `From NASA rain, temperature and soil wetness at this lot. A guide, not a rule: check with your agricultural technician.`
  - `CropSearch({ lotName, entries, picked, onPickLibrary(cropId), onPickOther(name) })`: input (placeholder `Search crops: rice, mais, kamote, cassava…`, `maxLength={40}`), result list shown while focused or non-empty; library rows tagged `Our crop list`, Ecocrop rows `Not scored yet` + sci in italics; already-picked rows show a check and do nothing; last row `Add “<text>”` when `add` is set. Ecocrop pick → `onPickOther(result.title)`.
  - In `crops.tsx` per lot: data line → `TopCrops` (only when `data` is loaded) → heading `What do you plant on <lot name>?` → `CropSearch` → `Your crops` chips (library name or `otherCropName`, Ecocrop/other ones tagged `not scored`, ✕ removes via `toggleCrop`).
- Explainer `top5` (fill with the spec's wording): what = the 5 crops from our list that suit the lot best and when to plant; source = NASA POWER ({period}), FAO-56, FAO Ecocrop temperatures, and the credit text for search names; read = ranking rules incl. "more months at its best level ranks higher"; limits include `The order among equally good crops is a team assumption: a crop with more good planting months ranks higher.`, `Each crop is checked alone, not with the other crops on your lot.`, `Climate is for a coarse grid cell, not your field alone.`, `Soil type and elevation are not part of this check.`, `Crops found only by search are not scored.`

- [ ] **Step 1:** Update `explainers.ts`; run `npm test -- src/content/explainers.test.ts` (or the full `npm test`) → PASS (every explainer has what/source/read/limits; no banned word).
- [ ] **Step 2:** Build `TopCrops.tsx`, `CropSearch.tsx`, rewrite `crops.tsx`. Memoize `buildSearchEntries(CROP_LIBRARY, ECOCROP_NAMES)` at module level (once), `lotSuggestions` per lot with `useMemo` on `[data, lot.details]`.
- [ ] **Step 3:** `npm run typecheck`, `npm run lint`, `npm test` → all pass.
- [ ] **Step 4:** Make sure the dev server on :8081 serves this tree (bundle contains `Top 5 for this lot`).
- [ ] **Step 5: Headless check at 390 px** (adapt the session's DevTools script; seed `localStorage.farm` with `{state, version: 1}`):
  - (a) Demo lot (`data_ref: "demo/lanao-norte-demo-1"`, `data_status: "ready"`, water unknown): 5 rows; tapping row 2 adds it to Your crops, tapping again removes it; search "kamote" → Sweet potato (Our crop list) adds; "cassava" → Cassava (Not scored yet) adds `other:Cassava`; "sili" → `Add “sili”` adds; "xyz" → no results, only `Add “xyz”`; Next enabled; `/dashboard` renders "Your crops here"; no console errors.
  - (b) Pending lot (`data_ref: "lotdata:lot-9"`, `data_status: "pending"`, nothing stored): no top 5, search works, footer asks for a crop until one is picked.
  - (c) Old farm with `lowland-rice` + `other:Cassava`: both chips show; ✕ on one keeps the other.
  - Save screenshots (crops, search open, dashboard) for the PR.
- [ ] **Step 6:** Add the SI-log row (what was built, files, checks run, "not tried on a phone").
- [ ] **Step 7: Commit** `feat(crops): S2 top 5 for this lot and search to select (Closes #152)`.

---

### Task 5: PR

- [ ] **Step 1:** `git push -u origin fe/s2-top5-search`; `gh pr create` with title `feat(crops): S2 top 5 for this lot and search to select (Closes #152)`, body: summary, the Ecocrop-ranking evidence (why not), screenshots, checks run, "not tried on a phone", Part 2 follow-up, SI note, attribution footer.
