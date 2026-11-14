// Template-driven explanations and confidence for every rotation option
// (docs/07-rotation-engine.md §5, #28).
// Pure TypeScript (no React Native imports). Deterministic: the same input gives
// the same text. Every number written here comes from the engine output, rounded,
// with its unit. No number is invented, and the text supports, and does not replace,
// the farmer and the agricultural technician (CLAUDE.md rule 6).
//
// Each line has a stable `code` so the texts can be translated later (#37).
import type { Crop, CropLibrary, Lot, LotData } from "../types";
import type { MarketAccessResult } from "./access";
import { CONFIDENCE_LOW_UNKNOWN_INPUTS, EXPLAIN_MIN_DELTA_POINTS } from "./params";
import type { RotationOption, RotationsResult } from "./rotations";
import { COMPONENT_KEYS, type ComponentKey } from "./scores";

export interface ExplainLine {
  /** Stable id of the template, e.g. "why.W". */
  code: string;
  text: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceReason =
  | "ranking-flips-dry-wet"
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
  data: Pick<LotData, "kind" | "period" | "lat" | "lon" | "elevation_m">;
  library: Pick<CropLibrary, "crops">;
  /** From `marketAccess`; omit or `null` while the farm has no destination. */
  access?: MarketAccessResult | null;
}

const COMPONENT_NAME: Record<ComponentKey, string> = {
  W: "Water fit",
  H: "Climate safety",
  S: "Soil building",
  E: "Erosion protection",
  B: "Pest break",
  I: "Income",
  M: "Market access",
  L: "Easy labor",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthList = (ms: readonly number[]) => (ms.length === 0 ? "none" : ms.map((m) => MONTHS[m - 1]).join(", "));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const pts = (x: number) => `${x >= 0 ? "+" : "-"}${Math.round(Math.abs(x))}`;
const line = (code: string, text: string): ExplainLine => ({ code, text });
const names = (ids: readonly string[], byId: Map<string, Crop>) => ids.map((id) => byId.get(id)?.name ?? id);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

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
function checkLocally(opt: RotationOption, byId: Map<string, Crop>, access: MarketAccessResult | null, sloping: boolean): ExplainLine[] {
  const out: ExplainLine[] = [];
  const crops = uniq(opt.slots.map((s) => s.crop_id)).map((id) => byId.get(id)).filter((c): c is Crop => !!c);
  for (const c of crops) {
    if (c.waterlogging_tolerance === "low") {
      out.push(line(`check.waterlogging.${c.id}`, `${c.name} does not tolerate waterlogging. Does the field drain well after heavy rain or after rice?`));
    }
    if (c.drought_tolerance === "low") {
      out.push(line(`check.drought.${c.id}`, `${c.name} is sensitive to dry spells. Is there a water source for dry weeks?`));
    }
    if (c.perishability === "high") {
      out.push(line(`check.perishable.${c.id}`, `${c.name} spoils within days. Is there a close buyer, and is the road passable in the harvest month?`));
    }
    if (opt.new_crop_ids.includes(c.id)) {
      out.push(line(`check.new-crop.${c.id}`, `${c.name} is new on your lot. Is seed available, and do you know the local pests and where to sell it?`));
    }
  }
  if (sloping && opt.metrics.bare_months.length > 0) {
    out.push(line("check.slope-bare", `On a slope, bare soil in ${monthList(opt.metrics.bare_months)} can wash away. Can the soil be kept covered?`));
  }
  if (access?.on && crops.some((c) => access.by_crop[c.id]?.ask_to_confirm)) {
    out.push(line("check.travel-confirm", "Travel time to your harvest place is a rough estimate. Please confirm it, and check the road in the harvest month."));
  }
  out.push(line("check.technician", "Ask your agricultural technician to confirm these months and crops for your field. This tool supports your judgment and theirs; it does not replace it."));
  return out;
}

function unknownsFor(opt: RotationOption, input: ExplainInput, byId: Map<string, Crop>): ExplainLine[] {
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
  if (details.soil === "unknown") out.push(line("unknown.soil", "Soil feel is not given, so average water loss in rice paddies is assumed."));
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
  const left = opt.missing_scores.map((k) => COMPONENT_NAME[k].toLowerCase());
  if (left.length > 0) out.push(line("unknown.missing-scores", `Not scored for this option because data is missing: ${left.join(", ")}.`));
  const missingByCrop = new Map<string, string[]>();
  for (const g of result.gaps) {
    if (!opt.slots.some((s) => s.crop_id === g.crop_id)) continue;
    const crop = byId.get(g.crop_id)?.name ?? g.crop_id;
    if (g.code === "season-from-fao-stages") out.push(line(`unknown.season.${g.crop_id}`, `${crop}: season length comes from FAO stage lengths, not a local value.`));
    if (g.code === "crop-field-missing") missingByCrop.set(g.crop_id, [...(missingByCrop.get(g.crop_id) ?? []), g.field.replace("_", " ")]);
  }
  for (const [id, fields] of missingByCrop) {
    const crop = byId.get(id)?.name ?? id;
    out.push(line(`unknown.crop-fields.${id}`, `${crop}: the crop library has no value for ${fields.join(", ")}.`));
  }
  return out;
}

/** Rank of each option by water fit in a dry (p20) or wet (p80) year; `null` when any is missing. */
function ranks(options: readonly RotationOption[], sc: "p20" | "p80"): Map<string, number> | null {
  if (options.some((o) => o.water_fit_range[sc] === null)) return null;
  const sorted = [...options].sort((a, b) => (b.water_fit_range[sc] as number) - (a.water_fit_range[sc] as number) || (a.key < b.key ? -1 : 1));
  return new Map(sorted.map((o, i) => [o.key, i]));
}

function confidenceFor(opt: RotationOption, input: ExplainInput): Confidence {
  const reasons: ConfidenceReason[] = [];
  const { details } = input.lot;
  const p20 = ranks(input.result.options, "p20");
  const p80 = ranks(input.result.options, "p80");
  if (opt.scores.W === null) reasons.push("water-not-scored");
  if (p20 && p80 && p20.get(opt.key) !== p80.get(opt.key)) reasons.push("ranking-flips-dry-wet");
  const unknownInputs =
    [details.land_type, details.water, details.soil].filter((v) => v === "unknown").length + (opt.assumed_calendar ? 1 : 0);
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
      if (why.length === 0) why.push(line("why.scores", `${swap}It scores higher than your current crops on ${better.slice(0, 2).map((x) => COMPONENT_NAME[x.k].toLowerCase()).join(" and ")}.`));
      else if (swap) why[0] = { ...why[0], text: swap + why[0].text };
    }

    const evidence: ExplainLine[] = [
      line("evidence.power", `NASA POWER monthly rainfall, temperature, humidity, wind, sunshine and root-zone wetness, ${input.data.period}, grid point at latitude ${input.data.lat}, longitude ${input.data.lon}.`),
      line("evidence.fao56", `FAO-56 crop water use (crop coefficients and growth stages) for ${names(uniq(opt.slots.map((s) => s.crop_id)), byId).join(", ")}.`),
      line("evidence.ecocrop", "FAO Ecocrop temperature ranges; crop library values are cited in crops.json."),
    ];
    if (access?.on && !result.components_left_out.includes("M")) {
      const labels = uniq(opt.slots.map((s) => access.by_crop[s.crop_id]?.source_label).filter((l): l is string => !!l));
      if (labels.length) evidence.push(line("evidence.travel", `Travel time source: ${labels.join(", ")}.`));
    }

    const benefits: ExplainLine[] = isA
      ? [line("benefit.yours", "This is your current plan, so there is nothing to compare it with.")]
      : better.length === 0
        ? [line("benefit.none", "No score improves by a clear margin compared with your current crops.")]
        : better.map(({ k, d }) =>
            line(`benefit.${k}`, `${COMPONENT_NAME[k]} ${pts(d)} points${k === "S" ? ` (bare months ${a.metrics.bare_months.length} to ${opt.metrics.bare_months.length})` : ""}`),
          );
    const tradeoffs: ExplainLine[] = worse.map(({ k, d }) => line(`tradeoff.${k}`, `${COMPONENT_NAME[k]} ${pts(d)} points`));

    return {
      option_key: opt.key,
      why,
      evidence,
      benefits,
      tradeoffs,
      unknowns: unknownsFor(opt, input, byId),
      check_locally: checkLocally(opt, byId, access, sloping),
      confidence: confidenceFor(opt, input),
    };
  });
}
