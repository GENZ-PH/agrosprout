import { Hono } from "hono";
import { fail, ok } from "../lib/response";

export const health = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  let d1 = false;
  let r2 = false;
  try {
    d1 = (await c.env.DB.prepare("select 1 as ok").first<{ ok: number }>())?.ok === 1;
  } catch {}
  try {
    await c.env.ASSETS.list({ limit: 1 });
    r2 = true;
  } catch {}
  if (!d1 || !r2) return fail(c, 503, "unhealthy", `d1=${d1} r2=${r2}`);
  return ok(c, { status: "ok" as const, env: c.env.ENVIRONMENT, d1, r2 });
});
