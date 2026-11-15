// Live NASA AppEEARS point samples for a lot (team decision 2026-11-15, CLAUDE.md rule 8): MODIS
// MOD13Q1 NDVI, HLS NDVI with Fmask, ECOSTRESS ESI and daily ET, with the same layers, QA rules and
// per-calendar-month statistics as pipeline/fetch_appeears.py (see src/lib/appeears/build.ts).
//
// AppEEARS point tasks take minutes, so this is two calls:
//   POST /v1/nasa/appeears        { lat, lon }  -> { task_id }   (reuses a task for the same 0.1° cell)
//   GET  /v1/nasa/appeears/:id                  -> { status: "pending", progress? } or { status: "done", ndvi, hls, ecostress, source }
//
// Privacy: lat/lon are rounded to 0.1° before any use (request, cache key, task); coordinates are
// never logged. Credentials: Earthdata user/password from Worker secrets, only sent to AppEEARS /login.
// Caches (caches.default, synthetic keys): token 12 h, cell -> task and done results 30 days.
// Note: the Cache API does not persist on *.workers.dev, so there the POST falls back to listing
// the account's AppEEARS tasks to find one for the same cell.
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { fail, ok } from "../lib/response";
import { validate } from "../lib/validate";
import { parseCsv, type CsvRow } from "../lib/appeears/csv";
import {
  LAYERS,
  buildEcostress,
  buildHls,
  buildNdvi,
  findCsv,
  taskPeriod,
  type LiveEcostressFile,
  type LiveNdviFile,
  type Point,
  type Provenance,
} from "../lib/appeears/build";
import { Appeears, AppeearsError, Budget } from "../lib/appeears/client";

/** Task name for every live task; GET only answers for tasks with this name. Holds no location. */
const TASK_NAME = "agrosprout-live-v1";
const CACHE = "https://cache.agrosprout/appeears/v1";
const DAY_S = 24 * 60 * 60;
/** Done results per 0.1° cell (team decision: 30 days). AppEEARS also keeps a bundle about 30 days. */
const RESULT_TTL_S = 30 * DAY_S;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AppeearsSubmitted = { task_id: string; status: "submitted" | "pending" | "done"; reused: boolean };
export type AppeearsPending = { status: "pending"; task_id: string; appeears_status: string; progress?: number };
export type AppeearsDone = {
  status: "done";
  task_id: string;
  point: Point;
  ndvi: LiveNdviFile | null;
  hls: LiveNdviFile | null;
  ecostress: LiveEcostressFile | null;
  source: Provenance[];
  cached: boolean;
};

/** Round to 0.1° (CLAUDE.md rule 8); avoid -0. */
const round1 = (v: number) => Math.round(v * 10) / 10 + 0;
const cellOf = (p: Point) => `${p.lat.toFixed(1)}_${p.lon.toFixed(1)}`;

const putJson = (key: string, data: unknown, ttl: number) =>
  caches.default.put(key, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `max-age=${ttl}` } }));
async function getJson<T>(key: string): Promise<T | null> {
  const hit = await caches.default.match(key);
  return hit ? ((await hit.json()) as T) : null;
}

type TaskInfo = {
  task_id: string;
  task_name?: string;
  status?: string;
  created?: string;
  params?: { coordinates?: { latitude: number | string; longitude: number | string }[]; dates?: { startDate: string; endDate: string }[] };
};

function taskPoint(t: TaskInfo): Point | null {
  const c = t.params?.coordinates?.[0];
  if (!c) return null;
  const lat = Number(c.latitude);
  const lon = Number(c.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat: round1(lat), lon: round1(lon) } : null;
}

function client(c: Context<{ Bindings: Env }>): Appeears | null {
  const { EARTHDATA_USER: user, EARTHDATA_PASS: pass } = c.env;
  return user && pass ? new Appeears({ user, pass }, new Budget()) : null;
}

function upstream(c: Context, e: unknown) {
  if (e instanceof AppeearsError) {
    console.error("nasa-appeears:", e.message);
    if (e.status === 503) return fail(c, 503, "not_configured", "NASA AppEEARS login is not working");
    if (e.status === 404) return fail(c, 404, "task_not_found", "No such AppEEARS task");
    return fail(c, 502, "upstream_error", "NASA AppEEARS did not answer");
  }
  throw e;
}

export const nasaAppeears = new Hono<{ Bindings: Env }>()
  .post(
    "/",
    validate("json", z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })),
    async (c) => {
      const api = client(c);
      if (!api) return fail(c, 503, "not_configured", "NASA AppEEARS is not switched on yet");
      const body = c.req.valid("json");
      const point: Point = { lat: round1(body.lat), lon: round1(body.lon) };
      const cell = cellOf(point);

      const done = await getJson<AppeearsDone>(`${CACHE}/result/${cell}`);
      if (done) return ok(c, { task_id: done.task_id, status: "done", reused: true } satisfies AppeearsSubmitted);
      const known = await getJson<{ task_id: string }>(`${CACHE}/cell-task/${cell}`);
      if (known) return ok(c, { task_id: known.task_id, status: "pending", reused: true } satisfies AppeearsSubmitted);

      try {
        // Cache miss (or *.workers.dev, where the Cache API does not persist): look for a live task
        // for this cell among the account's tasks before submitting another.
        const list = await api.json<TaskInfo[]>(`/task?limit=200`);
        const same = (Array.isArray(list) ? list : [])
          .filter((t) => t.task_name === TASK_NAME && t.status !== "error" && t.status !== "deleted" && t.status !== "expired")
          .filter((t) => {
            const p = taskPoint(t);
            return p !== null && cellOf(p) === cell;
          })
          .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""))[0];
        if (same && UUID.test(same.task_id)) {
          c.executionCtx.waitUntil(
            Promise.all([putJson(`${CACHE}/cell-task/${cell}`, { task_id: same.task_id }, RESULT_TTL_S), putJson(`${CACHE}/task-cell/${same.task_id}`, point, RESULT_TTL_S)]),
          );
          return ok(c, { task_id: same.task_id, status: same.status === "done" ? "done" : "pending", reused: true } satisfies AppeearsSubmitted);
        }

        const period = taskPeriod(new Date());
        const res = await api.json<{ task_id?: string }>("/task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: "point",
            task_name: TASK_NAME,
            params: {
              dates: [{ startDate: period.startDate, endDate: period.endDate }],
              layers: LAYERS.map(([product, layer]) => ({ product, layer })),
              coordinates: [{ id: "cell", category: "live", latitude: point.lat, longitude: point.lon }],
            },
          }),
        });
        const taskId = res.task_id;
        if (!taskId || !UUID.test(taskId)) return fail(c, 502, "upstream_error", "NASA AppEEARS did not return a task id");
        c.executionCtx.waitUntil(
          Promise.all([putJson(`${CACHE}/cell-task/${cell}`, { task_id: taskId }, RESULT_TTL_S), putJson(`${CACHE}/task-cell/${taskId}`, point, RESULT_TTL_S)]),
        );
        return ok(c, { task_id: taskId, status: "submitted", reused: false } satisfies AppeearsSubmitted, 202);
      } catch (e) {
        return upstream(c, e);
      }
    },
  )
  .get("/:task_id", validate("param", z.object({ task_id: z.string().regex(UUID) })), async (c) => {
    const api = client(c);
    if (!api) return fail(c, 503, "not_configured", "NASA AppEEARS is not switched on yet");
    const taskId = c.req.valid("param").task_id.toLowerCase();

    const knownPoint = await getJson<Point>(`${CACHE}/task-cell/${taskId}`);
    if (knownPoint) {
      const hit = await getJson<AppeearsDone>(`${CACHE}/result/${cellOf(knownPoint)}`);
      if (hit && hit.task_id === taskId) return ok(c, { ...hit, cached: true } satisfies AppeearsDone);
    }

    try {
      const task = await api.json<TaskInfo>(`/task/${taskId}`);
      if (task.task_name !== TASK_NAME) return fail(c, 404, "task_not_found", "No such AppEEARS task");
      const point = taskPoint(task);
      if (!point) return fail(c, 502, "upstream_error", "NASA AppEEARS task has no point");
      const cell = cellOf(point);
      const st = task.status ?? "unknown";

      if (st === "error" || st === "expired" || st === "deleted") {
        c.executionCtx.waitUntil(caches.default.delete(`${CACHE}/cell-task/${cell}`));
        return fail(c, 502, "task_failed", `The NASA AppEEARS task ended with status "${st}"; submit again`);
      }
      if (st !== "done") {
        let progress: number | undefined;
        const sres = await api.call(`/status/${taskId}`, { redirect: "manual" });
        if (sres.ok) {
          const s = (await sres.json()) as { progress?: { summary?: number } | number };
          const p = typeof s.progress === "number" ? s.progress : s.progress?.summary;
          if (typeof p === "number" && Number.isFinite(p)) progress = p;
        } else await sres.body?.cancel();
        return ok(c, { status: "pending", task_id: taskId, appeears_status: st, ...(progress === undefined ? {} : { progress }) } satisfies AppeearsPending);
      }

      const bundle = await api.json<{ files?: { file_id: string; file_name: string }[] }>(`/bundle/${taskId}`);
      const files = bundle.files ?? [];
      const products = ["MOD13Q1.061", "HLSL30_VI.020", "HLSL30.020", "HLSS30_VI.020", "HLSS30.020", "ECO_L4T_ESI.002", "ECO_L3T_JET.002"];
      const csv: Record<string, CsvRow[] | null> = {};
      await Promise.all(
        products.map(async (p) => {
          const f = findCsv(files, p);
          csv[p] = f ? parseCsv(await api.bundleFile(taskId, f.file_id)) : null;
        }),
      );

      const period = taskPeriod(new Date(task.created ?? Date.now()));
      const today = new Date().toISOString().slice(0, 10);
      const ctx = { id: `appeears-cell-${cell}`, point, taskId, today };
      const ndvi = csv["MOD13Q1.061"] ? buildNdvi(csv["MOD13Q1.061"], [period.modisStartYear, period.modisEndYear], ctx) : null;
      const pairs: Record<string, [CsvRow[], CsvRow[]]> = {};
      for (const [vi, refl] of [
        ["HLSL30_VI.020", "HLSL30.020"],
        ["HLSS30_VI.020", "HLSS30.020"],
      ] as const) {
        const v = csv[vi];
        const r = csv[refl];
        if (v && r) pairs[vi] = [v, r];
      }
      const hls = Object.keys(pairs).length ? buildHls(pairs, ctx) : null;
      const esi = csv["ECO_L4T_ESI.002"];
      const jet = csv["ECO_L3T_JET.002"];
      const ecostress = esi && jet ? buildEcostress(esi, jet, ctx) : null;
      const source: Provenance[] = [...(ndvi ? [ndvi.provenance] : []), ...(hls ? [hls.provenance] : []), ...(ecostress?.provenance ?? [])];

      const data: AppeearsDone = { status: "done", task_id: taskId, point, ndvi, hls, ecostress, source, cached: false };
      c.executionCtx.waitUntil(
        Promise.all([putJson(`${CACHE}/result/${cell}`, data, RESULT_TTL_S), putJson(`${CACHE}/task-cell/${taskId}`, point, RESULT_TTL_S)]),
      );
      console.log("nasa-appeears: done", { fetches: api.budget.used });
      return ok(c, data);
    } catch (e) {
      return upstream(c, e);
    }
  });

