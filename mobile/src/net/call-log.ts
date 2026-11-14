// A record of every outbound data request made since the app opened, for the "NASA data on
// this page" panel: which endpoint, what for, with which parameters, and how it went. Filled by
// fetchWithTimeout, so nothing can call a data endpoint without showing up here. Kept in memory
// only (never stored or sent anywhere). No React Native imports in the core.

import type { SourceKey } from "../content/sources";

export type CallStatus = "pending" | "ok" | "error";

export interface CallRecord {
  id: number;
  /** When it started, ms since epoch. */
  at: number;
  source: SourceKey;
  /** Host and path, without the query. */
  endpoint: string;
  /** What the app asked for, in words. */
  purpose: string;
  /** The query parameters that matter (place, variables, years). */
  params: [string, string][];
  status: CallStatus;
  http?: number;
  ms?: number;
  /** Error message when status is "error". */
  error?: string;
}

type Rule = { test: (u: URL) => boolean; source: SourceKey; purpose: string; keep: string[] };

const RULES: Rule[] = [
  {
    test: (u) => u.hostname === "power.larc.nasa.gov" && u.pathname.includes("/temporal/monthly/"),
    source: "power",
    purpose: "Monthly climate for the lot: rain, temperature, humidity, wind, sunshine and soil wetness.",
    keep: ["parameters", "latitude", "longitude", "start", "end", "community"],
  },
  {
    test: (u) => u.hostname === "power.larc.nasa.gov" && u.pathname.includes("/temporal/daily/"),
    source: "power-daily",
    purpose: "Daily NASA POWER values (not requested by the phone on this branch; the sample farm's daily data is bundled).",
    keep: ["parameters", "latitude", "longitude", "start", "end", "community"],
  },
  {
    test: (u) => u.hostname === "routing.openstreetmap.de",
    source: "osm",
    purpose: "Road distance from the lot to a harvest place.",
    keep: [],
  },
];

/** Which source a URL belongs to, or null for requests the panel does not track. */
export function classify(url: string, base = "http://localhost"): Omit<CallRecord, "id" | "at" | "status"> | null {
  let u: URL;
  try {
    u = new URL(url, base);
  } catch {
    return null;
  }
  const rule = RULES.find((r) => r.test(u));
  if (!rule) return null;
  const params = rule.keep.flatMap((k): [string, string][] => {
    const v = u.searchParams.get(k);
    return v === null ? [] : [[k, v]];
  });
  return { source: rule.source, endpoint: `${u.host}${u.pathname}`, purpose: rule.purpose, params };
}

let calls: CallRecord[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const MAX = 50;

/** Start a record for `url` if it is a tracked endpoint. Returns a function to finish it. */
export function startCall(url: string): ((r: { http?: number; error?: string; cancelled?: boolean }) => void) | null {
  const base = typeof location !== "undefined" && location?.href ? location.href : "http://localhost";
  const c = classify(url, base);
  if (!c) return null;
  const rec: CallRecord = { ...c, id: nextId++, at: Date.now(), status: "pending" };
  calls = [rec, ...calls].slice(0, MAX);
  emit();
  return ({ http, error, cancelled }) => {
    // A request the app cancelled itself (a screen closed, a refetch) is not a failure: drop it.
    if (cancelled) {
      calls = calls.filter((x) => x.id !== rec.id);
      emit();
      return;
    }
    const ok = error === undefined && http !== undefined && http >= 200 && http < 300;
    calls = calls.map((x) => (x.id === rec.id ? { ...x, http, error: error ?? (ok ? undefined : `HTTP ${http}`), status: ok ? "ok" : "error", ms: Date.now() - rec.at } : x));
    emit();
  };
}

export function getCalls(): readonly CallRecord[] {
  return calls;
}

export function subscribeCalls(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** For tests. */
export function resetCalls(): void {
  calls = [];
  nextId = 1;
  emit();
}
