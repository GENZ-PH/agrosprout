import { cors } from "hono/cors";

const ALLOWED = [
  /^https:\/\/agrosprout\.inovsea\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?agrosprout\.pages\.dev$/,
  /^http:\/\/localhost:\d+$/,
];

/** Only the web app (production + Pages previews) and local dev may call the API from a browser. */
export const corsMiddleware = cors({
  origin: (origin) => (origin && ALLOWED.some((r) => r.test(origin)) ? origin : null),
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["content-type"],
  maxAge: 600,
});
