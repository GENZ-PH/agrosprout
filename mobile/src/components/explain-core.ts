// What "Explain this plan with SI" sends (D33): the engine's own results for one plan, already in
// the words the dashboard shows. No location, lot shape, lot name or farm name (CLAUDE.md rule 8).
// Pure TypeScript, no React Native imports, so it is unit-tested in Node.
import type { ComponentKey, Explanation, RotationOption } from "../engine";
import { confidenceReasonText, deltaText, optionCropsText, scoreRows } from "./recommendations-core";
import { OPTION_LABELS } from "./soil-health-chart-core";

/** Matches `explainBody` in api/src/routes/explain.ts (the API validates it again). */
export type ExplainRequest = {
  plan: string;
  crops: string;
  score: number | null;
  yourScore: number | null;
  scores: string[];
  why: string[];
  tradeoffs: string[];
  unknowns: string[];
  checkLocally: string[];
  confidence: Explanation["confidence"]["level"];
  confidenceReasons: string[];
  audience?: "farmer" | "technician";
  /** NASA satellite and model checks for the lot (`satelliteYearFacts`); they do not change the scores. */
  satellite?: string[];
};

const MAX_LINES = 8;
const MAX_LINE = 400;
const clip = (xs: readonly string[]) => xs.slice(0, MAX_LINES).map((x) => (x.length > MAX_LINE ? `${x.slice(0, MAX_LINE - 1)}…` : x));
const round = (n: number | null) => (n == null ? null : Math.round(n));

export function explainRequest(args: {
  pick: RotationOption;
  a: RotationOption | undefined;
  explanation: Explanation;
  cropName: (id: string) => string;
  componentsLeftOut: readonly ComponentKey[];
  satellite?: readonly string[];
}): ExplainRequest {
  const { pick, a, explanation: ex, cropName, componentsLeftOut } = args;
  const sat = clip(args.satellite ?? []);
  const isA = pick.key === "A";
  const scores = scoreRows(pick, a, componentsLeftOut)
    .filter((r) => !r.left_out && r.value !== null)
    .map((r) => (r.delta === null ? `${r.label}: ${r.value}` : `${r.label}: ${r.value} (${deltaText(r.delta)})`));
  return {
    plan: isA ? "Keep your crops" : `Option ${pick.key}: ${OPTION_LABELS[pick.key]}`,
    crops: optionCropsText(pick, cropName).slice(0, 300),
    score: round(pick.total),
    yourScore: round(a?.total ?? null),
    scores: clip(scores),
    why: clip(ex.why.map((l) => l.text)),
    tradeoffs: clip(ex.tradeoffs.map((l) => l.text)),
    unknowns: clip(ex.unknowns.map((l) => l.text)),
    checkLocally: clip(ex.check_locally.map((l) => l.text)),
    confidence: ex.confidence.level,
    confidenceReasons: clip(ex.confidence.reasons.map(confidenceReasonText)),
    ...(sat.length ? { satellite: sat } : {}),
  };
}

/** Words for each error code the API can send back. */
export function explainErrorText(code: string): string {
  switch (code) {
    case "si_off":
      return "SI explanations are not switched on yet. The reasons above come straight from the results.";
    case "rate_limited":
    case "si_busy":
      return "Too many explanations right now. Try again in a minute.";
    case "si_unchecked":
      return "The SI answer used numbers that are not in your results, so it is not shown. The reasons above are from the results.";
    case "si_declined":
      return "The SI model could not explain this plan. The reasons above come straight from the results.";
    case "timeout":
    case "network_error":
      return "Could not reach the SI service. Check your signal and try again.";
    default:
      return "Could not get an explanation. The reasons above come straight from the results.";
  }
}
