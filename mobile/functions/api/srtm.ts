// Cloudflare Pages Function: GET /api/srtm?lat=..&lon=..
//
// Same-origin proxy for NASA SRTM heights from Open Topo Data, because its public API sends no
// CORS header (pipeline/fetch_srtm.py). It takes one point already rounded to 0.001 degree by the
// app, re-rounds it (never trusts the caller), asks for the 9-point 3 x 3 grid the app needs for
// the slope, and returns Open Topo Data's answer unchanged. Nothing is stored except the
// response in Cloudflare's edge cache for 30 days, keyed by the rounded point, so the shared
// public API (1 call per second, 1000 per day) is asked once per ~110 m square.

import { gridPoints, OPENTOPODATA_URL, roundForSrtm } from "../../src/data/srtm";

type EdgeCache = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };
type Ctx = { request: Request; waitUntil(p: Promise<unknown>): void };

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

export const onRequestGet = async ({ request, waitUntil }: Ctx): Promise<Response> => {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 60 || Math.abs(lon) > 180) {
    // SRTM covers 60 N to 56 S; anything else is a bad request.
    return json({ status: "INVALID_REQUEST", error: "lat and lon are required" }, 400);
  }
  const la = roundForSrtm(lat);
  const lo = roundForSrtm(lon);
  const locations = gridPoints(la, lo)
    .map(([y, x]) => `${y},${x}`)
    .join("|");
  const upstream = `${OPENTOPODATA_URL}?locations=${encodeURIComponent(locations)}`;

  const cache = (globalThis as unknown as { caches: { default: EdgeCache } }).caches.default;
  const key = new Request(`https://srtm-cache.invalid/${la},${lo}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  let res: Response;
  try {
    res = await fetch(upstream, { headers: { "User-Agent": "agrosprout-web" } });
  } catch {
    return json({ status: "UPSTREAM_ERROR" }, 502);
  }
  if (!res.ok) return json({ status: "UPSTREAM_ERROR", upstream_status: res.status }, res.status === 429 ? 429 : 502);
  const body = await res.text();
  const out = new Response(body, {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" },
  });
  waitUntil(cache.put(key, out.clone()));
  return out;
};
