// Words for the floating "Adjust results" button (#165): what the farmer has changed, so the
// button shows it even when the controls are closed. No React Native imports.
import type { Scenario } from "../engine/scenario";
import type { Priorities } from "../types";
import { isPicked, PRIORITY_CHIPS } from "./priorities-core";
import { describeScenario } from "./what-if-core";

/** "Save water; what-if: 20% less rain", or null when nothing is changed. */
export function adjustSummary(p: Priorities, scenario: Scenario | null): string | null {
  const goals = PRIORITY_CHIPS.filter((c) => isPicked(p, c.key)).map((c) => c.label);
  const parts = [goals.join(", "), scenario ? `what-if: ${describeScenario(scenario)}` : ""].filter(Boolean);
  return parts.length ? parts.join("; ") : null;
}
