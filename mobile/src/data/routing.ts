/**
 * Travel time from a lot to a harvest destination (issue #12, docs/07 §3c).
 *
 * Order of sources, always labelled on the result:
 *   1. the farmer's own time (always wins, rule 9)
 *   2. road distance from an OSRM server, divided by the mode speed
 *   3. offline fallback: straight line x circuity, divided by the mode speed
 *
 * Mode speeds, waiting times and circuity are ASSUMPTIONS owned by the Engine
 * lead (D27, `engine/params.ts`). This file has no default values on purpose:
 * the caller passes them in, so no number is invented here.
 *
 * Pure TypeScript with an injected fetcher, so it is testable in Node. Only the
 * network helper in `../net/fetch` is imported.
 *
 * Routing server: FOSSGIS `routing.openstreetmap.de` (car, bike and foot
 * profiles). Its published policy: one request per second at most, no heavy
 * use, a valid User-Agent, and OpenStreetMap attribution
 * (https://routing.openstreetmap.de/about.html, read 2026-11-14). The OSRM demo
 * server has the same 1 request/second limit and is non-commercial.
 */

import type { Destination, LonLat, RouteProfile, Travel, TransportMode } from '../types';
import { fetchWithTimeout } from '../net/fetch';

export const ROUTING_BASE = 'https://routing.openstreetmap.de';
/** Text the UI must show wherever a road route was used. */
export const ROUTING_ATTRIBUTION = 'Routing © OpenStreetMap contributors';
/** FOSSGIS asks for a valid User-Agent. Generic on purpose: no personal details. */
export const ROUTING_USER_AGENT = 'agrosprout-app';

/** Assumptions the Engine lead sets in `params.ts` (D27). Nothing here has a default. */
export interface TravelAssumptions {
  /** Average speed per mode, km/h. */
  speedKmh: Record<TransportMode, number>;
  /** Waiting time per trip for shared transport, minutes. Missing mode = 0. */
  waitMin: Partial<Record<TransportMode, number>>;
  /** Straight-line to road distance multiplier for the offline estimate. */
  circuity: number;
}

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingError';
  }
}

/** foot for walking and carabao/cart, bike for bicycle, car for motor modes (docs/07 §3c). */
export function profileForMode(mode: TransportMode): RouteProfile {
  if (mode === 'walk' || mode === 'carabao') return 'foot';
  if (mode === 'bicycle') return 'bike';
  return 'car';
}

/** Round to 3 decimals (about 100 m) so the exact location is never sent (rule 8). */
export function roundForRoute(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function routeUrl(profile: RouteProfile, from: LonLat, to: LonLat): string {
  const pt = (p: LonLat) => `${roundForRoute(p[0])},${roundForRoute(p[1])}`;
  return `${ROUTING_BASE}/routed-${profile}/route/v1/driving/${pt(from)};${pt(to)}?overview=false`;
}

/**
 * Cache key for one (profile, from, to). Same key = same request, so the caller
 * refetches only when the rounded points (about 100 m) or the profile change.
 */
export function routeKey(profile: RouteProfile, from: LonLat, to: LonLat): string {
  return routeUrl(profile, from, to);
}

/** Great-circle distance in km. */
export function haversineKm(a: LonLat, b: LonLat): number {
  const R = 6371.0088; // mean Earth radius, km
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Fetches one road route and returns its distance in km. Injected in tests. */
export type RouteFetcher = (
  profile: RouteProfile,
  from: LonLat,
  to: LonLat,
  signal?: AbortSignal,
) => Promise<number>;

export const fetchRouteKm: RouteFetcher = async (profile, from, to, signal) => {
  const res = await fetchWithTimeout(
    routeUrl(profile, from, to),
    { signal, headers: { 'User-Agent': ROUTING_USER_AGENT } },
  );
  if (!res.ok) throw new RoutingError(`Routing request failed (${res.status})`);
  const json = (await res.json()) as { code?: string; routes?: { distance?: number }[] };
  const meters = json.routes?.[0]?.distance;
  if (json.code !== 'Ok' || typeof meters !== 'number' || !Number.isFinite(meters)) {
    throw new RoutingError(`No route found (${json.code ?? 'unknown'})`);
  }
  return meters / 1000;
};

function minutesFor(km: number, mode: TransportMode, a: TravelAssumptions): number {
  const speed = a.speedKmh[mode];
  if (!(speed > 0)) throw new RangeError(`No positive speed for mode "${mode}"`);
  return (km / speed) * 60 + (a.waitMin[mode] ?? 0);
}

export interface ResolvedTravel {
  travel: Travel;
  /** Store this next to `travel`; pass it back as `cachedKey` to skip a refetch. */
  key: string | null;
  /** True when the number is a rough estimate: ask the farmer to confirm it. */
  needsConfirmation: boolean;
  /** True when a network request was made. */
  fetched: boolean;
}

/**
 * Travel for one lot and one destination.
 *
 * - `farmerMinutes` given: used as is, source `farmer`, no request.
 * - `cached` has source `route` and `cachedKey` equals the key of this request:
 *   returned as is, no request.
 * - Otherwise one request. Offline or failed: the labelled estimate.
 */
export async function resolveTravel(args: {
  lotCentroid: LonLat;
  destination: Pick<Destination, 'id' | 'point' | 'mode'>;
  assumptions: TravelAssumptions;
  farmerMinutes?: number | null;
  cached?: Travel | null;
  cachedKey?: string | null;
  fetcher?: RouteFetcher;
  signal?: AbortSignal;
}): Promise<ResolvedTravel> {
  const { lotCentroid: from, destination: d, assumptions: a, farmerMinutes, cached, signal } = args;
  const fetcher = args.fetcher ?? fetchRouteKm;
  const profile = profileForMode(d.mode);
  const key = routeKey(profile, from, d.point);

  if (typeof farmerMinutes === 'number' && Number.isFinite(farmerMinutes) && farmerMinutes >= 0) {
    return {
      travel: {
        destination_id: d.id,
        distance_km: cached?.distance_km ?? null,
        minutes: farmerMinutes,
        source: 'farmer',
        route_profile: null,
      },
      key: null,
      needsConfirmation: false,
      fetched: false,
    };
  }

  if (cached && cached.source === 'route' && args.cachedKey === key && cached.destination_id === d.id) {
    return { travel: cached, key, needsConfirmation: false, fetched: false };
  }

  try {
    const km = await fetcher(profile, from, d.point, signal);
    return {
      travel: {
        destination_id: d.id,
        distance_km: km,
        minutes: minutesFor(km, d.mode, a),
        source: 'route',
        route_profile: profile,
      },
      key,
      needsConfirmation: false,
      fetched: true,
    };
  } catch (err) {
    if (err instanceof RangeError) throw err; // a missing assumption is a bug, not "offline"
    const km = haversineKm(from, d.point) * a.circuity;
    return {
      travel: {
        destination_id: d.id,
        distance_km: km,
        minutes: minutesFor(km, d.mode, a),
        source: 'estimate',
        route_profile: null,
      },
      key: null,
      needsConfirmation: true,
      fetched: true,
    };
  }
}
