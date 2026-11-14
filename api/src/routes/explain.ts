// "Explain this plan with SI" (team decision 2026-11-15, see docs/decision-log.md D33): turns the
// engine's own output for one plan into a few plain sentences for a farmer, with Claude.
//
// What comes in: only the engine's results for the plan on screen (crop names, scores, the engine's
// "why", trade-off and "check locally" lines, confidence). No location, no lot shape, no farm or
// person names (CLAUDE.md rule 8). Nothing is stored; identical requests are served from the edge
// cache for a day so the sample farm does not call the model again.
//
// No invented numbers (rule 3): the answer is rejected if it holds a number the engine did not send.
import Anthropic from "@anthropic-ai/sdk";
import { Hono } from "hono";
import { z } from "zod";
import { unsupportedNumbers } from "../lib/si-numbers";
import { fail, ok } from "../lib/response";
import { validate } from "../lib/validate";

const MODEL = "claude-opus-5-5";
const CACHE_SECONDS = 24 * 60 * 60;

const line = z.string().trim().min(1).max(400);
const lines = z.array(line).max(8);

export const explainBody = z.object({
  /** "Option D: Balanced" or "Keep your crops". */
  plan: z.string().trim().min(1).max(80),
  /** "Mungbean Apr–Jun, then Eggplant Jul–Dec, ..." */
  crops: z.string().trim().min(1).max(300),
  /** Total score of the plan and of the farmer's own crops, 0 to 100. */
  score: z.number().min(0).max(100).nullable(),
  yourScore: z.number().min(0).max(100).nullable(),
  /** One line per component, e.g. "Water fit: 72 (+15)". */
  scores: lines,
  why: lines,
  tradeoffs: lines,
  unknowns: lines,
  checkLocally: lines,
  confidence: z.enum(["high", "medium", "low"]),
  confidenceReasons: lines,
});
export type ExplainBody = z.infer<typeof explainBody>;

const SYSTEM = `You explain a crop plan to a smallholder farmer in the Philippines, in plain English a farmer with little schooling can follow.
You are given the results of a crop rotation engine for one plot. Explain them; do not add to them.

Rules:
- Use only the facts and numbers in the data. Never add a number, a price, a yield, a date or a fact that is not in the data.
- Do not tell the farmer what to do. Say what the results show, and that they should talk it over with their agricultural technician.
- Mention the main trade-off and what is uncertain, if the data has them.
- Short sentences. No jargon: say "rain" not "precipitation", "dry months" not "water deficit".
- Write 3 to 5 sentences, then one line that starts with "Ask your technician:" and names the most important thing to check locally.
- Plain text only. No headings, lists, bold or emoji.`;

function userText(b: ExplainBody): string {
  const section = (title: string, xs: string[]) => (xs.length ? `${title}:\n${xs.map((x) => `- ${x}`).join("\n")}\n` : "");
  return (
    `Plan: ${b.plan}\nCrops through the year: ${b.crops}\n` +
    `Score of this plan: ${b.score ?? "not available"} out of 100. Score of the farmer's current crops: ${b.yourScore ?? "not available"} out of 100.\n` +
    section("Scores by part (out of 100, change against current crops in brackets)", b.scores) +
    section("Why the engine suggests it", b.why) +
    section("Trade-offs", b.tradeoffs) +
    section("What we don't know", b.unknowns) +
    section("Check locally", b.checkLocally) +
    `Confidence: ${b.confidence}\n` +
    section("Why this confidence", b.confidenceReasons)
  );
}

async function cacheKey(b: ExplainBody): Promise<Request> {
  const bytes = new TextEncoder().encode(MODEL + "\n" + JSON.stringify(b));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
  return new Request(`https://si-explain.cache/${hash}`);
}

export const explain = new Hono<{ Bindings: Env }>().post("/", validate("json", explainBody), async (c) => {
  if (c.env.SI_EXPLAIN !== "on" || !c.env.ANTHROPIC_API_KEY) {
    return fail(c, 503, "si_off", "SI explanations are not switched on yet");
  }
  const body = c.req.valid("json");

  const cache = caches.default;
  const key = await cacheKey(body);
  const hit = await cache.match(key);
  if (hit) return ok(c, { ...((await hit.json()) as { text: string; model: string }), cached: true });

  // Stricter than the API-wide limit: each call costs money and the link stays public.
  const { success } = await c.env.EXPLAIN_LIMITER.limit({ key: c.req.header("cf-connecting-ip") ?? "local" });
  if (!success) return fail(c, 429, "rate_limited", "Too many explanations, try again in a minute");

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 50_000 });
  const source = userText(body);
  let text = "";
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: source }],
    });
    if (res.stop_reason === "refusal") return fail(c, 502, "si_declined", "The SI model declined to explain this plan");
    text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(c, 429, "si_busy", "The SI service is busy, try again in a minute");
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("si-explain: API key rejected");
      return fail(c, 503, "si_off", "SI explanations are not switched on yet");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("si-explain: API error", e.status);
      return fail(c, 502, "si_error", "The SI service did not answer");
    }
    throw e;
  }
  if (!text) return fail(c, 502, "si_error", "The SI service did not answer");

  const extra = unsupportedNumbers(text, source);
  if (extra.length > 0) {
    console.warn("si-explain: rejected an answer with numbers not in the engine output", extra);
    return fail(c, 422, "si_unchecked", "The SI answer used numbers that are not in your results, so it was not shown");
  }

  const data = { text, model: MODEL };
  c.executionCtx.waitUntil(
    cache.put(key, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` } })),
  );
  return ok(c, { ...data, cached: false });
});
