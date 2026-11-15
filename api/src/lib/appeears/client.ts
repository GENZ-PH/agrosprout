// NASA AppEEARS API client for the Worker: login (Basic with Earthdata user + password), token cache,
// task submit/status/list, bundle download. Pure fetch. Never logs credentials, tokens or coordinates.
import { API } from "./build";

/** Hard cap per incoming request (Workers subrequest budget, team rule: <= 45). */
export const MAX_FETCHES = 45;
const TOKEN_KEY = "https://cache.agrosprout/appeears/v1/token";
/** AppEEARS tokens last about 48 h (pipeline/fetch_appeears.py, AppEEARS API docs); keep ours for 12 h. */
const TOKEN_TTL_S = 12 * 60 * 60;
const LOGIN_BLOCK_KEY = "https://cache.agrosprout/appeears/v2/login-failed";
/**
 * After a rejected login, do not try again for 15 min: Earthdata Login locks the account for 10 min
 * after too many failed attempts (its own error text, seen 2026-11-15), and app users poll every 30 s.
 */
const LOGIN_BLOCK_S = 15 * 60;

// Per-isolate memo, because the Cache API does not persist on *.workers.dev.
let memoToken: { token: string; until: number } | null = null;
let memoBlockedUntil = 0;

export class AppeearsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Counts outbound fetches for one incoming request and refuses past MAX_FETCHES. */
export class Budget {
  used = 0;
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    if (this.used >= MAX_FETCHES) throw new AppeearsError("outbound fetch budget exhausted", 0);
    this.used++;
    return fetch(url, init);
  }
}

export type Creds = { user: string; pass: string };

export class Appeears {
  private token: string | null = null;
  constructor(
    private readonly creds: Creds,
    readonly budget: Budget,
  ) {}

  private async login(force: boolean): Promise<string> {
    const cache = caches.default;
    if (!force) {
      if (memoToken && memoToken.until > Date.now()) return (this.token = memoToken.token);
      const hit = await cache.match(TOKEN_KEY);
      if (hit) {
        const t = ((await hit.json()) as { token?: string }).token;
        if (t) return (this.token = t);
      }
    }
    if (memoBlockedUntil > Date.now() || (await cache.match(LOGIN_BLOCK_KEY))) {
      throw new AppeearsError("AppEEARS login paused after a rejected login", 503);
    }
    const basic = btoa(`${this.creds.user}:${this.creds.pass}`);
    const res = await this.budget.fetch(`${API}/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Length": "0" },
    });
    if (!res.ok) {
      await res.body?.cancel();
      if (res.status === 401 || res.status === 403) {
        memoBlockedUntil = Date.now() + LOGIN_BLOCK_S * 1000;
        await cache.put(LOGIN_BLOCK_KEY, new Response("1", { headers: { "cache-control": `max-age=${LOGIN_BLOCK_S}` } }));
      }
      // 401: the Earthdata user/password is wrong or expired. The message holds no credential.
      throw new AppeearsError(`AppEEARS login failed (HTTP ${res.status})`, res.status === 401 || res.status === 403 ? 503 : 502);
    }
    const token = ((await res.json()) as { token?: string }).token;
    if (!token) throw new AppeearsError("AppEEARS login returned no token", 502);
    await cache.put(
      TOKEN_KEY,
      new Response(JSON.stringify({ token }), { headers: { "content-type": "application/json", "cache-control": `max-age=${TOKEN_TTL_S}` } }),
    );
    memoToken = { token, until: Date.now() + TOKEN_TTL_S * 1000 };
    return (this.token = token);
  }

  /** Authenticated call to the AppEEARS API; re-logs in once if a cached token was rejected. */
  async call(path: string, init: RequestInit = {}): Promise<Response> {
    let force = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = this.token && !force ? this.token : await this.login(force);
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      const res = await this.budget.fetch(`${API}${path}`, { ...init, headers });
      if (res.status !== 401 || attempt === 1) return res;
      await res.body?.cancel();
      await caches.default.delete(TOKEN_KEY);
      memoToken = null;
      this.token = null;
      force = true;
    }
    throw new AppeearsError("unreachable", 500);
  }

  async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.call(path, init);
    if (!res.ok) {
      await res.body?.cancel();
      throw new AppeearsError(`AppEEARS ${init?.method ?? "GET"} ${path.split("/")[1]} failed (HTTP ${res.status})`, res.status === 404 ? 404 : 502);
    }
    return (await res.json()) as T;
  }

  /**
   * One bundle file as text. The API answers with a redirect to a signed S3 URL; follow it by hand
   * so the bearer token is only ever sent to appeears.earthdatacloud.nasa.gov.
   */
  async bundleFile(taskId: string, fileId: string): Promise<string> {
    const res = await this.call(`/bundle/${taskId}/${encodeURIComponent(fileId)}`, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new AppeearsError("AppEEARS bundle redirect without a location", 502);
      const s3 = await this.budget.fetch(new URL(loc, API).toString());
      if (!s3.ok) {
        await s3.body?.cancel();
        throw new AppeearsError(`bundle download failed (HTTP ${s3.status})`, 502);
      }
      return s3.text();
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new AppeearsError(`bundle download failed (HTTP ${res.status})`, 502);
    }
    return res.text();
  }
}
