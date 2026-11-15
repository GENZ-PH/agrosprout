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
  /** "farmer" (default): the plain summary on the card. "technician": what in the data matters most, for the NASA data panel. */
  audience: z.enum(["farmer", "technician"]).optional(),
});
export type ExplainBody = z.infer<typeof explainBody>;

// v2 (2026-11-15): the card already shows the crops and months, the top gains with their scores and
// the first thing to ask the technician, so the summary adds only what is not on it.
const PROMPT_VERSION = "v2";
const SYSTEM = `You explain a crop plan to a smallholder farmer in the Philippines, in plain English a farmer with little schooling can follow.
You are given the results of a crop rotation engine for one plot. Explain them; do not add to them.

The farmer's screen ALREADY shows, right above your text: the crops and their months, the total scores, the biggest gains with their scores, and the first "check locally" question. Do not repeat any of that. No scores, no list of crops and months.

Write only what is vital and not on the screen yet:
- the main risk or trade-off of this plan for this farmer (for example a crop that is new to them, spoils fast, or does badly in wet soil), and
- what the results are unsure about and why, in one plain sentence, if the data says so.

Rules:
- Use only the facts in the data. Never add a number, a price, a yield, a date or a fact that is not in the data.
- Do not tell the farmer what to do; say what the results show.
- 2 or 3 short sentences, plain text only. No headings, lists, bold or emoji. No jargon: say "rain" not "precipitation".`;

// For the NASA data panel (2026-11-15): the technician sees every plan, score and NASA source, so
// SI points out which of it matters most for this lot's decision and what to verify on the ground.
const TECH_SYSTEM = `You help an agricultural technician in the Philippines read the results of a crop rotation engine for one farmer's plot.
The technician's panel already lists every plan, all scores and the NASA data sources. Do not repeat those lists.

Write only what makes the panel easier to act on:
- which one or two results drive the suggestion most, and why that matters for this plot;
- which result is the weakest or most uncertain, and what to verify on the ground before advising the farmer.

Rules:
- Use only the facts and numbers in the data. Never add a number, a price, a yield, a date or a fact that is not in the data.
- 3 short sentences at most. Plain text only, no headings, lists, bold or emoji.`;

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
  const bytes = new TextEncoder().encode(MODEL + "\n" + PROMPT_VERSION + "\n" + JSON.stringify(b));
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
      system: body.audience === "technician" ? TECH_SYSTEM : SYSTEM,
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

// ---------------------------------------------------------------------------
// One month of the year strip (2026-11-15): hover or tap a month on "Our suggestion" and SI says,
// in two or three sentences, what happens on the field that month with the suggested plan next to
// the farmer's own crops, and why, from the lot's own NASA numbers for that month. Same rules as
// above: engine output only, no location, the number check, a day in the edge cache.

export const explainMonthBody = z.object({
  /** "November" */
  month: z.string().trim().min(3).max(12),
  /** The engine's lines for the month, e.g. "Plant Mungbean.", "Short of water: ..." */
  suggestion: lines,
  yours: lines,
  /** "Rain in a typical year: 244 mm (dry year 164, wet year 305). Water the air takes: 102 mm." */
  climate: z.string().trim().min(1).max(300),
});
export type ExplainMonthBody = z.infer<typeof explainMonthBody>;

const MONTH_SYSTEM = `You explain one month of a crop plan to a smallholder farmer in the Philippines, in plain English a farmer with little schooling can follow.
You get what a crop rotation engine says happens on the field that month with the suggested plan and with the farmer's current crops, and that month's climate on the plot from NASA data.

Rules:
- Use only the facts and numbers given. Never add a number, a price, a yield or a fact that is not in the data.
- The screen already lists what happens on the field this month. Do not repeat it. Say WHY, from this month's rain and the water the air takes from the soil: why the suggestion does better or worse than the farmer's crops this month, and what risk this month carries (a dry year, a wet year, bare soil in heavy rain).
- 2 short sentences at most.
- Do not tell the farmer what to do. No jargon: say "rain" not "precipitation".
- Plain text only. No headings, lists, bold or emoji.`;

function monthText(b: ExplainMonthBody): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (nothing)");
  return `Month: ${b.month}\nSuggested plan this month:\n${list(b.suggestion)}\nFarmer's current crops this month:\n${list(b.yours)}\nClimate this month: ${b.climate}\n`;
}

export const explainMonth = new Hono<{ Bindings: Env }>().post("/", validate("json", explainMonthBody), async (c) => {
  if (c.env.SI_EXPLAIN !== "on" || !c.env.ANTHROPIC_API_KEY) {
    return fail(c, 503, "si_off", "SI explanations are not switched on yet");
  }
  const body = c.req.valid("json");
  const cache = caches.default;
  const bytes = new TextEncoder().encode(MODEL + "\nmonth\n" + JSON.stringify(body));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const key = new Request(`https://si-explain-month.cache/${hash}`);
  const hit = await cache.match(key);
  if (hit) return ok(c, { ...((await hit.json()) as { text: string; model: string }), cached: true });

  const { success } = await c.env.EXPLAIN_MONTH_LIMITER.limit({ key: c.req.header("cf-connecting-ip") ?? "local" });
  if (!success) return fail(c, 429, "rate_limited", "Too many explanations, try again in a minute");

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 50_000 });
  const source = monthText(body);
  let text = "";
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: MONTH_SYSTEM,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: source }],
    });
    if (res.stop_reason === "refusal") return fail(c, 502, "si_declined", "The SI model declined to explain this month");
    text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(c, 429, "si_busy", "The SI service is busy, try again in a minute");
    if (e instanceof Anthropic.AuthenticationError) return fail(c, 503, "si_off", "SI explanations are not switched on yet");
    if (e instanceof Anthropic.APIError) return fail(c, 502, "si_error", "The SI service did not answer");
    throw e;
  }
  if (!text) return fail(c, 502, "si_error", "The SI service did not answer");
  const extra = unsupportedNumbers(text, source);
  if (extra.length > 0) {
    console.warn("si-explain-month: rejected an answer with numbers not in the engine output", extra);
    return fail(c, 422, "si_unchecked", "The SI answer used numbers that are not in your results, so it was not shown");
  }
  const data = { text, model: MODEL };
  c.executionCtx.waitUntil(
    cache.put(key, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` } })),
  );
  return ok(c, { ...data, cached: false });
});
