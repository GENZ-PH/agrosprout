// Template-driven explanations and confidence for every rotation option
// (docs/07-rotation-engine.md §5, #28).
// Pure TypeScript (no React Native imports). Deterministic: the same input gives
// the same text. Every number written here comes from the engine output, rounded,
// with its unit. No number is invented, and the text supports, and does not replace,
// the farmer and the agricultural technician (CLAUDE.md rule 6).
//
// Each line has a stable `code` so the texts can be translated later (#37).
import type { Crop, CropLibrary, Destination, DestinationType, Lot, LotData, Provenance } from "../types";
import type { MarketAccessResult } from "./access";
import { CONFIDENCE_LOW_UNKNOWN_INPUTS, EXPLAIN_MIN_DELTA_POINTS, PONDED_CROP_IDS } from "./params";
import type { RotationOption, RotationsResult } from "./rotations";
import { COMPONENT_KEYS, totalScore, type ComponentKey } from "./scores";

export interface ExplainLine {
  /** Stable id of the template, e.g. "why.W". */
  code: string;
  text: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceReason =
  | "ranking-flips-dry-wet"
  /** The dry/wet check could not run (a water fit range is missing). Caps confidence at Medium. */
  | "dry-wet-not-checked"
  | "unknown-inputs"
  | "one-unknown-input"
  | "scores-missing"
  | "crop-data-missing"
  | "water-not-scored";

export interface Confidence {
  level: ConfidenceLevel;
  reasons: ConfidenceReason[];
}

export interface Explanation {
  option_key: RotationOption["key"];
  /** Top 2 components where the option beats the farmer's own crops, with the driving number. */
  why: ExplainLine[];
  evidence: ExplainLine[];
  /** Components that improve, with deltas. */
  benefits: ExplainLine[];
  /** Components that get worse, so the picture is not one-sided. */
  tradeoffs: ExplainLine[];
  unknowns: ExplainLine[];
  check_locally: ExplainLine[];
  confidence: Confidence;
}

export interface ExplainInput {
  result: RotationsResult;
  lot: Pick<Lot, "details">;
  /** `provenance` is optional: when given, evidence names each data source with its period and grid size. */
  data: Pick<LotData, "kind" | "period" | "lat" | "lon" | "elevation_m"> & Partial<Pick<LotData, "provenance">>;
  library: Pick<CropLibrary, "crops">;
  /** From `marketAccess`; omit or `null` while the farm has no destination. */
  access?: MarketAccessResult | null;
  /** The farm's destinations, so road questions can use their names. */
  destinations?: readonly Destination[];
}

/** Farmer-facing component labels (docs/07 §4 table). Exported so the UI uses the same words. */
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
const COMPONENT_NAME = COMPONENT_LABELS;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthList = (ms: readonly number[]) => (ms.length === 0 ? "none" : ms.map((m) => MONTHS[m - 1]).join(", "));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const pts = (x: number) => `${x >= 0 ? "+" : "-"}${Math.round(Math.abs(x))}`;
const line = (code: string, text: string): ExplainLine => ({ code, text });
/** Crop name without the clarifying part in brackets, e.g. "Lowland rice (irrigated or rainfed paddy)" -> "Lowland rice". */
const shortName = (c: Pick<Crop, "name">) => c.name.replace(/\s*\(.*\)\s*$/, "").trim() || c.name;
const names = (ids: readonly string[], byId: Map<string, Crop>) => ids.map((id) => { const c = byId.get(id); return c ? shortName(c) : id; });
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
/** "a", "a and b", "a, b and c". */
const listJoin = (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** True when paddy rice is in any of these options: the only place soil feel enters the water balance. */
const hasPonded = (...opts: RotationOption[]) => opts.some((o) => o.slots.some((s) => PONDED_CROP_IDS.includes(s.crop_id)));

const DESTINATION_WORD: Readonly<Record<DestinationType, string>> = {
  market: "the market",
  storage: "storage",
  buyer: "your buyer",
  coop: "the co-op",
};

/** Short form of a crops.json citation: the text before the first " (", ":" or ";". */
export function shortCitation(citation: string): string {
  const cut = [" (", ":", ";"].map((x) => citation.indexOf(x)).filter((i) => i > 0);
  return (cut.length > 0 ? citation.slice(0, Math.min(...cut)) : citation).trim();
}

/** Sentence with the number that drives a component's change, from option vs A (your crops). */
function driver(k: ComponentKey, opt: RotationOption, a: RotationOption, access: MarketAccessResult | null): string | null {
  const o = opt.metrics;
  const y = a.metrics;
  switch (k) {
    case "W": {
      const wo = o.wsi_mean.p50;
      const wy = y.wsi_mean.p50;
      if (wo === null || wy === null) return null;
      return `In a typical year, unmet crop water need falls from ${pct(wy)} to ${pct(wo)} (stress months: ${monthList(y.stress_months)} to ${monthList(o.stress_months)}).`;
    }
    case "H":
      return `Months with heat or waterlogging risk: ${monthList(y.heat_months.concat(y.waterlog_months))} to ${monthList(o.heat_months.concat(o.waterlog_months))}.`;
    case "S":
      return `Bare-soil months go from ${y.bare_months.length} to ${o.bare_months.length}; nitrogen-fixing crop days go from ${Math.round(y.legume_days)} to ${Math.round(o.legume_days)}.`;
    case "E":
      return o.bare_rain_share === null || y.bare_rain_share === null
        ? null
        : `The share of rain falling on bare soil goes from ${pct(y.bare_rain_share)} to ${pct(o.bare_rain_share)}.`;
    case "B":
      return `Crop changes within the same plant family go from ${y.same_family_changes} of ${y.crop_changes} to ${o.same_family_changes} of ${o.crop_changes}.`;
    case "M": {
      if (!access?.on) return null;
      const used = uniq(opt.slots.map((s) => access.by_crop[s.crop_id]).filter((c) => c?.minutes != null).map((c) => `${Math.round(c.minutes as number)} min (${c.source_label})`));
      return used.length ? `One-way travel time to the best harvest place: ${used.join("; ")}.` : null;
    }
    case "I":
      return "The crops have a higher market level in the crop library.";
    case "L":
      return "The crops need less work in the crop library.";
  }
}

/** Crop-specific questions for the agricultural technician. */
function checkLocally(
  opt: RotationOption,
  byId: Map<string, Crop>,
  access: MarketAccessResult | null,
  sloping: boolean,
  destinations: readonly Destination[],
): ExplainLine[] {
  const out: ExplainLine[] = [];
  const crops = uniq(opt.slots.map((s) => s.crop_id)).map((id) => byId.get(id)).filter((c): c is Crop => !!c);
  for (const c of crops) {
    if (c.waterlogging_tolerance === "low") {
      out.push(line(`check.waterlogging.${c.id}`, `${shortName(c)} does not tolerate waterlogging. Does the field drain well after heavy rain or after rice?`));
    }
    if (c.drought_tolerance === "low") {
      out.push(line(`check.drought.${c.id}`, `${shortName(c)} is sensitive to dry spells. Is there a water source for dry weeks?`));
    }
    if (c.perishability === "high") {
      out.push(line(`check.perishable.${c.id}`, `${shortName(c)} spoils within days. Is there a close buyer?`));
    }
    if (opt.new_crop_ids.includes(c.id)) {
      out.push(line(`check.new-crop.${c.id}`, `${shortName(c)} is new on your lot. Is seed available, and do you know the local pests and where to sell it?`));
    }
  }
  if (sloping && opt.metrics.bare_months.length > 0) {
    out.push(line("check.slope-bare", `On a slope, bare soil in ${monthList(opt.metrics.bare_months)} can wash away. Can the soil be kept covered?`));
  }
  if (access?.on && crops.some((c) => access.by_crop[c.id]?.ask_to_confirm)) {
    out.push(line("check.travel-confirm", "Travel time to your harvest place is a rough estimate. Please confirm it."));
  }
  // One road question per destination, naming the harvest months of the crops that go there.
  if (access?.on) {
    const roads = new Map<string, { name: string; months: number[] }>();
    for (const s of opt.slots) {
      const c = access.by_crop[s.crop_id];
      if (!c || c.destination_id === null || c.minutes === null) continue;
      const d = destinations.find((x) => x.id === c.destination_id);
      const name = d && d.name.trim() ? d.name.trim() : c.destination_type ? DESTINATION_WORD[c.destination_type] : "your harvest place";
      const r = roads.get(c.destination_id) ?? { name, months: [] };
      r.months.push(s.harvest_month);
      roads.set(c.destination_id, r);
    }
    for (const [id, r] of roads) {
      const months = listJoin(uniq(r.months).sort((x, y) => x - y).map((m) => MONTHS[m - 1]));
      out.push(line(`check.road.${id}`, `You harvest in ${months}. Is the road to ${r.name} passable then?`));
    }
  }
  out.push(line("check.technician", "Ask your agricultural technician to confirm these months and crops for your field. This tool supports your judgment and theirs; it does not replace it."));
  return out;
}

function unknownsFor(opt: RotationOption, a: RotationOption, input: ExplainInput, byId: Map<string, Crop>): ExplainLine[] {
  const { details } = input.lot;
  const { data, result, access } = input;
  const out: ExplainLine[] = [];
  if (data.kind === "live") {
    out.push(line("unknown.grid-cell", "Climate numbers describe a NASA POWER grid cell about 50 km wide, not your exact field."));
  }
  if (data.elevation_m === null) {
    out.push(line("unknown.elevation", "Your field's elevation is not known, so evapotranspiration is calculated at sea level."));
  }
  if (details.land_type === "unknown") out.push(line("unknown.land-type", "Land type is not given, so a middle value for erosion is used."));
  if (details.water === "unknown") out.push(line("unknown.water", "Water source is not given, so rain only is assumed."));
  if (details.soil === "unknown" && hasPonded(opt, a)) {
    out.push(line("unknown.soil", "Soil feel is not given, so average water loss in rice paddies is assumed."));
  }
  if (opt.assumed_calendar) out.push(line("unknown.calendar", "These months are the typical local calendar (assumed), not your own months."));
  out.push(line("unknown.typical-year", "Scores use a typical year; a dry year or a wet year can turn out different."));
  if (result.components_left_out.includes("M") || !access?.on) {
    out.push(line("unknown.no-destination", "No harvest place is added yet, so market access is not scored."));
  } else {
    out.push(line("unknown.transport-cost", "Transport cost is not included."));
    if (access.pending_destination_ids.length > 0) {
      out.push(line("unknown.travel-pending", "Travel time to some harvest places is not known yet."));
    }
  }
  if (!result.components_left_out.includes("I")) {
    out.push(line("unknown.prices", "No local price data: income uses a crop market level, not prices."));
  }
  const left = opt.missing_scores.map((k) => COMPONENT_NAME[k]);
  if (left.length > 0) out.push(line("unknown.missing-scores", `Not scored for this option because data is missing: ${left.join(", ")}.`));
  const missingByCrop = new Map<string, string[]>();
  for (const g of result.gaps) {
    if (!opt.slots.some((s) => s.crop_id === g.crop_id)) continue;
    const gc = byId.get(g.crop_id);
    const crop = gc ? shortName(gc) : g.crop_id;
    if (g.code === "season-from-fao-stages") out.push(line(`unknown.season.${g.crop_id}`, `${crop}: season length comes from FAO stage lengths, not a local value.`));
    if (g.code === "crop-field-missing") missingByCrop.set(g.crop_id, [...(missingByCrop.get(g.crop_id) ?? []), g.field.replace("_", " ")]);
  }
  for (const [id, fields] of missingByCrop) {
    const mc = byId.get(id);
    const crop = mc ? shortName(mc) : id;
    out.push(line(`unknown.crop-fields.${id}`, `${crop}: the crop library has no value for ${fields.join(", ")}.`));
  }
  return out;
}

/** Total with the dry-year (p20) or wet-year (p80) water fit; the other components stay as they are. */
function scenarioTotal(o: RotationOption, sc: "p20" | "p80", weights: RotationsResult["weights"]): number | null {
  if (weights.W > 0 && o.water_fit_range[sc] === null) return null;
  return totalScore({ ...o.scores, W: o.water_fit_range[sc] }, weights);
}

/**
 * Does the option move from above A to below A (or back) between a dry and a
 * wet year? Totals use the farmer's weights and are compared in whole points,
 * so this follows the ranking the farmer sees. `null` = could not be checked.
 */
function flipsAgainst(o: RotationOption, a: RotationOption, weights: RotationsResult["weights"]): boolean | null {
  const t = [scenarioTotal(o, "p20", weights), scenarioTotal(o, "p80", weights), scenarioTotal(a, "p20", weights), scenarioTotal(a, "p80", weights)];
  if (t.some((v) => v === null)) return null;
  const [o20, o80, a20, a80] = t as number[];
  return Math.sign(Math.round(o20 - a20)) * Math.sign(Math.round(o80 - a80)) < 0;
}

function confidenceFor(opt: RotationOption, a: RotationOption, input: ExplainInput): Confidence {
  const reasons: ConfidenceReason[] = [];
  const { details } = input.lot;
  const { options, weights } = input.result;
  if (opt.scores.W === null) reasons.push("water-not-scored");
  // A is checked against every other option; B, C and D against A.
  const checks =
    opt.key === a.key ? options.filter((o) => o.key !== a.key).map((o) => flipsAgainst(o, a, weights)) : [flipsAgainst(opt, a, weights)];
  if (checks.some((f) => f === true)) reasons.push("ranking-flips-dry-wet");
  else if (checks.some((f) => f === null)) reasons.push("dry-wet-not-checked");
  // Soil feel only counts when paddy rice is in the comparison: it only sets rice water loss.
  const unknownInputs =
    [details.land_type, details.water].filter((v) => v === "unknown").length +
    (details.soil === "unknown" && hasPonded(opt, a) ? 1 : 0) +
    (opt.assumed_calendar ? 1 : 0);
  if (unknownInputs >= CONFIDENCE_LOW_UNKNOWN_INPUTS) reasons.push("unknown-inputs");
  else if (unknownInputs === 1) reasons.push("one-unknown-input");
  if (opt.missing_scores.length > 0) reasons.push("scores-missing");
  if (input.result.gaps.some((g) => g.code === "crop-field-missing" && opt.slots.some((s) => s.crop_id === g.crop_id))) {
    reasons.push("crop-data-missing");
  }
  const low = reasons.some((r) => r === "ranking-flips-dry-wet" || r === "unknown-inputs" || r === "water-not-scored");
  const level: ConfidenceLevel = low ? "low" : reasons.length > 0 ? "medium" : "high";
  return { level, reasons };
}

interface CropEvidence {
  field: keyof Crop;
  topic: string;
  applies: (c: Crop, opt: RotationOption, a: RotationOption, input: ExplainInput) => boolean;
}

/** Crop values whose crops.json citation is listed as evidence, and when each one applies. */
const CROP_EVIDENCE: readonly CropEvidence[] = [
  { field: "kc", topic: "Crop water use", applies: () => true },
  { field: "season_days", topic: "Season length", applies: () => true },
  { field: "temp_c", topic: "Temperature range", applies: (_c, o) => o.scores.H !== null },
  { field: "waterlogging_tolerance", topic: "Waterlogging tolerance", applies: (c) => c.waterlogging_tolerance === "low" },
  { field: "drought_tolerance", topic: "Drought tolerance", applies: (c) => c.drought_tolerance === "low" },
  { field: "n_fixing", topic: "Adds nitrogen", applies: (c) => c.n_fixing === true },
  { field: "family", topic: "Plant family", applies: (_c, o) => o.scores.B !== null },
  { field: "perishability", topic: "How long it keeps", applies: (_c, _o, _a, i) => i.access?.on === true },
  {
    field: "typical_calendar",
    topic: "Usual planting months",
    applies: (c, _o, a) => a.slots.some((s) => s.origin === "typical-calendar" && s.crop_id === c.id),
  },
];

/**
 * Evidence: the lot's data sources from its provenance (source, period, grid
 * size), then the crops.json citations behind the crop values used, grouped
 * per citation. The general lines stay when provenance is not passed or a crop
 * value has no citation.
 */
function evidenceFor(opt: RotationOption, a: RotationOption, input: ExplainInput, byId: Map<string, Crop>): ExplainLine[] {
  const out: ExplainLine[] = [];
  const crops = uniq(opt.slots.map((s) => s.crop_id)).map((id) => byId.get(id)).filter((c): c is Crop => !!c);
  const prov = input.data.provenance ?? [];
  const fromProvenance = (code: string, topic: string, ...fields: string[]) => {
    const ps = fields.map((f) => prov.find((p) => p.field === f)).filter((p): p is Provenance => !!p);
    if (ps.length === 0) return;
    const join = (xs: string[]) => uniq(xs).join("; ");
    out.push(line(code, `${topic}: ${join(ps.map((p) => p.source))}, ${join(ps.map((p) => p.period))} (${join(ps.map((p) => p.native_res))}).`));
  };
  fromProvenance("evidence.data.rain", "Rainfall", "monthly.precip_mm");
  fromProvenance("evidence.data.et0", "Evaporation (ET₀)", "monthly.et0_mm");
  if (opt.scores.H !== null) fromProvenance("evidence.data.temperature", "Temperature", "monthly.tmax_c", "monthly.tmin_c");
  if (crops.some((c) => c.waterlogging_tolerance === "low")) fromProvenance("evidence.data.wetness", "Soil wetness", "monthly.rootzone_wetness");
  if (out.length === 0) {
    out.push(
      line(
        "evidence.power",
        `NASA POWER monthly rainfall, temperature, humidity, wind, sunshine and root-zone wetness, ${input.data.period}, grid point at latitude ${input.data.lat}, longitude ${input.data.lon}.`,
      ),
    );
  }

  const cited = new Set<keyof Crop>();
  for (const { field, topic, applies } of CROP_EVIDENCE) {
    const groups = new Map<string, string[]>();
    for (const c of crops) {
      if (!applies(c, opt, a, input)) continue;
      const src = c.sources.find((x) => x.field_or_fields.split(",").map((f) => f.trim()).includes(field));
      if (!src) continue;
      const key = shortCitation(src.citation);
      groups.set(key, [...(groups.get(key) ?? []), c.id]);
    }
    for (const [source, ids] of groups) {
      cited.add(field);
      out.push(line(`evidence.crop.${field}.${ids.join("+")}`, `${topic}: ${source} (${listJoin(names(ids, byId))}).`));
    }
  }
  if (!cited.has("kc")) {
    out.push(line("evidence.fao56", `FAO-56 crop water use (crop coefficients and growth stages) for ${names(crops.map((c) => c.id), byId).join(", ")}.`));
  }
  if (!cited.has("temp_c")) out.push(line("evidence.ecocrop", "FAO Ecocrop temperature ranges; crop library values are cited in crops.json."));
  return out;
}

/** The six explanation fields and the confidence badge for every option (docs/07 §5). */
export function explain(input: ExplainInput): Explanation[] {
  const { result, library } = input;
  const access = input.access ?? null;
  const byId = new Map(library.crops.map((c) => [c.id, c]));
  const a = result.options.find((o) => o.key === "A") ?? result.options[0];
  const sloping = input.lot.details.land_type === "sloping";

  return result.options.map((opt) => {
    const isA = opt.key === a.key;
    const deltas = COMPONENT_KEYS.flatMap((k) => {
      const v = opt.scores[k];
      const base = a.scores[k];
      return v === null || base === null ? [] : [{ k, d: v - base }];
    });
    // Biggest gain first; equal gains keep the fixed component order.
    const better = deltas.filter((x) => !isA && x.d >= EXPLAIN_MIN_DELTA_POINTS).sort((p, q) => q.d - p.d);
    const worse = deltas.filter((x) => !isA && x.d <= -EXPLAIN_MIN_DELTA_POINTS).sort((p, q) => p.d - q.d);

    const swap = opt.new_crop_ids.length > 0 ? `Adds ${names(opt.new_crop_ids, byId).join(" and ")}. ` : "";
    const why: ExplainLine[] = [];
    if (isA) {
      why.push(line("why.yours", opt.assumed_calendar ? "Your crops on the typical local calendar (assumed). The other options are compared with this one." : "Your crops on your own months. The other options are compared with this one."));
    } else if (better.length === 0) {
      why.push(line("why.none", `${swap}It does not beat your current crops on any score by a clear margin; it is shown as a different way to use the lot.`));
    } else {
      for (const { k } of better.slice(0, 2)) {
        const d = driver(k, opt, a, access);
        if (d) why.push(line(`why.${k}`, `${COMPONENT_NAME[k]}: ${d}`));
      }
      if (why.length === 0) why.push(line("why.scores", `${swap}It scores higher than your current crops on ${listJoin(better.slice(0, 2).map((x) => COMPONENT_NAME[x.k]))}.`));
      else if (swap) why[0] = { ...why[0], text: swap + why[0].text };
    }

    const evidence = evidenceFor(opt, a, input, byId);
    if (access?.on && !result.components_left_out.includes("M")) {
      const labels = uniq(opt.slots.map((s) => access.by_crop[s.crop_id]?.source_label).filter((l): l is string => !!l));
      if (labels.length) evidence.push(line("evidence.travel", `Travel time source: ${labels.join(", ")}.`));
    }

    const benefits: ExplainLine[] = isA
      ? [line("benefit.yours", "This is your current plan, so there is nothing to compare it with.")]
      : better.length === 0
        ? [line("benefit.none", "No score improves by a clear margin compared with your current crops.")]
        : better.map(({ k, d }) =>
            line(
              `benefit.${k}`,
              `${COMPONENT_NAME[k]} ${pts(d)} points${
                k === "S" && opt.metrics.bare_months.length < a.metrics.bare_months.length
                  ? ` (bare months ${a.metrics.bare_months.length} to ${opt.metrics.bare_months.length})`
                  : ""
              }`,
            ),
          );
    const tradeoffs: ExplainLine[] = worse.map(({ k, d }) => line(`tradeoff.${k}`, `${COMPONENT_NAME[k]} ${pts(d)} points`));
    // More bare months is a cost even when the soil-building score still rises.
    if (!isA && opt.metrics.bare_months.length > a.metrics.bare_months.length) {
      tradeoffs.push(line("tradeoff.bare-months", `Bare-soil months go from ${a.metrics.bare_months.length} to ${opt.metrics.bare_months.length}.`));
    }

    return {
      option_key: opt.key,
      why,
      evidence,
      benefits,
      tradeoffs,
      unknowns: unknownsFor(opt, a, input, byId),
      check_locally: checkLocally(opt, byId, access, sloping, input.destinations ?? []),
      confidence: confidenceFor(opt, a, input),
    };
  });
}
