/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { LonLat, Travel, TransportMode } from '../types';
import {
  RoutingError,
  haversineKm,
  profileForMode,
  resolveTravel,
  roundForRoute,
  routeKey,
  routeUrl,
  type RouteFetcher,
  type TravelAssumptions,
} from './routing';

// Test-only numbers so the arithmetic is easy to check. They are NOT the app's
// defaults: those are assumptions owned by the Engine lead in params.ts (D27).
const MODES: TransportMode[] = ['walk', 'carabao', 'bicycle', 'motorcycle', 'tricycle', 'jeepney', 'truck'];
const A: TravelAssumptions = {
  speedKmh: Object.fromEntries(MODES.map((m) => [m, 10])) as Record<TransportMode, number>,
  waitMin: { jeepney: 15 },
  circuity: 2,
};

const FROM: LonLat = [124.24, 8.23];
const TO: LonLat = [124.3, 8.28];
const dest = (mode: TransportMode) => ({ id: 'd1', point: TO, mode });

const okRoute = (km: number): RouteFetcher => async () => km;
const offline: RouteFetcher = async () => {
  throw new TypeError('Network request failed');
};

test('haversine matches independently computed values', () => {
  // computed in plain Python with the same Earth radius (6371.0088 km)
  assert.ok(Math.abs(haversineKm(FROM, TO) - 8.631622243335407) < 1e-9);
  assert.ok(Math.abs(haversineKm([0, 0], [1, 0]) - 111.1950802335329) < 1e-9);
  assert.equal(haversineKm(FROM, FROM), 0);
});

test('mode to profile: foot for walk/carabao, bike for bicycle, car for motor modes', () => {
  assert.equal(profileForMode('walk'), 'foot');
  assert.equal(profileForMode('carabao'), 'foot');
  assert.equal(profileForMode('bicycle'), 'bike');
  for (const m of ['motorcycle', 'tricycle', 'jeepney', 'truck'] as const) {
    assert.equal(profileForMode(m), 'car');
  }
});

test('request rounds both points to 3 decimals (about 100 m) and uses lon,lat order', () => {
  assert.equal(roundForRoute(8.23456), 8.235);
  assert.equal(roundForRoute(124.2404), 124.24);
  const u = routeUrl('foot', [124.24049, 8.23051], [124.3, 8.28]);
  assert.equal(
    u,
    'https://routing.openstreetmap.de/routed-foot/route/v1/driving/124.24,8.231;124.3,8.28?overview=false',
  );
});

test('route key ignores sub-100 m movement and changes with a bigger move or another profile', () => {
  const k = routeKey('car', FROM, TO);
  assert.equal(routeKey('car', [124.2401, 8.2301], TO), k); // ~15 m: same rounded point
  assert.notEqual(routeKey('car', [124.2412, 8.23], TO), k); // ~130 m: rounds to another value
  assert.notEqual(routeKey('foot', FROM, TO), k);
});

test('road route: minutes = distance / mode speed + waiting time, source route', async () => {
  const r = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('jeepney'),
    assumptions: A,
    fetcher: okRoute(20),
  });
  assert.equal(r.travel.source, 'route');
  assert.equal(r.travel.route_profile, 'car');
  assert.equal(r.travel.distance_km, 20);
  assert.equal(r.travel.minutes, 20 / 10 * 60 + 15); // 120 + 15 waiting
  assert.equal(r.needsConfirmation, false);
  assert.ok(r.key);
});

test("the farmer's own time always wins and makes no request", async () => {
  let calls = 0;
  const r = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('walk'),
    assumptions: A,
    farmerMinutes: 45,
    fetcher: async () => {
      calls++;
      return 5;
    },
  });
  assert.equal(calls, 0);
  assert.equal(r.travel.source, 'farmer');
  assert.equal(r.travel.minutes, 45);
  assert.equal(r.travel.route_profile, null);
  assert.equal(r.needsConfirmation, false);
});

test("a farmer time of 0 minutes still counts (not treated as 'not given')", async () => {
  const r = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('walk'),
    assumptions: A,
    farmerMinutes: 0,
    fetcher: okRoute(5),
  });
  assert.equal(r.travel.source, 'farmer');
  assert.equal(r.travel.minutes, 0);
});

test('offline: labelled estimate = straight line x circuity / speed, and the farmer is asked to confirm', async () => {
  const r = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('tricycle'),
    assumptions: A,
    fetcher: offline,
  });
  const km = 8.631622243335407 * 2;
  assert.equal(r.travel.source, 'estimate');
  assert.equal(r.travel.route_profile, null);
  assert.ok(Math.abs((r.travel.distance_km as number) - km) < 1e-9);
  assert.ok(Math.abs(r.travel.minutes - (km / 10) * 60) < 1e-9);
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.key, null); // an estimate is never cached as a route
});

test('a routing server error or "no route" also falls back to the estimate', async () => {
  const bad: RouteFetcher = async () => {
    throw new RoutingError('No route found (NoRoute)');
  };
  const r = await resolveTravel({ lotCentroid: FROM, destination: dest('truck'), assumptions: A, fetcher: bad });
  assert.equal(r.travel.source, 'estimate');
});

test('cached route is reused when the key is unchanged and refetched when a point moved', async () => {
  const first = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('truck'),
    assumptions: A,
    fetcher: okRoute(10),
  });
  let calls = 0;
  const counting: RouteFetcher = async () => {
    calls++;
    return 12;
  };
  const same = await resolveTravel({
    lotCentroid: [124.2401, 8.2301],
    destination: dest('truck'),
    assumptions: A,
    cached: first.travel,
    cachedKey: first.key,
    fetcher: counting,
  });
  assert.equal(calls, 0);
  assert.equal(same.fetched, false);
  assert.deepEqual(same.travel, first.travel);

  const moved = await resolveTravel({
    lotCentroid: [124.25, 8.23],
    destination: dest('truck'),
    assumptions: A,
    cached: first.travel,
    cachedKey: first.key,
    fetcher: counting,
  });
  assert.equal(calls, 1);
  assert.equal(moved.travel.distance_km, 12);
});

test('a cached estimate is retried when back online', async () => {
  const est = await resolveTravel({ lotCentroid: FROM, destination: dest('truck'), assumptions: A, fetcher: offline });
  const again = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('truck'),
    assumptions: A,
    cached: est.travel,
    cachedKey: est.key,
    fetcher: okRoute(9),
  });
  assert.equal(again.travel.source, 'route');
  assert.equal(again.travel.distance_km, 9);
});

test('a farmer time keeps the known distance from an earlier route', async () => {
  const route = await resolveTravel({ lotCentroid: FROM, destination: dest('truck'), assumptions: A, fetcher: okRoute(10) });
  const r = await resolveTravel({
    lotCentroid: FROM,
    destination: dest('truck'),
    assumptions: A,
    farmerMinutes: 30,
    cached: route.travel as Travel,
  });
  assert.equal(r.travel.distance_km, 10);
  assert.equal(r.travel.source, 'farmer');
});

test('a mode without a positive speed throws instead of inventing one', async () => {
  const bad = { ...A, speedKmh: { ...A.speedKmh, truck: 0 } };
  await assert.rejects(
    resolveTravel({ lotCentroid: FROM, destination: dest('truck'), assumptions: bad, fetcher: okRoute(5) }),
    RangeError,
  );
});
