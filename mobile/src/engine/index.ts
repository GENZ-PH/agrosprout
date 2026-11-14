// Rotation engine entry points (docs/07-rotation-engine.md).
// Pure TypeScript: no React, React Native or Expo imports (enforced by an
// ESLint rule and a test), so it runs offline on Android, on web, and in Node.
// Coefficients live only in ./params.ts.

export * as params from "./params";
export { effectiveRain, waterBalance, waterBalanceRange } from "./waterBalance";
export type { Scenario, WaterBalance, WaterBalanceOutcome, WaterMonth } from "./waterBalance";
export { cropFit } from "./cropFit";
export type { CropFit, FitLevel, FitReason, FitReasonCode, SeasonFit } from "./cropFit";

class NotImplementedYet extends Error {
  constructor(what: string, issue: string) {
    super(`${what} is not implemented yet (${issue})`);
    this.name = "NotImplementedYet";
  }
}

/** A/B/C/D rotation options with component scores (07 §3-4). */
export function rotations(..._args: unknown[]): never {
  throw new NotImplementedYet("rotations", "#26");
}

/** "Your months vs better months" planting-window scan (07 §3b). */
export function plantingWindow(..._args: unknown[]): never {
  throw new NotImplementedYet("plantingWindow", "#33");
}

/** Market access score and layered travel time (07 §3c). */
export function marketAccess(..._args: unknown[]): never {
  throw new NotImplementedYet("marketAccess", "#27");
}

/** Template-driven explanations and confidence (07 §5). */
export function explain(..._args: unknown[]): never {
  throw new NotImplementedYet("explain", "#28");
}
