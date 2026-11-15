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
  /** NASA satellite and model checks for the lot (IMERG, SMAP, MODIS, FLDAS); they do not change the scores. */
  satellite: lines.optional(),
});
export type ExplainBody = z.infer<typeof explainBody>;

// v2 (2026-11-15): the card already shows the crops and months, the top gains with their scores and
// the first thing to ask the technician, so the summary adds only what is not on it.
// v3 (2026-11-15): plainer and shorter, no scores in the technician note.
// v4 (2026-11-15): NASA satellite checks beside the results.
const PROMPT_VERSION = "v4";
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
const TECH_SYSTEM = `You help an agricultural technician in the Philippines explain one farmer's crop plan, in plain, everyday English that the technician can read out to the farmer.
The panel already lists every plan, all scores and the NASA data sources. Do not repeat them.

Say only:
- the one main reason this plan is suggested for this plot, in everyday words, and
- the one thing to check on the field before advising the farmer.

Rules:
- Use only the facts in the data. Never add a number, a price, a yield, a date or a fact that is not in the data.
- No scores, no points, no numbers in brackets, no "out of". At most one number in total, and only if it helps.
- Everyday words only: say "adds nitrogen" not "nitrogen-fixing", "same crop family" not "rotation", "rain" not "precipitation", "wet soil" not "waterlogging".
- 2 short sentences, under 45 words in total. Plain text only, no headings, lists, bold or emoji.`;

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
    section("Why this confidence", b.confidenceReasons) +
    section("NASA satellite checks for this plot (they did not change the scores)", b.satellite ?? [])
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
  /** NASA satellite and model lines for the same month (IMERG rain, SMAP soil moisture, MODIS greenness, FLDAS run-off). */
  satellite: lines.optional(),
});
export type ExplainMonthBody = z.infer<typeof explainMonthBody>;

const MONTH_SYSTEM = `You explain one month of a crop plan to a smallholder farmer in the Philippines, in plain, everyday English a farmer with little schooling can follow.
You get what a crop rotation engine says happens on the field that month with the suggested plan and with the farmer's current crops, and that month's climate on the plot from NASA POWER (what the plan is scored on). Sometimes you also get NASA satellite checks for the same month: rain seen by GPM IMERG satellites, soil moisture from SMAP, greenness from MODIS and run-off from the FLDAS land model.

Rules:
- Use only the facts and numbers given. Never add a number, a price, a yield or a fact that is not in the data.
- The screen already lists what happens on the field this month. Do not repeat it. Say WHY in everyday words: is this month wet or dry for the crops, and what can go wrong (a dry year, a very wet year, bare soil washing away).
- At most one number (rain in mm), only if it helps.
- If satellite checks are given, you may use one of them when it helps explain the month (for example the satellites also see a dry month, or see more rain than NASA POWER). Name the source in plain words, e.g. "rain satellites" or "soil moisture satellite".
- 2 short sentences, under 40 words in total.
- Do not tell the farmer what to do. Everyday words only: "rain" not "precipitation", "the sun and wind dry the soil" not "evapotranspiration".
- Plain text only. No headings, lists, bold or emoji.`;

function monthText(b: ExplainMonthBody): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (nothing)");
  return `Month: ${b.month}\nSuggested plan this month:\n${list(b.suggestion)}\nFarmer's current crops this month:\n${list(b.yours)}\nClimate this month (NASA POWER): ${b.climate}\n${b.satellite?.length ? `NASA satellite checks this month (they do not change the plan):\n${list(b.satellite)}\n` : ""}`;
}

export const explainMonth = new Hono<{ Bindings: Env }>().post("/", validate("json", explainMonthBody), async (c) => {
  if (c.env.SI_EXPLAIN !== "on" || !c.env.ANTHROPIC_API_KEY) {
    return fail(c, 503, "si_off", "SI explanations are not switched on yet");
  }
  const body = c.req.valid("json");
  const cache = caches.default;
  const bytes = new TextEncoder().encode(MODEL + "\nmonth-v3\n" + JSON.stringify(body));
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

// Batched (2026-11-15): the plan repeats every year, so a lot has only 12 month notes per plan.
// One call returns all 12, the phone keeps them, and hovering or tapping months costs nothing more.
export const explainYearBody = z.object({ months: z.array(explainMonthBody).min(1).max(12) });
export type ExplainYearBody = z.infer<typeof explainYearBody>;

const YEAR_SYSTEM = MONTH_SYSTEM.replace("You explain one month of a crop plan", "You explain each month of a crop plan, one note per month,") + `
- You get several months. Write one separate note for each, in the same order.
- Answer with only a JSON array of strings, one string per month, nothing before or after it.`;

export const explainYear = new Hono<{ Bindings: Env }>().post("/", validate("json", explainYearBody), async (c) => {
  if (c.env.SI_EXPLAIN !== "on" || !c.env.ANTHROPIC_API_KEY) {
    return fail(c, 503, "si_off", "SI explanations are not switched on yet");
  }
  const body = c.req.valid("json");
  const cache = caches.default;
  const bytes = new TextEncoder().encode(MODEL + "\nyear-v2\n" + JSON.stringify(body));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const key = new Request(`https://si-explain-year.cache/${hash}`);
  const hit = await cache.match(key);
  if (hit) return ok(c, { ...((await hit.json()) as { notes: (string | null)[]; model: string }), cached: true });

  const { success } = await c.env.EXPLAIN_MONTH_LIMITER.limit({ key: c.req.header("cf-connecting-ip") ?? "local" });
  if (!success) return fail(c, 429, "rate_limited", "Too many explanations, try again in a minute");

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 50_000 });
  const sources = body.months.map(monthText);
  let raw = "";
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: YEAR_SYSTEM,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: sources.map((s, i) => `Month ${i + 1} of ${sources.length}\n${s}`).join("\n") }],
    });
    if (res.stop_reason === "refusal") return fail(c, 502, "si_declined", "The SI model declined to explain these months");
    raw = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(c, 429, "si_busy", "The SI service is busy, try again in a minute");
    if (e instanceof Anthropic.AuthenticationError) return fail(c, 503, "si_off", "SI explanations are not switched on yet");
    if (e instanceof Anthropic.APIError) return fail(c, 502, "si_error", "The SI service did not answer");
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  } catch {
    return fail(c, 502, "si_error", "The SI service did not answer");
  }
  if (!Array.isArray(parsed) || parsed.length !== sources.length) return fail(c, 502, "si_error", "The SI service did not answer");
  // Each note is checked against its own month's data; a note with a number not in it is dropped.
  const notes = parsed.map((t, i) => {
    if (typeof t !== "string" || !t.trim()) return null;
    const extra = unsupportedNumbers(t, sources[i]);
    if (extra.length > 0) {
      console.warn("si-explain-year: dropped a note with numbers not in the engine output", extra);
      return null;
    }
    return t.trim();
  });
  const data = { notes, model: MODEL };
  c.executionCtx.waitUntil(
    cache.put(key, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` } })),
  );
  return ok(c, { ...data, cached: false });
});

// The technical data panel (2026-11-15): one plain insight per section (plans, months, fit, soil),
// all in one call. Each insight is checked against its own section's numbers.
export const explainSectionsBody = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        title: z.string().trim().min(1).max(80),
        facts: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
      }),
    )
    .min(1)
    .max(6),
});
export type ExplainSectionsBody = z.infer<typeof explainSectionsBody>;

const SECTIONS_SYSTEM = `You help an agricultural technician in the Philippines read the sections of a crop planning tool for one farmer's plot.
For each section you get its title and the results it shows. Write one insight per section: the one thing in it that matters most for this plot, in plain, everyday English.

Rules:
- Some facts come from NASA satellite checks (GPM IMERG rain, SMAP soil moisture, MODIS greenness, FLDAS run-off). They do not change the scores; say so if you use them against a score.
- Use only the facts given for that section. Never add a number, a price, a yield, a date or a fact that is not there.
- At most one number per insight, only if it helps.
- One short sentence per section, under 30 words. Everyday words: "rain" not "precipitation", "wet soil" not "waterlogging".
- Plain text. Answer with only a JSON array of strings, one per section, in the same order, nothing before or after it.`;

export const explainSections = new Hono<{ Bindings: Env }>().post("/", validate("json", explainSectionsBody), async (c) => {
  if (c.env.SI_EXPLAIN !== "on" || !c.env.ANTHROPIC_API_KEY) {
    return fail(c, 503, "si_off", "SI explanations are not switched on yet");
  }
  const body = c.req.valid("json");
  const cache = caches.default;
  const bytes = new TextEncoder().encode(MODEL + "\nsections-v2\n" + JSON.stringify(body));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const key = new Request(`https://si-explain-sections.cache/${hash}`);
  const hit = await cache.match(key);
  if (hit) return ok(c, { ...((await hit.json()) as { notes: (string | null)[]; model: string }), cached: true });

  const { success } = await c.env.EXPLAIN_LIMITER.limit({ key: c.req.header("cf-connecting-ip") ?? "local" });
  if (!success) return fail(c, 429, "rate_limited", "Too many explanations, try again in a minute");

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 50_000 });
  const sources = body.sections.map((x) => `Section: ${x.title}\n${x.facts.map((f) => `- ${f}`).join("\n")}`);
  let raw = "";
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SECTIONS_SYSTEM,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: sources.join("\n\n") }],
    });
    if (res.stop_reason === "refusal") return fail(c, 502, "si_declined", "The SI model declined to explain these results");
    raw = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(c, 429, "si_busy", "The SI service is busy, try again in a minute");
    if (e instanceof Anthropic.AuthenticationError) return fail(c, 503, "si_off", "SI explanations are not switched on yet");
    if (e instanceof Anthropic.APIError) return fail(c, 502, "si_error", "The SI service did not answer");
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  } catch {
    return fail(c, 502, "si_error", "The SI service did not answer");
  }
  if (!Array.isArray(parsed) || parsed.length !== sources.length) return fail(c, 502, "si_error", "The SI service did not answer");
  const notes = parsed.map((t, i) => {
    if (typeof t !== "string" || !t.trim()) return null;
    const extra = unsupportedNumbers(t, sources[i]);
    if (extra.length > 0) {
      console.warn("si-explain-sections: dropped a note with numbers not in the engine output", extra);
      return null;
    }
    return t.trim();
  });
  const data = { notes, model: MODEL };
  c.executionCtx.waitUntil(
    cache.put(key, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` } })),
  );
  return ok(c, { ...data, cached: false });
});
