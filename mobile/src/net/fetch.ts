// fetch with a timeout that also honors the caller's abort signal (e.g. TanStack Query
// cancelling a query). Shared by the API client and any direct call such as NASA POWER.
// Uses only AbortController and addEventListener, so it does not depend on AbortSignal.any.

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

  return fetch(input, { ...init, signal: controller.signal })
    .catch((e: unknown) => {
      throw timedOut ? new TimeoutError(timeoutMs) : e;
    })
    .finally(() => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forwardAbort);
    });
}
