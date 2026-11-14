import {
  fetchRouteKm,
  profileForMode,
  resolveTravel,
  routeKey,
  RoutingError,
  type RouteFetcher,
  type TravelAssumptions,
} from "../data/routing";
import { ROAD_CIRCUITY, TRAVEL_SPEED_KMH, TRAVEL_WAIT_MIN } from "../engine/params";
import type { Destination, Lot, RouteProfile, Travel } from "../types";

// Keeps `lot.travel` filled: one entry per lot and destination (issue #12, #30).
//   - a place added offline gets the labelled rough estimate, and a road route once online
//   - a lot or place that moved is routed again; one that did not is never fetched twice
//   - the farmer's own time (source "farmer") is never touched (rule 9)
// No React Native imports. The speeds, waiting times and circuity are the labelled
// assumptions in `engine/params.ts`; this file adds no numbers of its own except the
// request spacing the routing server asks for.

/** FOSSGIS asks for at most one request per second (THIRD_PARTY.md). A little more, to be safe. */
export const ROUTING_MIN_INTERVAL_MS = 1100;

/** The assumptions `resolveTravel` needs, from `engine/params.ts`, for one routing profile. */
export function travelAssumptions(profile: RouteProfile): TravelAssumptions {
  return { speedKmh: TRAVEL_SPEED_KMH, waitMin: TRAVEL_WAIT_MIN, circuity: ROAD_CIRCUITY[profile] };
}

/** Route keys of the entries this device fetched, by `lotId|destinationId`. Lost on restart, which is fine. */
export type RouteKeys = Map<string, string>;

export interface TravelSyncDeps {
  getLots: () => Lot[];
  getDestinations: () => Destination[];
  setTravel: (lotId: string, travel: Travel) => void;
  keys: RouteKeys;
  fetcher?: RouteFetcher;
  signal?: AbortSignal;
  /** Injected in tests; defaults to a timer. */
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface TravelSyncResult {
  /** Entries filled from a road route. */
  route: { lotId: string; destinationId: string }[];
  /** Entries that are a rough estimate: ask the farmer to confirm each one. */
  estimate: { lotId: string; destinationId: string }[];
  /** True when a request failed for a network or server reason, so the rest used the estimate without asking. */
  offline: boolean;
}

const pairKey = (lotId: string, destId: string) => `${lotId}|${destId}`;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const noRoute = (e: unknown) => e instanceof RoutingError && e.message.startsWith("No route found");

/**
 * Fills the missing and out-of-date travel entries, one request at a time.
 * After one network or server failure it stops asking and gives the estimate for the rest,
 * because the next requests would fail the same way. "No route found" for one place does not stop the others.
 */
export async function syncTravel(deps: TravelSyncDeps): Promise<TravelSyncResult> {
  const result: TravelSyncResult = { route: [], estimate: [], offline: false };
  const base = deps.fetcher ?? fetchRouteKm;
  const wait = deps.wait ?? sleep;
  const now = deps.now ?? Date.now;
  let lastRequestAt: number | null = null;

  const fetcher: RouteFetcher = async (profile, from, to, signal) => {
    if (result.offline) throw new TypeError("offline");
    if (lastRequestAt !== null) {
      const gap = ROUTING_MIN_INTERVAL_MS - (now() - lastRequestAt);
      if (gap > 0) await wait(gap);
    }
    lastRequestAt = now();
    try {
      return await base(profile, from, to, signal);
    } catch (e) {
      if (!noRoute(e)) result.offline = true;
      throw e;
    }
  };

  for (const lotAtStart of deps.getLots()) {
    for (const destAtStart of deps.getDestinations()) {
      if (deps.signal?.aborted) return result;
      const lot = deps.getLots().find((l) => l.id === lotAtStart.id);
      const dest = deps.getDestinations().find((d) => d.id === destAtStart.id);
      if (!lot || !dest) continue;
      const existing = lot.travel.find((t) => t.destination_id === dest.id);
      if (existing?.source === "farmer") continue;

      const profile = profileForMode(dest.mode);
      // The mode is part of the key: two modes can share a profile (motorcycle and tricycle) but not a speed.
      const key = `${dest.mode}|${routeKey(profile, lot.centroid, dest.point)}`;
      const mine = pairKey(lot.id, dest.id);
      if (existing?.source === "route") {
        const stored = deps.keys.get(mine);
        if (stored === undefined) {
          deps.keys.set(mine, key); // saved in an earlier session: trust it
          continue;
        }
        if (stored === key && existing.route_profile === profile) continue;
      }

      const r = await resolveTravel({
        lotCentroid: lot.centroid,
        destination: dest,
        assumptions: travelAssumptions(profile),
        fetcher,
        signal: deps.signal,
      });

      // The farmer may have moved or removed the lot or place while we waited: only save what still matches.
      const lotNow = deps.getLots().find((l) => l.id === lot.id);
      const destNow = deps.getDestinations().find((d) => d.id === dest.id);
      const unchanged =
        lotNow &&
        destNow &&
        lotNow.centroid[0] === lot.centroid[0] &&
        lotNow.centroid[1] === lot.centroid[1] &&
        destNow.point[0] === dest.point[0] &&
        destNow.point[1] === dest.point[1] &&
        destNow.mode === dest.mode &&
        lotNow.travel.find((t) => t.destination_id === dest.id)?.source !== "farmer";
      if (!unchanged) continue;

      deps.setTravel(lot.id, r.travel);
      const ref = { lotId: lot.id, destinationId: dest.id };
      if (r.travel.source === "route") {
        deps.keys.set(mine, key);
        result.route.push(ref);
      } else {
        deps.keys.delete(mine);
        result.estimate.push(ref);
      }
    }
  }
  return result;
}
