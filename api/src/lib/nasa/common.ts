// Shared helpers for the live NASA routes (src/routes/nasa-opendap.ts), ported from the Python
// pipeline (pipeline/earthdata.py, fetch_imerg.py, aggregate.py). Pure fetch / Web APIs only.
//
// Privacy (CLAUDE.md rule 8): callers round the point to 0.1 degree before anything here sees it,
// and nothing here logs a coordinate, a URL with grid indices, or the token.

/** Public CMR granule search (no auth), as in the pipeline's granule_urls(). */
export const CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json";

/**
 * Cloudflare Workers free plan: 50 subrequests per request. We stop at 45 to leave room for the
 * Cache API calls and a margin (lead's brief, 2026-11-15).
 */
export const MAX_FETCHES = 45;
/**
 * At most this many NASA requests in flight at once (the brief said about 6). On 2026-11-15 a run at 6
 * had 15 of 36 IMERG subsets fail inside Hyrax; minutes later the token was rejected outright, so the
 * cause is not settled. 3 at a time plus one retry of transient failures is the cautious choice.
 */
export const CONCURRENCY = 3;
/** Per-fetch timeout. A month subset is a few hundred bytes and answered in about 1 s (measured 2026-11-15). */
export const FETCH_TIMEOUT_MS = 25_000;
/** A computed answer is kept for 30 days per dataset and 0.1 degree cell (lead's brief). */
export const CACHE_SECONDS = 2_592_000;

/** Only *.nasa.gov hosts get the bearer token (same rule as pipeline/earthdata.py TRUSTED_SUFFIX). */
const TRUSTED_SUFFIX = ".nasa.gov";

export class UpstreamError extends Error {
  constructor(
    readonly status: 502 | 503 | 504 | 422,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Round to 0.1 degree (one decimal), the only form of the point the Worker ever uses. */
export const roundTenth = (v: number) => Math.round(v * 10) / 10 + 0; // + 0 turns -0 into 0

/** Counts outbound fetches for one request so it never passes MAX_FETCHES. */
export class Budget {
  used = 0;
  take(): void {
    if (this.used >= MAX_FETCHES) throw new UpstreamError(502, "too_many_requests_needed", "This answer needs more NASA requests than one call may make");
    this.used += 1;
  }
}

const trusted = (url: string) => {
  const host = new URL(url).hostname;
  return host === TRUSTED_SUFFIX.slice(1) || host.endsWith(TRUSTED_SUFFIX);
};

/**
 * GET `url`. The token goes only to *.nasa.gov; redirects are followed by hand (at most 3) so a
 * redirect to another host (for example a pre-signed S3 link) never carries it.
 */
export async function getText(url: string, budget: Budget, token?: string): Promise<string> {
  let next = url;
  for (let hop = 0; hop < 4; hop++) {
    budget.take();
    const headers: Record<string, string> = { "user-agent": "agrosprout-api" };
    if (token && trusted(next)) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(next, { headers, redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new UpstreamError(timeout ? 504 : 502, timeout ? "upstream_timeout" : "upstream_unreachable", timeout ? "A NASA server did not answer in time" : "A NASA server could not be reached");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      next = new URL(res.headers.get("location") as string, next).toString();
      await res.body?.cancel();
      continue;
    }
    const text = await res.text();
    // Hyrax passes the archive's login redirect through when the token is not accepted (seen 2026-11-15
    // as HTTP 401, or as HTTP 200 with a DAP error naming urs.earthdata.nasa.gov/oauth).
    if (res.status === 401 || text.includes("urs.earthdata.nasa.gov/oauth")) throw new UpstreamError(503, "upstream_auth", "NASA Earthdata did not accept the Worker's token");
    if (res.status === 403) {
      // pipeline/fetch_imerg.py check_error(): GES DISC answers 403 when the token's account has not
      // approved the "NASA GESDISC DATA ARCHIVE" app (EULA).
      throw new UpstreamError(503, "upstream_refused", "The NASA archive refused the file (check the Earthdata account's approved apps)");
    }
    if (res.status === 429) throw new UpstreamError(503, "upstream_busy", "The NASA server is busy, try again later");
    if (!res.ok) throw new UpstreamError(502, "upstream_error", `A NASA server answered HTTP ${res.status}`);
    // Hyrax can answer 200 with a DAP error document (pipeline check_error()).
    if (text.includes("Error {")) throw new UpstreamError(502, "upstream_error", "The NASA OPeNDAP server answered with an error");
    return text;
  }
  throw new UpstreamError(502, "upstream_error", "Too many redirects from a NASA server");
}

/**
 * Map with at most `limit` promises in flight. Each result is the value or the error. Items that
 * failed with a transient upstream error are tried once more, in order, while `budget` has room.
 */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>, budget?: Budget): Promise<(R | UpstreamError)[]> {
  const out: (R | UpstreamError)[] = new Array(items.length);
  // A token or archive refusal will not change for the other files: stop at the first one.
  let fatal: UpstreamError | null = null;
  const run = async (idx: number[]) => {
    let i = 0;
    const worker = async () => {
      while (i < idx.length) {
        const k = idx[i++];
        if (fatal) {
          out[k] = fatal;
          continue;
        }
        try {
          out[k] = await fn(items[k]);
        } catch (e) {
          if (!(e instanceof UpstreamError)) throw e;
          out[k] = e;
          if (e.code === "upstream_auth" || e.code === "upstream_refused") fatal = e;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, idx.length) }, worker));
  };
  await run(items.map((_x, k) => k));
  if (budget && !fatal) {
    const transient = (e: unknown) => e instanceof UpstreamError && ["upstream_error", "upstream_timeout", "upstream_unreachable"].includes(e.code);
    const again = out.map((r, k) => (transient(r) ? k : -1)).filter((k) => k >= 0).slice(0, Math.max(0, MAX_FETCHES - budget.used));
    if (again.length) await run(again);
  }
  return out;
}

/** CMR umm_json item, only the fields we read. */
type CmrItem = { umm: { GranuleUR: string; RelatedUrls?: { URL: string; Subtype?: string }[] } };

/** Public CMR granule search -> [GranuleUR, OPeNDAP URL] pairs (pipeline pick_granules()). */
export async function cmrGranules(params: Record<string, string>, budget: Budget): Promise<[string, string][]> {
  const q = new URLSearchParams({ page_size: "200", ...params });
  const text = await getText(`${CMR}?${q}`, budget);
  const data = JSON.parse(text) as { items?: CmrItem[] };
  const out: [string, string][] = [];
  for (const it of data.items ?? []) {
    const url = it.umm.RelatedUrls?.find((r) => r.Subtype === "OPENDAP DATA")?.URL;
    if (url) out.push([it.umm.GranuleUR, url]);
  }
  return out;
}

/** CMR temporal range covering the last `years` years up to today (UTC). */
export function lastYears(years: number, now = new Date()): string {
  const y = now.getUTCFullYear();
  return `${y - years}-01-01T00:00:00Z,${now.toISOString().slice(0, 19)}Z`;
}

/** Hyrax `.dap.csv` -> {variable path without leading '/': rows}; empty cells -> null (pipeline parse_dap_csv()). */
export function parseDapCsv(text: string): Record<string, (number | null)[][]> {
  const out: Record<string, (number | null)[][]> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("/")) continue;
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const name = line.slice(0, comma).split("[", 1)[0].replace(/^\/+/, "");
    const cells = line.slice(comma + 1).split(",").map((c) => (c.trim() ? Number(c) : null));
    (out[name] ??= []).push(cells);
  }
  return out;
}

/**
 * Indices of the grid cells that contain `coord` (centres origin + res*i); two when it lies on an
 * edge (pipeline/fetch_imerg.py cell_indices()). A 0.1 degree point always lies on a corner of the
 * IMERG and FLDAS grids, whose centres are at x.x5.
 */
export function cellIndices(coord: number, originCentre: number, n: number, res: number): number[] {
  const pos = (coord - (originCentre - res / 2)) / res;
  const near = Math.round(pos);
  if (Math.abs(pos - near) < 1e-6) return [near - 1, near].filter((i) => i >= 0 && i < n);
  return [Math.floor(pos)];
}

/** Linear-interpolated percentile, p in 0..1 (pipeline/aggregate.py percentile(), same rule as power.ts). */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export const mean = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);

export const roundTo = (v: number | null, digits: number) => (v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/** "YYYY-MM to YYYY-MM" from "YYYY-MM" keys, or "none". */
export function periodOf(keys: string[]): string {
  if (!keys.length) return "none";
  const s = [...keys].sort();
  return `${s[0]} to ${s[s.length - 1]}`;
}

/** Synthetic Cache API key for one dataset and rounded cell. */
export const cacheKey = (dataset: string, lat: number, lon: number) =>
  new Request(`https://cache.agrosprout/nasa/${dataset}/${lat.toFixed(1)}/${lon.toFixed(1)}`);

export const cacheResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` } });

export type Source = { name: string; doi: string | null; url: string; citation: string };

/** p20, p50 and p80 across years for one calendar month (MonthPct in mobile/src/data/satellite.ts). */
export type MonthPct = { month: number; p20: number | null; p50: number | null; p80: number | null; n_years: number };

/** {"YYYY-MM": value} -> 12 MonthPct rows (pipeline/fetch_fldas.py climatology()). */
export function monthPct(series: Map<string, number>, digits: number): MonthPct[] {
  const out: MonthPct[] = [];
  for (let m = 1; m <= 12; m++) {
    const vals = [...series].filter(([k]) => Number(k.slice(5)) === m).map(([, v]) => v);
    out.push({ month: m, p20: roundTo(percentile(vals, 0.2), digits), p50: roundTo(percentile(vals, 0.5), digits), p80: roundTo(percentile(vals, 0.8), digits), n_years: vals.length });
  }
  return out;
}
