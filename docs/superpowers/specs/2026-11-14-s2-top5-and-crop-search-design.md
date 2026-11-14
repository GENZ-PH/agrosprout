# S2 crops: top 5 for this lot + search to select

> **Changed after build (johnrald1 for the team, 2026-11-14):** the list shows the **top 3**, not 5, and a lot has **one crop** (D13 changed in `docs/decision-log.md`). Tapping a top-3 row or a search result makes it the lot's crop and replaces the old one; a farm saved earlier keeps its crops until one is chosen. Where this document says 5 or multi-select, read 3 and one crop.

Date: 2026-11-14 · Owner: johnrald1 (frontend) · Status: **approved** (johnrald1, 2026-11-14). Plan: `docs/superpowers/plans/2026-11-14-s2-top5-and-crop-search.md`
Related: #25 (S2), #29 (dashboard), D13, D24, `docs/03-data-sources.md`, `docs/si-usage-log.md`

## Intent

On S2 ("What do you plant?"), the farmer should see which crops suit **this lot**, judged from its NASA data, and be able to
pick any crop they actually grow, not only the ones on a fixed grid. Today S2 shows a fixed grid of the 10 library crops, a
"Suits this lot" list (branch `fe/crops-suggested`, uncommitted), and a free-text "Other".

The farmer's words (johnrald1, 2026-11-14): "top 5 crops list, not a static", "the top 5 is selectable, and dropdown is a
search to select", "team is good for that".

## Goals

1. **Top 5 for this lot**: per lot, the 5 best crops ranked by the engine's crop-fit check on that lot's NASA POWER data,
   each with its fit and best planting months. Tapping a row adds the crop to the lot (tap again removes it).
2. **Search to select**: one search box per lot. Typing finds crops by English, local or scientific name across our crop
   library **and the FAO Ecocrop database** (2,568 species), offline. Tapping a result adds it to the lot.
3. **More crops in the library** (Part 2): about 10 more common local crops with sourced values, so the top 5 is ranked
   over a larger list. The team agreed (johnrald1 for the team, 2026-11-14); log it against D24.

## Non-goals

- Ranking Ecocrop-only crops. They can be picked but are not scored (same as "Other" today).
- Any live API call for plants. Everything is bundled and works offline.
- Engine or dashboard changes. The dashboard keeps reading `lot.crops` exactly as now.
- ~~One crop per lot (raised earlier, would change D13). S2 stays multi-select.~~ Changed: one crop per lot (see the note at the top).

## Anti-goals (a failure even if it works)

- A top 5 that contradicts the dashboard **for the same months** (S2 rates "if planted in <months>"; the dashboard rates the
  usual or the farmer's months and says which).
- Any number without a source (rule 3).
- Trees, weeds or pasture grasses in the top 5.

## Constraints

- Feature freeze Sun 2026-11-15 12:00 PHT. Part 1 must not depend on Part 2.
- Engine stays pure TypeScript, no React Native imports (`mobile/src/engine/`). New logic goes in `mobile/src/lots/*-core.ts`
  (pure, Node-testable) like `crop-picks.ts` and `suggest-core.ts`.
- Pipeline is Python 3.11+, standard library only, raw downloads cached in `pipeline/raw/` (gitignored).
- Copy says "SI", never "AI". Keep "supports, doesn't replace" framing.
- Android (WebView-free screen, plain RN) and web must both work; tap targets ≥ 44 px; screen-reader labels on every control.

## Approaches considered

| | Approach | Trade-off | Result |
|---|---|---|---|
| A | Rank **all Ecocrop crops** with the EcoCrop model (Hijmans et al. 2001, R `dismo::ecocrop`) on the lot's monthly NASA data | Big, dynamic list, offline. But on the demo farm (2,390 mm/yr, 25–28 °C) 719 species tie at 100 (top 5 = acacias, nutmeg) and the rain check marks corn, mungbean, sorghum and soybean 0, rice 12–80 (season-sum or annual reading), in a province that grows ~200,000 t of rice a year (PSA). | **Rejected**: contradicts the dashboard and local reality |
| B | **Top 5 from our engine** (crop fit, best planting months) over the crop library + **search over library + Ecocrop names** | Consistent with the dashboard; sourced; offline. The ranked pool is only as big as `crops.json`, hence Part 2. | **Chosen** (johnrald1, 2026-11-14) |
| C | FAO GAEZ suitability per lot (live ImageServer) | Includes soil and terrain, but online only, ~50 calls per lot, 9 km cells, ~50 crops | Rejected for the app |

Evidence: prototype runs in this session (`ecocrop_proto.py`, scratchpad) and the API probes in `docs/03-data-sources.md`.

## Design

### What the farmer sees (per lot)

```
Lot 1 · 1.00 ha                          ✓ NASA climate data ready
Top 5 for this lot                                            ⓘ
 1  Sorghum · Batad        [Good fit]  Plant Apr–Nov          ( )
 2  Eggplant · Talong      [Good fit]  Plant Mar–Sep          ( )
 3  Mungbean · Mungo       [Good fit]  Plant Apr              (✓)
 4  String bean · Batong   [Good fit]  Plant Mar              ( )
 5  Corn · Mais            [Watch out] Too wet Jul–Oct        ( )
 From NASA rain, temperature and soil wetness at this lot. A guide, not a rule.

What do you plant on Lot 1?
[🔍 Search crops: rice, mais, kamote, cassava…            ]
  Lowland rice · Humay                    Our crop list
  Rice · Oryza sativa …                   (Ecocrop rows that are our crops are hidden)
Your crops: [Mungbean ✕] [Cassava · not scored ✕]
```

- **Top 5 block** replaces the "Suits this lot" list. It appears once the lot's data is on the phone (`useLotData`); while
  loading or with no data it shows nothing (the existing data line already explains the status).
- Each row is one button (role checkbox, `aria-checked`), whole row tappable, ≥ 56 px tall. Label: rank, name, local name,
  fit word, months or reason, "selected" state.
- **Search box** replaces the fixed 10-crop grid **and** the "+ Other" free-text box. With the box focused and empty, the
  list shows all library crops (so a farmer can browse without typing). Results: max 8 rows. Library crops first, labelled
  "Our crop list"; Ecocrop crops labelled "Not scored yet". **Whenever the typed text is not exactly the name of a shown
  result**, a last row **Add "<typed text>"** saves it as today's `other:<name>`, so local names Ecocrop lacks or matches
  wrongly ("ampalaya", "pechay" and "palay" are missing; "kalabasa" → bottle gourd) can still be entered. ("sili" is in
  Ecocrop, as *Capsicum frutescens*.) *(Settled after the review.)*
- **Your crops** row: every crop picked on the lot as a removable chip (✕), in pick order. The "Pick at least one crop" footer
  rule is unchanged.
- ⓘ opens a new explainer `top5` (replaces `crop-suggestions`): what, source, how ranked, limits (see Ranking).

### Ranking (top 5)

Extend `lotSuggestions` (`mobile/src/lots/suggest-core.ts`, already tested) so each crop also carries the months that reach
its **best** level and the reasons at the first such month (from `cropFit`). Top 5 = library crops ordered by:

1. best level: Good, then Watch out, then Poor (Unknown = cannot be rated, never shown);
2. for equal level, more planting months **at that best level** first (a wider window is more forgiving; for Good crops
   this is the Good-month count). **This tie-break is a team assumption**: say so in the ⓘ limits. *(Builder's call,
   settled after the review: on the demo farm it puts corn, 12 Watch-out months, above lowland rice, 7.)*
3. then library order.

Row text (every row): "if planted in <best months>" next to the fit word, e.g. "Good fit · if planted in Apr" (`goodMonthsText` over the best-level months; "any month" when all 12). Watch
out / Poor rows add the main reason **at the first best-level month**, reusing `fitReasonText` from
`recommendations-core.ts` so wording matches "Your crops here". The lot's water source (lot details) is passed as today.

### Search index (Ecocrop names)

- New `pipeline/build_ecocrop_names.py` → `mobile/assets/data/ecocrop-names.json`.
  Source: OpenCLIM/ecocrop `EcoCrop_DB.csv` (FAO Ecocrop, full copy), **pinned to commit
  `f13577f4237604b15d85d8e43741714a2d1eb2d4`**, cached in `pipeline/raw/`. Same mirror `crops.json` already cites.
- Per species: `code` (EcoPortCode), `sci` (ScientificName), `names` (COMNAME split on commas, regional notes in
  parentheses removed, case-insensitive de-duplicated, max 12). Keep species with no common name (searchable by scientific
  name). Measured size: ~250–300 KB JSON.
- File `meta`: source URL, commit, retrieved date, licence note. OpenCLIM repo: UK Open Government Licence v3. Data © FAO
  (Ecocrop). FAO's website terms (https://www.fao.org/contact-us/terms/en/, read 2026-11-14): content may be used "in
  non-commercial products or services, provided that appropriate acknowledgement of FAO as the source and copyright holder
  is given" and FAO endorsement is not implied. Our app is free and non-commercial, so: credit "Crop names: FAO Ecocrop
  © FAO, via OpenCLIM/ecocrop" in the ⓘ, on the Data & limits page and in `THIRD_PARTY.md` (#52).
- Library crops map to their Ecocrop species by a table in the script (`crop_id` → one or more EcoPortCodes, e.g.
  `lowland-rice` → 1574 *Oryza sativa*), each verified to exist in the CSV. Those Ecocrop rows are dropped from the species
  list and their names (e.g. "camote", *Ipomoea batatas*) go into a `library` section of `ecocrop-names.json`
  (`{crop_id: {sci, names}}`), which the app merges into the library crop's search names. So "camote" finds Sweet potato
  (library) and a crop never appears twice.
- **A pipeline test fails if any `crops.json` crop id has no mapping**, so a Part 2 crop cannot be forgotten.
- The index is optional in the app: one constant switches search to library-only + Add row, in case the data must be
  dropped. *(Settled after the review.)*

### Search matching (`mobile/src/lots/crop-search-core.ts`, pure)

- Normalize: lower case, strip accents (NFD + remove combining marks), collapse spaces.
- A query matches an entry when any word of any of its names (English, local, scientific) **starts with** the query, or the
  full name starts with it. Empty query → all library crops.
- Order: library before Ecocrop; within each, exact name match, then match on the first/main name, then other names; then
  alphabetical. Max 8.
- Each result: display name (library: `cropShortName` + local name; Ecocrop: the common name that matched, capitalized, so
  "okra" shows "Okra" and not Ecocrop's first name "abelmoskus"; first common name when only the scientific name matched,
  else scientific; *planning call*), the name that matched (shown when it isn't the display name, e.g. "Sweet potato · matched “camote”"), scientific name.

### Saving a pick

- **Crop only, no months** (johnrald1, 2026-11-14). A top-5 tap saves the crop like today (`seasons: []`). The dashboard
  keeps checking the crop's usual months, labelled "assumed", and "Your months vs better months" shows the better months.
  The farmer's own months still come from S4. So S2 says "Good fit · if planted in Apr" while "Your crops here" can say
  "Watch out" on the usual months: the row wording must make the "if planted in" condition clear. Crops with no usual months
  (eggplant, string bean, Part 2 crops until D26) keep showing "Not sure yet" on the dashboard, as they do today.
- Library crop → its `crop_id` (unchanged).
- Ecocrop crop → `other:<display name>` via the existing `otherCropId` (no engine or dashboard change; the engine already
  reports it as an unknown-crop gap and the UI already says "no scores").
- Picking an already-picked crop does nothing; ✕ removes it (`toggleCrop`).

### Part 2: more crops in the library (separate PR, data track)

- Candidates (common in lowland Mindanao, to be confirmed against sources): cassava, tomato, squash/pumpkin, cucumber,
  watermelon, pepper, okra, cabbage, onion, bitter gourd. Include a crop **only if** FAO-56 (Allen et al. 1998) gives its Kc
  and stage lengths and Ecocrop gives its temperature range; every value cited, anything unsourced `null` + `unverified`
  (enforced by `crops.test.ts`). `typical_calendar` may stay empty until D26 has a source.
- No app code change: new crops enter the top 5, the search and the engine automatically. The Part 2 PR **also adds each
  crop's row to the mapping table in `build_ecocrop_names.py` and rebuilds `ecocrop-names.json`** (the pipeline test
  enforces it).
- Update D24 in `docs/decision-log.md` ("team agreed to extend the list", date, who).

## Tests and checks

- `suggest-core.test.ts`: ranking order (level, then Good-month count, then library order), unknown never in top 5,
  best months and reason for a Watch-out crop, top 5 length ≤ 5.
- `crop-search-core.test.ts`: library first; "kamote"/"camote" → Sweet potato (library); "cassava" → Ecocrop
  *Manihot esculenta* while it is not in the library; accent folding; max 8; no duplicate of a library crop; empty query →
  library crops; "Add …" row whenever the text is not an exact result name (e.g. "sili" shows carob **and** Add "sili").
- `pipeline/test_ecocrop_names.py`: name splitting and de-duplication, parenthetical removal, every mapped code exists in
  the CSV, every `crops.json` crop id is mapped.
- `npm run typecheck`, `npm run lint`, `npm test`, `python3 -m unittest discover -s pipeline`.
- Headless Chrome at 390 px on the demo farm: top 5 tap selects/deselects, search "kamote", "cassava", "xyz" (Add row),
  chips remove, Next enabled. Dashboard still renders. Android not testable here: say so.

## Left to the builder

Component structure and styles (reuse `theme.ts`, `FitBadge` look from `CropFitCard.tsx`), keyboard handling of the
results list, debouncing (not expected to be needed), exact copy wording within the rules above.

## Open

- D24 log entry and the final Part 2 crop list (data owner).
