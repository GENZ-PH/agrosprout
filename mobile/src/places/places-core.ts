// S6 "Where does your harvest go?" (#30, docs/11-user-flow.md): the choices, labels and small
// calculations the screen uses. No React Native imports, so it runs in Node tests.
// Travel times themselves are filled by the travel sync (src/state/travel-sync-core.ts).
import type { MapPlace } from "../map/bridge";
import type { Destination, DestinationType, Lot, Travel, TransportMode } from "../types";

export const PLACE_TYPE_OPTIONS: readonly { value: DestinationType; label: string; hint: string }[] = [
  { value: "market", label: "Market", hint: "Where you sell your harvest" },
  { value: "storage", label: "Storage", hint: "Bodega, dryer or warehouse" },
  { value: "buyer", label: "Buyer or trading post", hint: "A trader who buys from you" },
  { value: "coop", label: "Cooperative", hint: "A farmers' group" },
];

/** In the order of docs/11 S6. */
export const MODE_OPTIONS: readonly { value: TransportMode; label: string }[] = [
  { value: "walk", label: "Walking" },
  { value: "carabao", label: "Carabao or cart" },
  { value: "bicycle", label: "Bicycle" },
  { value: "motorcycle", label: "Motorcycle (including habal-habal)" },
  { value: "tricycle", label: "Tricycle" },
  { value: "jeepney", label: "Jeepney or bus" },
  { value: "truck", label: "Truck or pickup" },
];

export const typeLabel = (t: DestinationType) => PLACE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
export const modeLabel = (m: TransportMode) => MODE_OPTIONS.find((o) => o.value === m)?.label ?? m;

/** "Market", then "Market 2", "Market 3" … so two places never share a name. */
export function defaultPlaceName(type: DestinationType, existing: readonly Pick<Destination, "name">[]): string {
  const base = typeLabel(type);
  const taken = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/** "55 min", "1 h 10 min", "2 h". Rounded to whole minutes. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** How the time was found, in the words of docs/11 S6. */
export function sourceLabel(source: Travel["source"]): string {
  return source === "route" ? "road route" : source === "estimate" ? "rough estimate" : "your time";
}

/** Largest travel time a farmer can type: one day. A sanity limit for typing mistakes, not a measured value. */
export const MAX_MINUTES = 1440;

/** Whole minutes from what the farmer typed, or `null` when it is not a number from 1 to MAX_MINUTES. */
export function parseMinutes(input: string): number | null {
  const t = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number(t));
  return n >= 1 && n <= MAX_MINUTES ? n : null;
}

/** An optional positive number ("I don't know" = empty = `null`). `undefined` means it was typed but is not valid. */
export function parseOptionalPositive(input: string): number | null | undefined {
  const t = input.trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 ? n : undefined;
}

/** "Looks right ✓": the time on screen becomes the farmer's own time. It then always wins (rule 9). */
export function confirmTravel(t: Travel): Travel {
  return { ...t, source: "farmer", route_profile: null };
}

/** "Change: __ min": the farmer's own time, kept with any known distance. */
export function changeTravel(destinationId: string, minutes: number, previous: Travel | undefined): Travel {
  return { destination_id: destinationId, distance_km: previous?.distance_km ?? null, minutes, source: "farmer", route_profile: null };
}

export interface TravelRow {
  lotId: string;
  lotName: string;
  /** `null` while the sync has not filled it yet (first request running, or no lot data). */
  travel: Travel | null;
}

/** One row per lot for one place, in the order of the lots. */
export function travelRows(lots: readonly Pick<Lot, "id" | "name" | "travel">[], destinationId: string): TravelRow[] {
  return lots.map((l) => ({ lotId: l.id, lotName: l.name, travel: l.travel.find((t) => t.destination_id === destinationId) ?? null }));
}

/** Places for the map page. */
export function mapPlaces(destinations: readonly Destination[]): MapPlace[] {
  return destinations.map((d) => ({ id: d.id, name: d.name, point: d.point }));
}

/** What the "Save place" form gives, or why it cannot be saved yet. */
export type PlaceDraftResult =
  | { ok: true; destination: Omit<Destination, "id"> }
  | { ok: false; problem: "no-point" | "no-name" | "bad-load" | "bad-fare" };

export interface PlaceDraft {
  point: [number, number] | null;
  name: string;
  type: DestinationType;
  mode: TransportMode;
  loadText: string;
  fareText: string;
}

export function placeFromDraft(d: PlaceDraft): PlaceDraftResult {
  if (!d.point) return { ok: false, problem: "no-point" };
  const name = d.name.trim();
  if (!name) return { ok: false, problem: "no-name" };
  const load = parseOptionalPositive(d.loadText);
  if (load === undefined) return { ok: false, problem: "bad-load" };
  const fare = parseOptionalPositive(d.fareText);
  if (fare === undefined) return { ok: false, problem: "bad-fare" };
  return { ok: true, destination: { name, type: d.type, point: d.point, mode: d.mode, load_kg_per_trip: load, fare_one_way: fare } };
}
