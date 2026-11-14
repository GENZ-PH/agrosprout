# A lot drawn on sea, ice or desert: design (short)

Approved by johnrald1 on 2026-11-14 ("yes lets start it"), from the recommendation in the session. Small change.

## Why

Nothing checks where a lot is drawn. A probe of the NASA POWER monthly API on 2026-11-14 (2001-2025, the app's
own request) showed what S2 does with each kind of place:

| Point | POWER root-zone soil wetness (GWETROOT) | S2 top 3 today |
|---|---|---|
| Farm near Iligan (8.2, 124.2) | a value every month | eggplant, sorghum, mungbean, Good fit |
| Iligan Bay (8.5, 124.0) | a value every month (the ~50 km cell holds land) | same as a farm |
| Open sea, Philippine Sea (12.0, 130.0) | **missing (-999) in all 300 months**, elevation 0 m | mungbean, sorghum, corn **Good fit** (8 of 10 crops Good) |
| Sahara (23.0, 12.0) | a value every month, 34 mm rain a year | 1 Watch out, then **Poor fit** crops under "Top 3" |
| Greenland (72.0, -40.0) and Antarctica (-80.0, 0.0) ice | **missing in all 300 months** | 3 **Poor fit** crops ("Too cold") under "Top 3" |

A judge who draws a lot in the sea sees corn as a Good fit. That is the one wrong answer; ice and desert are
rated honestly but shown as "Top 3".

## Goals

1. **No soil data → no results.** When a lot's root-zone soil wetness is missing in every month, the spot is sea or
   land ice (as in the probe). S2 and the dashboard say so, show no crop ratings, and offer to move the lot
   (`/lots?lot=<id>`). Uses the data the app already downloads: no new request, no new dataset.
2. **Poor fit is never a "top" crop.** S2 lists only Good and Watch out crops. When every crop that can be rated is
   Poor in every month, S2 says "None of our crops grow well here" with the main trouble (too dry, too cold, too hot,
   too wet) when most crops share it. Search still works.

## Non-goals

- Water near the shore: NASA's grid can't tell it from land; the satellite map shows it, and the app already says
  the climate is for a ~50 km cell.
- Limiting the map to the Philippines (needs a sourced border; judges should be able to try other places).
- A land/water dataset (new download, after the freeze).
- Changing the dashboard's results for a desert lot: they are already Poor fit with reasons.

## Design

- `hasNoSoilData(data)` in `mobile/src/components/lot-analysis-core.ts`: true when `monthly.rootzone_wetness` has no
  number in any month. `lotView` returns `{ kind: "no-soil" }` for such a lot, before "no crops" (picking crops for
  the sea is pointless).
- Dashboard, compare screen and farm map handle `no-soil`: a warning and a "Move <lot> on the map" button; the map
  label says "No soil data".
- S2: the data line says "No NASA soil data here. This spot looks like sea or ice, not farmland." with a "Move lot"
  button, and the top 3 block is hidden.
- `topCrops` leaves out Poor fit; `noCropFits(s)` gives the "none grow well" case and its main trouble.
  `safeLotTop` (replaces `safeTopCrops`) returns both, and never throws.
- The S2 ⓘ text says Poor fit crops are not listed.

## Approaches considered

- **Use POWER's missing soil wetness (chosen):** already downloaded, NASA's own land/sea answer, works offline.
  Misses water near the shore.
- Elevation 0 m: also true for low coastal land, and ice sheets are high. Rejected.
- A bundled land mask or a geocoder: new data or a new outbound request (rule 8). Rejected for now.

## Left to the builder

Copy wording within the lines above, and layout, following the existing S2 and dashboard components.
