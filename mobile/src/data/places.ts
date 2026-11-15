// Philippine cities and municipalities for the offline place search on the lots map (#196). Bundled, so the
// search works without signal and nothing typed is sent anywhere. GeoNames (CC BY 4.0); built by
// pipeline/build_places.py.
import raw from "../../assets/data/places-ph.json";
import { toPlaces, type Place, type PlaceRow } from "../map/place-search-core";

export const PLACES: readonly Place[] = toPlaces(raw.places as unknown as PlaceRow[]);

export const PLACES_CREDIT: string = raw.meta.credit;
