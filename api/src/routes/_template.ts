// Copy this file to start a new route area, then mount it in src/index.ts:
//   .route("/things", things)
// Not mounted: it is only an example of the pattern.
import { Hono } from "hono";
import { z } from "zod";
import { ok } from "../lib/response";
import { validate } from "../lib/validate";

export const template = new Hono<{ Bindings: Env }>().get(
  "/",
  validate("query", z.object({ id: z.string().min(1) })),
  async (c) => {
    const { id } = c.req.valid("query");
    return ok(c, { id });
  },
);
