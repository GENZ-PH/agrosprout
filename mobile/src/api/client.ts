import { hc } from "hono/client";
import type { AppType } from "../../../api/types/index";
import { API_URL } from "../env";
import { fetchWithTimeout, TimeoutError } from "../net/fetch";

export { API_URL };

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

/** Typed client: routes, params and responses come from the Worker's AppType. 15 s timeout per request. */
export const api = hc<AppType>(API_URL, { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetchWithTimeout(input, init) });

type JsonResponse = { status: number; json(): Promise<unknown> };
type Body<R extends JsonResponse> = Awaited<ReturnType<R["json"]>>;
export type ApiData<R extends JsonResponse> = Body<R> extends infer B ? (B extends { ok: true; data: infer D } ? D : never) : never;

/** Turns `{ ok, data }` into data, and `{ ok: false, error }` (or a network failure) into an ApiError. */
export async function unwrap<R extends JsonResponse>(request: Promise<R>): Promise<ApiData<R>> {
  let res: R;
  try {
    res = await request;
  } catch (e) {
    if (e instanceof TimeoutError) throw new ApiError("timeout", e.message, 0);
    if (e instanceof Error && e.name === "AbortError") throw new ApiError("aborted", "Request was cancelled", 0);
    throw new ApiError("network_error", "Network error", 0);
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
