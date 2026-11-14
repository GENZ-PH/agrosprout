import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Every route answers with this shape, so the app can handle all responses the same way. */
export type ApiErrorBody = { code: string; message: string; details?: unknown };
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiErrorBody };

export const ok = <T>(c: Context, data: T, status: ContentfulStatusCode = 200) =>
  c.json({ ok: true as const, data }, status);

export const fail = (c: Context, status: ContentfulStatusCode, code: string, message: string, details?: unknown) =>
  c.json({ ok: false as const, error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
