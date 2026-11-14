import { hc } from "hono/client";
import type { AppType } from "../../../api/types/index";
import { API_URL } from "../env";

export { API_URL };
const TIMEOUT_MS = 15_000;

export type ApiErrorBody = { code: string; message: string; details?: unknown };

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(input, { ...init, signal: init?.signal ?? controller.signal }).finally(() => clearTimeout(timer));
};

/** Typed client: routes, params and responses come from the Worker's AppType. */
export const api = hc<AppType>(API_URL, { fetch: fetchWithTimeout });

type JsonResponse = { status: number; json(): Promise<unknown> };
type Body<R extends JsonResponse> = Awaited<ReturnType<R["json"]>>;
export type ApiData<R extends JsonResponse> = Body<R> extends infer B ? (B extends { ok: true; data: infer D } ? D : never) : never;

/** Turns `{ ok, data }` into data, and `{ ok: false, error }` (or a network failure) into an ApiError. */
export async function unwrap<R extends JsonResponse>(request: Promise<R>): Promise<ApiData<R>> {
  let res: R;
  try {
    res = await request;
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ApiError(aborted ? "timeout" : "network_error", aborted ? "Request timed out" : "Network error", 0);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("bad_response", "Response was not JSON", res.status);
  }
  const b = body as { ok?: boolean; data?: unknown; error?: ApiErrorBody };
  if (b?.ok === true) return b.data as ApiData<R>;
  const err = b?.error ?? { code: "unknown_error", message: `HTTP ${res.status}` };
  throw new ApiError(err.code, err.message, res.status, err.details);
}
