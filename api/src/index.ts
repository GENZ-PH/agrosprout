import { Hono } from "hono";
import { fail } from "./lib/response";
import { corsMiddleware } from "./middleware/cors";
import { rateLimit } from "./middleware/rate-limit";
import { explain, explainMonth } from "./routes/explain";
import { health } from "./routes/health";

// Every route lives under /v1. Add a route area: create src/routes/<area>.ts
// (see _template.ts) and chain `.route("/<area>", area)` below so its types reach the app.
const v1 = new Hono<{ Bindings: Env }>().use("*", rateLimit).route("/health", health).route("/explain", explain).route("/explain-month", explainMonth);

const app = new Hono<{ Bindings: Env }>()
  .use("*", corsMiddleware)
  .route("/v1", v1);

app.notFound((c) => fail(c, 404, "not_found", "Route not found"));
app.onError((err, c) => {
  console.error(err);
  return fail(c, 500, "internal_error", "Something went wrong");
});

/** Imported (type only) by the app's API client for end-to-end types. */
export type AppType = typeof app;
export default app;
