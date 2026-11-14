// Rotation engine entry points (docs/07-rotation-engine.md).
// Pure TypeScript: no React, React Native or Expo imports (enforced by an
// ESLint rule and a test), so it runs offline on Android, on web, and in Node.
// Coefficients live only in ./params.ts.

export * as params from "./params";
export { effectiveRain, waterBalance, waterBalanceRange } from "./waterBalance";
export type { Scenario, WaterBalance, WaterBalanceOutcome, WaterMonth } from "./waterBalance";
export { cropFit } from "./cropFit";
export type { CropFit, FitLevel, FitReason, FitReasonCode, SeasonFit } from "./cropFit";
/** A/B/C/D rotation options with component scores (07 §3-4, #26). */
export { rotations, tooSimilar } from "./rotations";
export { plantingWindow } from "./plantingWindow";
export { harvestMonthMinutes, tripHours, tripsPerHarvest, wetRoad } from "./harvestTrips";
export type { HarvestTrips, TripsGap, WetRoad } from "./harvestTrips";
export { explain } from "./explain";
export type { Confidence, ConfidenceLevel, ConfidenceReason, ExplainInput, ExplainLine, Explanation } from "./explain";
export type {
  PlantingWindowInput,
  PlantingWindowResult,
  SeasonWindow,
  WindowDriver,
  WindowGap,
  WindowMetrics,
  WindowUnknown,
} from "./plantingWindow";
export type {
  OptionKey,
  OptionKind,
  RotationGap,
  RotationOption,
  RotationsInput,
  RotationsResult,
} from "./rotations";
/** Market access (M) per crop and layered travel time (07 §3c, #27). */
export { accessScore, marketAccess, pickTravel, travelAssumptionsFor, TRAVEL_SOURCE_INFO } from "./access";
export type { AccessGap, CropAccess, MarketAccessInput, MarketAccessResult, TravelConfidence } from "./access";
export { priorityWeights, totalScore, COMPONENT_KEYS } from "./scores";
export type {
  ComponentKey,
  ComponentScores,
  ComponentWeights,
  PriorityKey,
  RotationMetrics,
  RotationSlot,
  SlotOrigin,
} from "./scores";
