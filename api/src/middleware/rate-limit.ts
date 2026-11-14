import { createMiddleware } from "hono/factory";
import { fail } from "../lib/response";

/** Per-IP limit from the RATE_LIMITER binding (see wrangler.jsonc). */
export const rateLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const key = c.req.header("cf-connecting-ip") ?? "local";
  const { success } = await c.env.RATE_LIMITER.limit({ key });
  if (!success) return fail(c, 429, "rate_limited", "Too many requests, try again in a minute");
  await next();
});
