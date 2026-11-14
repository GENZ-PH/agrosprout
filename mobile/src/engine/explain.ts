// Template-driven explanations and confidence for every rotation option
// (docs/07-rotation-engine.md §5, #28). Pure TypeScript (no React Native imports).
//
// Every sentence is built from the engine's own output (`rotations`,
// `marketAccess`), the lot's data and provenance, and the crop library. No
// number is typed into a template: each one is a score, a metric, a month, a
// travel time or a source period from the input. "Check locally" lines are
// questions for the farmer and the technician; they never claim a local fact.
//
//   why            what changes against A (your crops), then the top
//                  WHY_TOP_COMPONENTS components where the option beats A,
//                  each with the data point behind it
//   evidence       data sources (lot provenance) and crop references (crops.json `sources`)
//   benefits       components that improve against A, with deltas, plus bare and water-short months
//   tradeoffs      components that get worse against A, so the card is not one-sided
//   unknowns       data gaps that apply: lot caveats, "I don't know" answers,
//                  assumed months, left-out scores, missing crop data, travel
//   check_locally  crop-specific questions, ending with the technician line (CLAUDE.md rule 6)
//   confidence     high / medium / low with the reasons (docs/07 §5)
import type { Crop, CropLibrary, Destination, DestinationType, Level, Lot, LotData, Provenance } from "../types";
import type { MarketAccessResult } from "./access";
import {
  CONFIDENCE_LOW_WEAK_INPUTS,
  EXPLAIN_MIN_DELTA_POINTS,
  IRRIGATION_DEFICIT_SHARE,
  PONDED_CROP_IDS,
  WHY_TOP_COMPONENTS,
} from "./params";
import type { OptionKey, OptionKind, RotationOption, RotationsResult } from "./rotations";
import { COMPONENT_KEYS, totalScore, type ComponentKey, type ComponentWeights, type RotationSlot } from "./scores";

export type ConfidenceLevel = "high" | "medium" | "low";

/** Inputs that count toward Low confidence when they are "I don't know" or assumed. */
export type WeakInput = "land-type" | "water-source" | "soil" | "planting-months" | "travel-time";

/** Farmer-facing component labels (docs/07 §4 table). */
export const COMPONENT_LABELS: Readonly<Record<ComponentKey, string>> = {
  W: "Fits your rain",
  H: "Weather safety",
  S: "Builds soil",
  E: "Protects from washout",
  B: "Breaks pest cycles",
  I: "Income potential",
  M: "Easy to get to market",
  L: "Easy to manage",
};

/** Last "Check locally" line on every option: the app supports, and doesn't replace, people (CLAUDE.md rule 6). */
export const TECHNICIAN_LINE =
  "Talk it over with your agricultural technician before you change crops. This app supports your decision; it doesn't replace your judgment.";

export interface EvidenceItem {
  /** What the source backs, e.g. "Rainfall". */
  topic: string;
  /** Source name, e.g. "NASA POWER PRECTOTCORR" or "Allen et al. 1998, FAO-56 Table 12". */
  source: string;
  /** Period the data covers, e.g. "2001-2024"; `null` for references. */
  period: string | null;
  /** Full citation (crop references) or the provenance note; `null` when there is none. */
  citation: string | null;
  url: string | null;
  /** Crops this reference covers (crop references only). */
  crop_ids: string[];
  /** Ready-to-show line. */
  text: string;
}

/**
 * One benefit or trade-off line. For B, C and D: `from` is your crops (A),
 * `to` is this option, both rounded, and `delta` = to - from. For A's own
 * benefits `from` and `delta` are `null` and `to` is A's score.
 */
export interface ScoreChange {
  /** Component, or `null` for a month count (bare months, water-short months) or a plain line. */
  component: ComponentKey | null;
  label: string;
  from: number | null;
  to: number | null;
  delta: number | null;
  text: string;
}

export interface Confidence {
  level: ConfidenceLevel;
  reasons: string[];
  /**
   * True when the option's place against A (or, for A, against any option)
   * differs between a dry (P20) and a wet (P80) year. `null` = could not be
   * checked (water fit missing).
   */
  ranking_flips: boolean | null;
  weak_inputs: WeakInput[];
}

export interface OptionExplanation {
  key: OptionKey;
  kind: OptionKind;
  why: string[];
  evidence: EvidenceItem[];
  benefits: ScoreChange[];
  tradeoffs: ScoreChange[];
  unknowns: string[];
  check_locally: string[];
  confidence: Confidence;
}

export interface ExplainInput {
  /** `rotations()` for this lot. */
  result: RotationsResult;
  lot: Pick<Lot, "crops" | "details">;
  data: Pick<LotData, "period" | "provenance" | "caveats">;
  library: Pick<CropLibrary, "crops">;
  /** `marketAccess()` for this lot; omit or `null` while the farm has no destination. */
  access?: MarketAccessResult | null;
  /** The farm's destinations, so travel questions can use their names. */
  destinations?: readonly Destination[];
}

export interface ExplainResult {
  /** One per option, in the order of `result.options` (A first). */
  options: OptionExplanation[];
}

// ---------------------------------------------------------------------------
// Formatting helpers (exported for tests and for UI reuse)
// ---------------------------------------------------------------------------

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nextMonth = (m: number) => (m === 12 ? 1 : m + 1);
const prevMonth = (m: number) => (m === 1 ? 12 : m - 1);

/** Calendar months as short ranges: [2, 3, 4] → "Feb–Apr", [12, 1] → "Dec–Jan", [1, 3] → "Jan and Mar", [] → "none". */
export function formatMonths(months: readonly number[]): string {
  const set = new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12));
  if (set.size === 0) return "none";
  if (set.size === 12) return "all year";
  const runs: string[] = [];
  for (let m = 1; m <= 12; m++) {
    if (!set.has(m) || set.has(prevMonth(m))) continue;
    let end = m;
    while (set.has(nextMonth(end))) end = nextMonth(end);
    runs.push(end === m ? MONTH_NAMES[m - 1] : `${MONTH_NAMES[m - 1]}–${MONTH_NAMES[end - 1]}`);
  }
  return listJoin(runs);
}

/** One-way minutes as "45 min", "1 h", "1 h 10 min". */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "a", "a and b", "a, b and c". */
export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const cap = (s: string) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);
const pct = (share: number) => `${Math.round(100 * share)}%`;
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const isAre = (n: number) => (n === 1 ? "is" : "are");
const unique = <T>(xs: readonly T[]) => [...new Set(xs)];
const sortedNums = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b);

/** Short form of a crops.json citation: the text before the first " (", ":" or ";". */
export function shortCitation(citation: string): string {
  const cut = [" (", ":", ";"].map((s) => citation.indexOf(s)).filter((i) => i > 0);
  return (cut.length > 0 ? citation.slice(0, Math.min(...cut)) : citation).trim();
}

/** How long a crop keeps, from its perishability class (types.ts and docs/07 §3c). */
const KEEPS: Readonly<Record<Level, string>> = {
  high: "spoils within days",
  medium: "keeps for 1–3 weeks",
  low: "keeps for months",
};

const DESTINATION_WORD: Readonly<Record<DestinationType, string>> = {
  market: "the market",
  storage: "storage",
  buyer: "your buyer",
  coop: "the co-op",
};

const WEAK_LABEL: Readonly<Record<WeakInput, string>> = {
  "land-type": "land type",
  "water-source": "water source",
  soil: "soil type",
  "planting-months": "planting months",
  "travel-time": "travel time (rough estimate)",
};

/** Components an option kind is built around, put first in "Why this?". */
const KIND_FOCUS: Readonly<Record<OptionKind, readonly ComponentKey[]>> = {
  yours: [],
  water: ["W", "H"],
  soil: ["S", "E", "B"],
  balanced: [],
};

// ---------------------------------------------------------------------------
// Context shared by every option
// ---------------------------------------------------------------------------

interface Ctx {
  input: ExplainInput;
  a: RotationOption;
  byId: Map<string, Crop>;
  weights: ComponentWeights;
  access: MarketAccessResult | null;
  /** Period of the rain data, e.g. "2001-2024". */
  period: string;
}

function provenance(ctx: Ctx, field: string): Provenance | null {
  return ctx.input.data.provenance.find((p) => p.field === field) ?? null;
}

/** Dataset name for a sentence: "NASA POWER" for POWER variables, else the full source. */
function datasetName(ctx: Ctx, field: string): string | null {
  const p = provenance(ctx, field);
  if (!p) return null;
  return p.source.startsWith("NASA POWER") ? "NASA POWER" : p.source;
}

/** "(NASA POWER rainfall, 2001-2024)", or "" when the provenance is missing. */
function cite(ctx: Ctx, field: string, what: string): string {
  const name = datasetName(ctx, field);
  return name ? ` (${name} ${what}, ${provenance(ctx, field)?.period ?? ctx.period})` : "";
}

/** Crop name for a sentence: crops.json `name` before " (", lower-cased unless it starts with an acronym. */
function cropName(ctx: Ctx, id: string): string {
  const crop = ctx.byId.get(id);
  const n = crop ? crop.name.split(" (")[0].trim() : id;
  return n.length > 1 && n[1] === n[1].toLowerCase() ? n[0].toLowerCase() + n.slice(1) : n;
}

const cropIds = (o: RotationOption) => unique(o.slots.map((s) => s.crop_id));
const ponded = (o: RotationOption) => o.slots.some((s) => PONDED_CROP_IDS.includes(s.crop_id));
const round = (x: number | null) => (x === null ? null : Math.round(x));

/** Months a slot is in the field, planting to harvest month (inclusive, wrapping the year). */
function slotMonths(s: RotationSlot): number[] {
  const out: number[] = [];
  let m = s.plant_month;
  for (let i = 0; i < 12; i++) {
    out.push(m);
    if (m === s.harvest_month) break;
    m = nextMonth(m);
  }
  return out;
}

function cropMonths(o: RotationOption, id: string): number[] {
  return sortedNums(o.slots.filter((s) => s.crop_id === id).flatMap(slotMonths));
}

function destinationName(ctx: Ctx, id: string | null, type: DestinationType | null): string {
  const d = id ? ctx.input.destinations?.find((x) => x.id === id) : undefined;
  if (d && d.name.trim().length > 0) return d.name.trim();
  return type ? DESTINATION_WORD[type] : "your destination";
}

/** Rounded score difference, option minus A; `null` when either is missing. */
function delta(ctx: Ctx, o: RotationOption, k: ComponentKey): number | null {
  const x = round(o.scores[k]);
  const a = round(ctx.a.scores[k]);
  return x === null || a === null ? null : x - a;
}

// ---------------------------------------------------------------------------
// Why this?
// ---------------------------------------------------------------------------

/** What changes against A: added, dropped, fewer or more crops a year, moved months. */
function changeSentence(ctx: Ctx, o: RotationOption): string {
  const plantMonths = (r: RotationOption) => {
    const m = new Map<string, number[]>();
    for (const s of r.slots) m.set(s.crop_id, [...(m.get(s.crop_id) ?? []), s.plant_month].sort((x, y) => x - y));
    return m;
  };
  const am = plantMonths(ctx.a);
  const xm = plantMonths(o);
  const added = [...xm.keys()].filter((id) => !am.has(id));
  const dropped = [...am.keys()].filter((id) => !xm.has(id));
  const names = (ids: string[]) => listJoin(ids.map((id) => cropName(ctx, id)));
  const parts: string[] = [];
  if (added.length === 1 && dropped.length === 1) {
    parts.push(`Swaps ${names(dropped)} for ${names(added)}.`);
  } else {
    if (added.length > 0) parts.push(`Adds ${names(added)}.`);
    if (dropped.length > 0) parts.push(`Drops ${names(dropped)}.`);
  }
  const monthList = (ms: number[]) => listJoin(ms.map((m) => MONTH_NAMES[m - 1]));
  for (const [id, xs] of xm) {
    const as = am.get(id);
    if (!as) continue;
    const name = cap(cropName(ctx, id));
    if (as.length !== xs.length) parts.push(`${name} ${times(xs.length)} a year instead of ${times(as.length)}.`);
    else if (as.join() !== xs.join()) parts.push(`${name} moves from ${monthList(as)} to ${monthList(xs)}.`);
  }
  if (parts.length === 0) parts.push("Same crops and planting months as yours.");
  const schedule = [...o.slots]
    .sort((x, y) => x.plant_month - y.plant_month)
    .map((s) => `${cropName(ctx, s.crop_id)} in ${MONTH_NAMES[s.plant_month - 1]}`);
  parts.push(`Plants ${listJoin(schedule)}.`);
  return parts.join(" ");
}

/** The data point behind one component where the option beats A. */
function driverSentence(ctx: Ctx, o: RotationOption, k: ComponentKey): string {
  const a = ctx.a;
  const label = COMPONENT_LABELS[k];
  const fallback = `${label}: ${round(o.scores[k])}, compared with ${round(a.scores[k])} for your crops.`;
  switch (k) {
    case "W": {
      const wx = o.metrics.wsi_mean.p50;
      const wa = a.metrics.wsi_mean.p50;
      if (wx === null || wa === null) return fallback;
      const irrigated = ctx.input.lot.details.water === "some" || ctx.input.lot.details.water === "full";
      const subject = irrigated ? "Rain and your irrigation cover" : "Rain covers";
      return `${subject} about ${pct(1 - wx)} of the crops' water needs in a typical year, compared with ${pct(1 - wa)} for your crops${cite(ctx, "monthly.precip_mm", "rainfall")}.`;
    }
    case "H": {
      const hx = o.scores.H;
      const ha = a.scores.H;
      if (hx === null || ha === null) return fallback;
      const risky = sortedNums([...o.metrics.heat_months, ...o.metrics.waterlog_months]);
      const months = risky.length > 0 ? ` (${formatMonths(risky)})` : "";
      return `${pct((100 - hx) / 100)} of crop days fall in months warmer than the crop's best range or with waterlogging risk${months}, compared with ${pct((100 - ha) / 100)} for your crops${cite(ctx, "monthly.tmax_c", "temperature")}.`;
    }
    case "S": {
      const parts: string[] = [];
      if (o.metrics.legume_days > a.metrics.legume_days) {
        const legumes = cropIds(o).filter((id) => ctx.byId.get(id)?.n_fixing === true);
        if (legumes.length > 0) {
          parts.push(
            `${listJoin(legumes.map((id) => cropName(ctx, id)))} ${isAre(legumes.length)} a legume that adds nitrogen to the soil (${o.metrics.legume_days} days in the field a year)`,
          );
        }
      }
      if (o.metrics.bare_months.length < a.metrics.bare_months.length) {
        parts.push(`bare months go from ${a.metrics.bare_months.length} to ${o.metrics.bare_months.length}`);
      }
      if (o.metrics.families.length > a.metrics.families.length) {
        parts.push(`plant families go from ${a.metrics.families.length} to ${o.metrics.families.length}`);
      }
      return parts.length > 0 ? `${cap(parts.join("; "))}.` : fallback;
    }
    case "E": {
      const ex = o.metrics.bare_rain_share;
      const ea = a.metrics.bare_rain_share;
      if (ex === null || ea === null) return fallback;
      const what = o.metrics.rain_weight === "heavy-rain-days" ? "heavy-rain days (over 50 mm)" : "typical-year rain";
      const field = o.metrics.rain_weight === "heavy-rain-days" ? "heavy-rain days" : "rainfall";
      return `${pct(ex)} of the year's ${what} falls on bare soil, compared with ${pct(ea)} for your crops${cite(ctx, "monthly.precip_mm", field)}.`;
    }
    case "B": {
      const x = o.metrics;
      const y = a.metrics;
      if (x.crop_changes === 0 || y.crop_changes === 0) return fallback;
      const yours = `${y.same_family_changes} of ${y.crop_changes} crop changes keep the same plant family`;
      return x.same_family_changes === 0
        ? `Each crop is followed by one from a different plant family; with your crops, ${yours}.`
        : `${x.same_family_changes} of ${x.crop_changes} crop changes a year keep the same plant family; with your crops, ${yours}.`;
    }
    case "I":
      return `${label}: ${round(o.scores.I)}, compared with ${round(a.scores.I)} for your crops (rough market levels from the crop list, not local prices).`;
    case "M": {
      const access = ctx.access;
      if (!access?.on) return fallback;
      // Describe the best-placed crop, preferring one the farmer doesn't grow yet.
      const ids = [...o.new_crop_ids, ...cropIds(o).filter((id) => !o.new_crop_ids.includes(id))];
      const scored = ids.map((id) => access.by_crop[id]).filter((c) => c && c.score !== null && c.minutes !== null);
      const best = scored.reduce<(typeof scored)[number] | undefined>((b, c) => (!b || (c.score ?? 0) > (b.score ?? 0) ? c : b), undefined);
      if (!best || best.minutes === null || best.perishability === null) return fallback;
      const where = destinationName(ctx, best.destination_id, best.destination_type);
      const time = `${formatMinutes(best.minutes)}, ${best.source_label}`;
      const name = cap(cropName(ctx, best.crop_id));
      const keeps = KEEPS[best.perishability];
      if (best.via_storage) return `${name} ${keeps}, so it can be stored at ${where} (${time}) and sold when prices are better.`;
      if (best.score === 100) return `${name} ${keeps}, so the trip to ${where} (${time}) is not a problem.`;
      return `${name} ${keeps}; the trip to ${where} (${time}) lowers its market access score to ${round(best.score)}.`;
    }
    case "L":
      return `${label}: ${round(o.scores.L)}, compared with ${round(a.scores.L)} for your crops (labor levels from the crop list).`;
  }
}

function whyFor(ctx: Ctx, o: RotationOption): string[] {
  const a = ctx.a;
  if (o.key === "A") {
    const first = a.assumed_calendar
      ? "These are your crops in the usual months for your area (assumed), shown so you can compare."
      : "These are your crops in your months, shown so you can compare.";
    const at = round(a.total);
    if (at === null) return [first];
    const higher = ctx.input.result.options.filter((x) => x.key !== "A" && (round(x.total) ?? -Infinity) > at);
    const second =
      higher.length === 0
        ? "No other option scores higher with your priorities."
        : `${higher.length === 1 ? "Option" : "Options"} ${listJoin(higher.map((x) => x.key))} ${higher.length === 1 ? "scores" : "score"} higher with your priorities.`;
    return [first, second];
  }
  const focus = KIND_FOCUS[o.kind];
  const wins = COMPONENT_KEYS.filter((k) => (delta(ctx, o, k) ?? 0) >= EXPLAIN_MIN_DELTA_POINTS).sort(
    (x, y) =>
      Number(focus.includes(y)) - Number(focus.includes(x)) ||
      (delta(ctx, o, y) as number) - (delta(ctx, o, x) as number) ||
      COMPONENT_KEYS.indexOf(x) - COMPONENT_KEYS.indexOf(y),
  );
  const out = [changeSentence(ctx, o)];
  if (wins.length === 0) out.push("It doesn't beat your crops on any score; it is shown as a different choice to compare.");
  for (const k of wins.slice(0, WHY_TOP_COMPONENTS)) out.push(driverSentence(ctx, o, k));
  return out;
}

// ---------------------------------------------------------------------------
// Benefits and trade-offs
// ---------------------------------------------------------------------------

function countChange(label: string, from: number, to: number): ScoreChange {
  return { component: null, label, from, to, delta: to - from, text: `${label} ${from} → ${to}` };
}

function changesFor(ctx: Ctx, o: RotationOption): { benefits: ScoreChange[]; tradeoffs: ScoreChange[] } {
  const a = ctx.a;
  const benefits: ScoreChange[] = [];
  const tradeoffs: ScoreChange[] = [];

  if (o.key === "A") {
    benefits.push({ component: null, label: "Your crops", from: null, to: null, delta: null, text: "Keeps the crops you already grow." });
    const others = ctx.input.result.options.filter((x) => x.key !== "A");
    if (others.length > 0) {
      for (const k of COMPONENT_KEYS) {
        const mine = round(a.scores[k]);
        const theirs = others.map((x) => round(x.scores[k]));
        if (mine === null || theirs.some((t) => t === null)) continue;
        if (theirs.every((t) => mine >= (t as number))) {
          const tied = theirs.some((t) => t === mine);
          const label = COMPONENT_LABELS[k];
          benefits.push({
            component: k,
            label,
            from: null,
            to: mine,
            delta: null,
            text: `${label} ${mine}: ${tied ? "tied for the highest" : "the highest"} of the options`,
          });
        }
      }
    }
    return { benefits, tradeoffs };
  }

  for (const k of COMPONENT_KEYS) {
    const d = delta(ctx, o, k);
    if (d === null || Math.abs(d) < EXPLAIN_MIN_DELTA_POINTS) continue;
    const label = COMPONENT_LABELS[k];
    const change: ScoreChange = {
      component: k,
      label,
      from: round(a.scores[k]),
      to: round(o.scores[k]),
      delta: d,
      text: `${label} ${d > 0 ? "+" : ""}${d}`,
    };
    (d > 0 ? benefits : tradeoffs).push(change);
  }
  const bareA = a.metrics.bare_months.length;
  const bareX = o.metrics.bare_months.length;
  if (bareX !== bareA) (bareX < bareA ? benefits : tradeoffs).push(countChange("Bare months", bareA, bareX));
  const dryA = a.metrics.stress_months.length;
  const dryX = o.metrics.stress_months.length;
  if (dryX !== dryA) (dryX < dryA ? benefits : tradeoffs).push(countChange("Water-short months in a typical year", dryA, dryX));

  if (benefits.length === 0) {
    benefits.push({ component: null, label: "No gain", from: null, to: null, delta: null, text: "No score improves on your crops." });
  }
  return { benefits, tradeoffs };
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function evidenceFor(ctx: Ctx, o: RotationOption): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const fromProvenance = (topic: string, ...fields: string[]) => {
    const ps = fields.map((f) => provenance(ctx, f)).filter((p): p is Provenance => p !== null);
    if (ps.length === 0) return;
    const source = unique(ps.map((p) => p.source)).join("; ");
    const period = unique(ps.map((p) => p.period)).join("; ");
    const res = unique(ps.map((p) => p.native_res)).join("; ");
    const notes = unique(ps.map((p) => p.note).filter((n): n is string => !!n));
    items.push({
      topic,
      source,
      period,
      citation: notes.length > 0 ? notes.join("; ") : null,
      url: null,
      crop_ids: [],
      text: `${topic}: ${source}, ${period} (${res})`,
    });
  };
  const ids = cropIds(o);
  const crops = ids.map((id) => ctx.byId.get(id)).filter((c): c is Crop => c !== undefined);

  fromProvenance("Rainfall", "monthly.precip_mm");
  fromProvenance("Evaporation (ET₀)", "monthly.et0_mm");
  if (o.scores.H !== null) fromProvenance("Temperature", "monthly.tmax_c", "monthly.tmin_c");
  if (crops.some((c) => c.waterlogging_tolerance === "low")) fromProvenance("Soil wetness", "monthly.rootzone_wetness");

  // Crop references from crops.json `sources`, grouped by citation.
  const topics: [keyof Crop, string, (c: Crop) => boolean][] = [
    ["kc", "Crop water use", () => true],
    ["season_days", "Season length", () => true],
    ["temp_c", "Temperature range", () => o.scores.H !== null],
    ["waterlogging_tolerance", "Waterlogging tolerance", (c) => c.waterlogging_tolerance === "low"],
    ["drought_tolerance", "Drought tolerance", (c) => c.drought_tolerance === "low"],
    ["n_fixing", "Adds nitrogen", (c) => c.n_fixing === true],
    ["family", "Plant family", () => o.scores.B !== null],
    ["perishability", "How long it keeps", () => ctx.access?.on === true],
    ["typical_calendar", "Usual planting months", (c) => ctx.a.slots.some((s) => s.origin === "typical-calendar" && s.crop_id === c.id)],
  ];
  for (const [field, topic, applies] of topics) {
    const groups = new Map<string, EvidenceItem>();
    for (const c of crops) {
      if (!applies(c)) continue;
      const src = c.sources.find((s) => s.field_or_fields.split(",").map((f) => f.trim()).includes(field));
      if (!src) continue;
      const source = shortCitation(src.citation);
      const g = groups.get(source);
      if (g) g.crop_ids.push(c.id);
      else groups.set(source, { topic, source, period: null, citation: src.citation, url: src.url ?? null, crop_ids: [c.id], text: "" });
    }
    for (const g of groups.values()) {
      g.text = `${topic}: ${g.source} (${listJoin(g.crop_ids.map((id) => cropName(ctx, id)))})`;
      items.push(g);
    }
  }

  // Travel time: which kind of time each crop used.
  if (ctx.access?.on) {
    const labels = unique(ids.map((id) => ctx.access?.by_crop[id]?.source_label).filter((l): l is string => !!l));
    if (labels.length > 0) {
      items.push({ topic: "Travel time", source: labels.join(", "), period: null, citation: null, url: null, crop_ids: [], text: `Travel time: ${labels.join(", ")}` });
    }
  }

  // The farmer's own answers.
  const d = ctx.input.lot.details;
  const answers = [
    d.land_type !== "unknown" ? d.land_type : null,
    d.water === "rain" ? "rain only" : d.water === "some" ? "some irrigation" : d.water === "full" ? "full irrigation" : null,
    d.soil !== "unknown" ? `${d.soil} soil (by feel)` : null,
  ].filter((x): x is string => x !== null);
  if (answers.length > 0) {
    items.push({ topic: "Your lot details", source: answers.join(", "), period: null, citation: null, url: null, crop_ids: [], text: `Your lot details: ${answers.join(", ")}` });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Unknowns
// ---------------------------------------------------------------------------

function unknownsFor(ctx: Ctx, o: RotationOption): string[] {
  const out: string[] = [...ctx.input.data.caveats];
  const { result, lot } = ctx.input;
  const d = lot.details;
  const ids = cropIds(o);
  const rice = ponded(o) || ponded(ctx.a);

  if (d.land_type === "unknown") out.push("Land type not given, so washout risk uses a middle value (assumption).");
  if (d.water === "unknown") {
    const share = IRRIGATION_DEFICIT_SHARE.unknown;
    out.push(
      share === 0
        ? "Water source not given, so no irrigation was assumed."
        : `Water source not given, so irrigation was assumed to cover ${pct(share)} of the water shortfall.`,
    );
  }
  if (d.water === "some") {
    out.push(`"Some irrigation" is taken to cover ${pct(IRRIGATION_DEFICIT_SHARE.some)} of the water shortfall (assumption).`);
  }
  if (rice && d.soil === "unknown") out.push("Soil type not given, so rice water loss uses an average soil.");
  if (rice && d.soil !== "unknown") out.push("Soil type is your estimate by feel, not a soil test.");

  if (ctx.a.assumed_calendar) {
    const assumed = unique(ctx.a.slots.filter((s) => s.origin === "typical-calendar").map((s) => cropName(ctx, s.crop_id)));
    out.push(`Your planting months are the usual months for ${listJoin(assumed)} (assumed). Add your own months for a closer comparison.`);
  }

  // Scores left out of every total, and scores missing for this option.
  for (const k of result.components_left_out) {
    if (k === "M") {
      out.push(
        ctx.access?.on
          ? "Market access could not be scored for these crops yet."
          : "Market access is not scored yet: add where you sell or store your harvest.",
      );
    } else if (k === "I") out.push("Income is not scored: the crop list has no market levels yet.");
    else if (k === "L") out.push("Labor is not scored: the crop list has no labor levels yet.");
    else out.push(`${COMPONENT_LABELS[k]} is not scored: data is missing for this lot.`);
  }
  for (const k of o.missing_scores) out.push(`${COMPONENT_LABELS[k]} could not be scored for this option: data is missing.`);
  if (o.scores.I !== null && ctx.weights.I > 0) out.push("Income uses rough market levels from the crop list, not local prices.");

  // Travel.
  const access = ctx.access;
  if (access?.on) {
    out.push("Transport cost is not included.");
    const rough = new Map<string, string>();
    for (const id of ids) {
      const c = access.by_crop[id];
      if (!c) continue;
      if (c.ask_to_confirm && c.minutes !== null && c.destination_id !== null) {
        rough.set(c.destination_id, `Travel time to ${destinationName(ctx, c.destination_id, c.destination_type)} is a rough estimate (${formatMinutes(c.minutes)}). Please confirm it.`);
      }
      if (c.gap === "perishability-unknown") out.push(`How long ${cropName(ctx, id)} keeps is unknown, so its market access is not scored.`);
      if (c.gap === "no-sale-point") out.push(`${cap(cropName(ctx, id))} spoils too fast to store, and no market or buyer is added yet.`);
    }
    out.push(...rough.values());
    if (access.pending_destination_ids.length > 0) out.push("Travel time to some of your places is not worked out yet.");
  }

  // Crop data gaps (A carries the gaps about the farmer's own crops).
  const here = new Set(ids);
  const missingField = new Map<string, string[]>();
  for (const g of result.gaps) {
    const mine = o.key === "A" && (g.code === "unknown-crop" || g.code === "no-months" || g.code === "no-season-length");
    if (g.code === "unknown-crop" && mine) out.push(`"${g.crop_id}" is not in the crop list, so it was left out.`);
    else if (g.code === "no-months" && mine) out.push(`${cap(cropName(ctx, g.crop_id))} has no planting months, so it was left out.`);
    else if (g.code === "no-season-length" && mine) out.push(`${cap(cropName(ctx, g.crop_id))} has no season length, so it was left out.`);
    else if (g.code === "season-from-fao-stages" && here.has(g.crop_id)) {
      out.push(`The season length of ${cropName(ctx, g.crop_id)} is the FAO-56 example, not a local variety.`);
    } else if (g.code === "crop-field-missing" && here.has(g.crop_id)) {
      // Market and labor gaps are already covered when I or L is left out.
      if ((g.field === "market" && result.components_left_out.includes("I")) || (g.field === "labor" && result.components_left_out.includes("L"))) continue;
      missingField.set(g.field, [...(missingField.get(g.field) ?? []), g.crop_id]);
    }
  }
  const FIELD_TEXT: Record<string, (names: string, n: number) => string> = {
    cover_value: (names, n) => `No cover value yet for ${names}, so ${n === 1 ? "it gets" : "they get"} no cover credit in ${COMPONENT_LABELS.S}.`,
    n_fixing: (names) => `Not known whether ${names} adds nitrogen to the soil.`,
    market: (names) => `No market level yet for ${names}.`,
    labor: (names) => `No labor level yet for ${names}.`,
  };
  for (const [field, crops] of missingField) {
    const ids2 = unique(crops);
    out.push(FIELD_TEXT[field](listJoin(ids2.map((id) => cropName(ctx, id))), ids2.length));
  }
  return unique(out);
}

// ---------------------------------------------------------------------------
// Check locally
// ---------------------------------------------------------------------------

function checkLocallyFor(ctx: Ctx, o: RotationOption): string[] {
  const out: string[] = [];
  if (o.key === "A" && o.assumed_calendar) out.push("Are these your usual planting months? If not, add your own.");
  const pondedId = o.slots.find((s) => PONDED_CROP_IDS.includes(s.crop_id))?.crop_id ?? null;
  const roads = new Map<string, { where: string; months: number[] }>();

  for (const id of cropIds(o)) {
    const crop = ctx.byId.get(id);
    if (!crop) continue;
    const name = cropName(ctx, id);
    const months = cropMonths(o, id);
    if (crop.waterlogging_tolerance === "low") {
      const after = pondedId && pondedId !== id ? ` after ${cropName(ctx, pondedId)}` : "";
      out.push(`${cap(name)} doesn't tolerate waterlogging: does the field drain well${after}?`);
    }
    const dry = o.metrics.stress_months.filter((m) => months.includes(m));
    if (crop.drought_tolerance === "low" && dry.length > 0) {
      out.push(`${cap(name)} is sensitive to drought, and in a typical year it is short of water in ${formatMonths(dry)}: can you water it then?`);
    }
    const hot = o.metrics.heat_months.filter((m) => months.includes(m));
    if (hot.length > 0) {
      out.push(`${formatMonths(hot)} can be warmer than the best range for ${name} (FAO Ecocrop): is there a variety that handles heat?`);
    }
    if (o.new_crop_ids.includes(id)) {
      out.push(`Can you get good ${name} seed nearby, and who will buy the harvest?`);
      out.push(`Which ${name} pests and diseases are common in your area?`);
    }
    const c = ctx.access?.on ? ctx.access.by_crop[id] : undefined;
    if (c && c.minutes !== null && c.destination_id !== null) {
      if (c.perishability === "high" && c.ok_minutes !== null && c.minutes > c.ok_minutes) {
        out.push(`${cap(name)} ${KEEPS.high}: is there a closer buyer?`);
      }
      const harvest = o.slots.filter((s) => s.crop_id === id).map((s) => s.harvest_month);
      const r = roads.get(c.destination_id) ?? { where: destinationName(ctx, c.destination_id, c.destination_type), months: [] };
      r.months.push(...harvest);
      roads.set(c.destination_id, r);
    }
  }
  for (const r of roads.values()) out.push(`You harvest in ${formatMonths(r.months)}: is the road to ${r.where} passable then?`);
  out.push(TECHNICIAN_LINE);
  return unique(out);
}

// ---------------------------------------------------------------------------
// Confidence (docs/07 §5)
// ---------------------------------------------------------------------------

/** Total with the water fit of one rain scenario; other components stay as they are. */
function scenarioTotal(ctx: Ctx, o: RotationOption, s: "p20" | "p80"): number | null {
  if (ctx.weights.W > 0 && o.water_fit_range[s] === null) return null;
  return totalScore({ ...o.scores, W: o.water_fit_range[s] }, ctx.weights);
}

/** +1 above A, -1 below, 0 tied (whole points) in a dry and a wet year; `null` if not computable. */
function placeAgainstA(ctx: Ctx, o: RotationOption): { dry: number; wet: number } | null {
  const xs = [scenarioTotal(ctx, o, "p20"), scenarioTotal(ctx, o, "p80")];
  const as = [scenarioTotal(ctx, ctx.a, "p20"), scenarioTotal(ctx, ctx.a, "p80")];
  if ([...xs, ...as].some((v) => v === null)) return null;
  const sign = (i: number) => Math.sign(Math.round((xs[i] as number) - (as[i] as number)));
  return { dry: sign(0), wet: sign(1) };
}

function weakInputs(ctx: Ctx, o: RotationOption): WeakInput[] {
  const d = ctx.input.lot.details;
  const out: WeakInput[] = [];
  if (d.land_type === "unknown") out.push("land-type");
  if (d.water === "unknown") out.push("water-source");
  if (d.soil === "unknown" && (ponded(o) || ponded(ctx.a))) out.push("soil");
  if (ctx.a.assumed_calendar) out.push("planting-months");
  if (ctx.access?.on && cropIds(o).some((id) => ctx.access?.by_crop[id]?.ask_to_confirm)) out.push("travel-time");
  return out;
}

function confidenceFor(ctx: Ctx, o: RotationOption): Confidence {
  const reasons: string[] = [];
  let flips: boolean | null;
  if (o.key === "A") {
    const others = ctx.input.result.options.filter((x) => x.key !== "A");
    const places = others.map((x) => ({ key: x.key, p: placeAgainstA(ctx, x) }));
    const flipped = places.filter((x) => x.p !== null && x.p.dry * x.p.wet < 0).map((x) => x.key);
    flips = flipped.length > 0 ? true : places.some((x) => x.p === null) ? null : false;
    if (flips) reasons.push(`Whether your crops come out ahead of ${listJoin(flipped)} changes between a dry and a wet year.`);
    else if (flips === false && others.length > 0) reasons.push("Your crops keep the same place against every option in a dry and in a wet year.");
  } else {
    const p = placeAgainstA(ctx, o);
    flips = p === null ? null : p.dry * p.wet < 0;
    if (p && flips) {
      const word = (s: number) => (s > 0 ? "above" : "below");
      reasons.push(`In a dry year this option scores ${word(p.dry)} your crops; in a wet year it scores ${word(p.wet)}.`);
    } else if (flips === false) reasons.push("Same place against your crops in a dry and in a wet year.");
  }
  if (flips === null) reasons.push("The dry-year and wet-year check could not be done: rain data is missing.");

  const weak = weakInputs(ctx, o);
  if (weak.length > 0) {
    reasons.push(
      `${weak.length} key input${weak.length === 1 ? " is" : "s are"} "I don't know" or assumed: ${listJoin(weak.map((w) => WEAK_LABEL[w]))}.`,
    );
  }
  if (o.missing_scores.length > 0) {
    reasons.push(`Missing for this option: ${listJoin(o.missing_scores.map((k) => COMPONENT_LABELS[k]))}.`);
  }
  if (o.total === null) reasons.push("This option has no total score.");

  let level: ConfidenceLevel;
  if (flips === true || weak.length >= CONFIDENCE_LOW_WEAK_INPUTS) level = "low";
  else if (flips === false && weak.length === 0 && o.missing_scores.length === 0 && o.total !== null) level = "high";
  else level = "medium";
  if (level === "high") reasons.push("Your lot details and planting months are known.");
  return { level, reasons, ranking_flips: flips, weak_inputs: weak };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** "Why this?", evidence, benefits, unknowns, "check locally" and confidence for every option (docs/07 §5). */
export function explain(input: ExplainInput): ExplainResult {
  const a = input.result.options.find((o) => o.key === "A");
  if (!a) throw new Error("explain needs option A (your crops) in the rotations result");
  const ctx: Ctx = {
    input,
    a,
    byId: new Map(input.library.crops.map((c) => [c.id, c])),
    weights: input.result.weights,
    access: input.access?.on ? input.access : null,
    period: input.data.provenance.find((p) => p.field === "monthly.precip_mm")?.period ?? input.data.period,
  };
  return {
    options: input.result.options.map((o) => {
      const { benefits, tradeoffs } = changesFor(ctx, o);
      return {
        key: o.key,
        kind: o.kind,
        why: whyFor(ctx, o),
        evidence: evidenceFor(ctx, o),
        benefits,
        tradeoffs,
        unknowns: unknownsFor(ctx, o),
        check_locally: checkLocallyFor(ctx, o),
        confidence: confidenceFor(ctx, o),
      };
    }),
  };
}
