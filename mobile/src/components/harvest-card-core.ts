import { pickTravel, type CropAccess } from "../engine/access";
import type { HarvestLeg } from "../engine/analyze";
import { formatMinutes, modeLabel, sourceLabel, typeLabel } from "../places/places-core";
import type { Destination, Level, Travel } from "../types";

// "Getting your harvest out" on the dashboard (#29, #30, docs/11-user-flow.md S3). Plain logic,
// no React Native imports, so it runs in Node tests. The numbers come from the engine:
// travel times from `lot.travel` (S6 + travel sync), market access per crop from
// `analysis.access` (access.ts), trips per harvest from `analysis.harvest` (harvestTrips.ts).
// The minute limits per perishability and the load per trip are assumptions in params.ts, so
// every line that uses them says "assumed".

/** One place as seen from this lot: "Market · Motorcycle", "about 25 min one way", "road route". */
export interface PlaceRow {
  id: string;
  name: string;
  /** "Market · Motorcycle", or just "Motorcycle" when the name already says "Market". */
  kind: string;
  /** "about 25 min one way", or `null` while there is no travel time yet. */
  time: string | null;
  /** "road route" / "rough estimate" / "your time", or `null` with no time. */
  source: string | null;
  /** A rough estimate: ask the farmer to check it on S6. */
  check: boolean;
}

export function placeRows(destinations: readonly Destination[], travel: readonly Travel[]): PlaceRow[] {
  return destinations.map((d) => {
    const t = pickTravel(travel, d.id);
    return {
      id: d.id,
      name: d.name,
      kind: d.name.toLowerCase().startsWith(typeLabel(d.type).toLowerCase())
        ? modeLabel(d.mode)
        : `${typeLabel(d.type)} · ${modeLabel(d.mode)}`,
      time: t ? `about ${formatMinutes(t.minutes)} one way` : null,
      source: t ? sourceLabel(t.source) : null,
      check: t?.source === "estimate",
    };
  });
}

/** How well the trip suits the crop: within the "fine" time, long, too far, or not scored. */
export type TripLevel = "good" | "watch" | "far" | "unknown";

export const TRIP_LABELS: Readonly<Record<TripLevel, string>> = {
  good: "Suits the trip",
  watch: "Long trip",
  far: "Too far",
  unknown: "Not scored",
};

/** The crop's perishability class (crops.json) in plain words. */
const KEEPS: Readonly<Record<Level, string>> = {
  high: "Spoils fast",
  medium: "Keeps a while",
  low: "Stores well",
};

export interface CropTrip {
  crop_id: string;
  level: TripLevel;
  /** One sentence: why the trip suits the crop or not, or why it isn't scored. */
  line: string;
}

/** The trip verdict for one crop from its market access (`analysis.access.by_crop[id]`). */
export function cropTrip(a: CropAccess, placeName: (id: string) => string): CropTrip {
  const base = { crop_id: a.crop_id };
  if (a.gap === "perishability-unknown" || a.perishability === null)
    return { ...base, level: "unknown", line: "We don't know how fast it spoils, so the trip is not scored." };
  if (a.gap === "no-sale-point")
    return {
      ...base,
      level: "unknown",
      line: "It spoils too fast to keep in storage. Add a market, buyer or co-op to score the trip.",
    };
  if (a.gap === "travel-pending" || a.minutes === null || a.destination_id === null || a.ok_minutes === null || a.max_minutes === null)
    return { ...base, level: "unknown", line: "Waiting for the travel time." };

  const keeps = KEEPS[a.perishability];
  const trip = `${formatMinutes(a.minutes)} to ${placeName(a.destination_id)}`;
  if (a.minutes <= a.ok_minutes) return { ...base, level: "good", line: `${keeps}: ${trip} is fine.` };
  if (a.minutes < a.max_minutes)
    return { ...base, level: "watch", line: `${keeps}: ${trip} is long. Best within ${formatMinutes(a.ok_minutes)} (assumed).` };
  return { ...base, level: "far", line: `${keeps}: ${trip} is too long (limit ${formatMinutes(a.max_minutes)}, assumed).` };
}

/**
 * Trips for one harvest to the crop's best place: "About 12 trips per harvest (100 kg each,
 * assumed load), about 9 h 40 min on the road." `null` when the engine can't count them
 * (no typical yield, no area, no load, or no travel time yet): never a guess.
 */
export function tripsLine(leg: HarvestLeg | undefined, oneWayMinutes: number | null): string | null {
  if (!leg || leg.trips.trips === null || leg.trips.load_kg === null || leg.hours === null) return null;
  const n = leg.trips.trips;
  const load = leg.trips.load_source === "farmer" ? "your load" : "assumed load";
  let line = `About ${n} trip${n === 1 ? "" : "s"} per harvest at a typical yield (${Math.round(leg.trips.load_kg)} kg each, ${load}), about ${formatMinutes(leg.hours * 60)} on the road.`;
  // With planting months given, the engine slows the roads in a heavy-rain harvest month.
  if (oneWayMinutes !== null && leg.one_way_minutes !== null && leg.one_way_minutes > oneWayMinutes + 0.5)
    line += " Heavy rain in the harvest month may slow the roads (assumed).";
  return line;
}
