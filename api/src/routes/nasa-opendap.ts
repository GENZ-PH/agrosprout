// Live NASA data for a lot (team decision 2026-11-15, CLAUDE.md rule 8): IMERG rainfall, FLDAS model
// water balance, SMAP L4 soil moisture (all NASA Earthdata cloud OPeNDAP, bearer token from the Worker
// secret EARTHDATA_TOKEN) and SRTM elevation and slope (public Open Topo Data). Ports of the pipeline
// scripts in pipeline/fetch_*.py, with fewer years so one call stays under the Workers subrequest cap.
//
// Privacy: lat and lon are rounded to 0.1 degree before any use, including the cache key, and are
// never logged. Only NASA and Open Topo Data see the rounded point.
//
// Each full answer is cached for 30 days per dataset and rounded cell, so a cell is computed once.
import { Hono, type Context } from "hono";
import { z } from "zod";
import { UpstreamError, cacheKey, cacheResponse, roundTenth } from "../lib/nasa/common";
import { fldas, type FldasAnswer } from "../lib/nasa/fldas";
import { imerg, type ImergAnswer } from "../lib/nasa/imerg";
import { smap, type SmapAnswer } from "../lib/nasa/smap";
import { srtm, type SrtmAnswer } from "../lib/nasa/srtm";
import { fail, ok } from "../lib/response";
import { validate } from "../lib/validate";

export type { FldasAnswer, ImergAnswer, SmapAnswer, SrtmAnswer };

const point = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** Browsers and the app may keep an answer for a day; the edge cache keeps it 30 days (lib/nasa/common.ts CACHE_SECONDS). */
const CLIENT_CACHE = "public, max-age=86400";

// Bump when an answer's shape or method changes, so old cached answers are not served.
const VERSION = "v1";

type Ctx = Context<{ Bindings: Env }>;

async function serve<T extends object>(
  c: Ctx,
  dataset: string,
  needsToken: boolean,
  compute: (lat: number, lon: number, token: string) => Promise<T & { complete: boolean }>,
) {
  const q = point.parse(c.req.query());
  const lat = roundTenth(q.lat);
  const lon = roundTenth(q.lon);
  const token = c.env.EARTHDATA_TOKEN?.trim() ?? "";
  if (needsToken && !token) return fail(c, 503, "not_configured", "NASA Earthdata access is not set up on this server");

  const key = cacheKey(`${VERSION}/${dataset}`, lat, lon);
  const hit = await caches.default.match(key);
  if (hit) {
    c.header("cache-control", CLIENT_CACHE);
    return ok(c, { ...((await hit.json()) as T), cached: true });
  }
  const started = Date.now();
  try {
    const { complete, ...data } = await compute(lat, lon, token);
    // Only a complete answer (no failed granule) is kept for 30 days; a partial one is served once.
    if (complete) c.executionCtx.waitUntil(caches.default.put(key, cacheResponse(data)));
    c.header("cache-control", complete ? CLIENT_CACHE : "no-store");
    console.log(`nasa-${dataset}: computed in ${Date.now() - started} ms${complete ? "" : " (partial)"}`);
    return ok(c, { ...(data as unknown as T), cached: false });
  } catch (e) {
    if (e instanceof UpstreamError) {
      console.warn(`nasa-${dataset}: ${e.code}`);
      return fail(c, e.status, e.code, e.message);
    }
    throw e;
  }
}

export const nasaOpendap = new Hono<{ Bindings: Env }>()
  /** GPM IMERG monthly rainfall percentiles, last 36 published months. */
  .get("/imerg", validate("query", point), (c) =>
    serve<ImergAnswer>(c, "imerg", true, async (lat, lon, token) => {
      const a = await imerg(lat, lon, token);
      return { ...a, complete: a.months_failed === 0 };
    }),
  )
  /** FLDAS Noah monthly soil moisture, ET, rainfall and runoff percentiles, last 36 published months. */
  .get("/fldas", validate("query", point), (c) =>
    serve<FldasAnswer>(c, "fldas", true, async (lat, lon, token) => {
      const a = await fldas(lat, lon, token);
      return { ...a, complete: a.months_failed === 0 };
    }),
  )
  /** SMAP L4 surface and root-zone soil moisture, one sample per month for the last 36 months. */
  .get("/smap", validate("query", point), (c) =>
    serve<SmapAnswer>(c, "smap", true, async (lat, lon, token) => {
      const a = await smap(lat, lon, token, c.executionCtx);
      return { ...a, complete: a.sampling.failed_requests === 0 };
    }),
  )
  /** SRTM elevation and Horn slope at the rounded point. */
  .get("/srtm", validate("query", point), (c) =>
    serve<SrtmAnswer>(c, "srtm", false, async (lat, lon) => ({ ...(await srtm(lat, lon)), complete: true })),
  );
