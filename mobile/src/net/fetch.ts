// fetch with a timeout that also honors the caller's abort signal (e.g. TanStack Query
// cancelling a query). Shared by the API client and any direct call such as NASA POWER.
// Uses only AbortController and addEventListener, so it does not depend on AbortSignal.any.

import { startCall } from "./call-log";

export const DEFAULT_TIMEOUT_MS = 15_000;

export class TimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const outer = init?.signal ?? undefined;
  const forwardAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", forwardAbort);
  }

  // Data requests are recorded for the "NASA data on this page" panel (call-log.ts).
  // The log must never break a request, so any error in it is swallowed.
  let done: ReturnType<typeof startCall> = null;
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    done = startCall(url);
  } catch {
    done = null;
  }
  const finish = (r: Parameters<NonNullable<typeof done>>[0]) => {
    try {
      done?.(r);
    } catch {
      // ignore
    }
  };

  return fetch(input, { ...init, signal: controller.signal })
    .then((res) => {
      finish({ http: res.status });
      return res;
    })
    .catch((e: unknown) => {
      const err = timedOut ? new TimeoutError(timeoutMs) : e;
      if (!timedOut && outer?.aborted) finish({ cancelled: true });
      else finish({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    })
    .finally(() => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forwardAbort);
    });
}
