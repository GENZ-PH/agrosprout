// Philippine cities, municipalities and barangays for the offline place search on the lots map (#196). Bundled, so
// the search works without signal and nothing typed is sent anywhere. GeoNames (CC BY 4.0); built by
// pipeline/build_places.py.
import type { BarangayRow, Place, PlaceRow } from "../map/place-search-core";
import { toPlaces } from "../map/place-search-core";

type PlacesFile = { meta: { credit: string }; places: PlaceRow[]; barangays: BarangayRow[] };

let cache: { places: readonly Place[]; credit: string } | undefined;

// The file is large (about 40,000 barangays), so it is read on the first search, not when the app starts.
function load() {
  if (!cache) {
    const raw = require("../../assets/data/places-ph.json") as PlacesFile;
    cache = { places: toPlaces(raw.places, raw.barangays), credit: raw.meta.credit };
  }
  return cache;
}

/** Every town and barangay, towns first. Built once, on the first call. */
export const getPlaces = (): readonly Place[] => load().places;

/** "Place names and positions: GeoNames (CC BY 4.0)". */
export const getPlacesCredit = (): string => load().credit;
