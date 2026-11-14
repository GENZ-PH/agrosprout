// Window size class from the window width (#114). No React Native imports, so `npm test` runs it
// in Node; useLayout.ts binds it to the live window size.
import { BREAKPOINTS } from "./theme";

export type SizeClass = "compact" | "medium" | "expanded";

export function sizeClassFor(width: number): SizeClass {
  if (width >= BREAKPOINTS.expanded) return "expanded";
  if (width >= BREAKPOINTS.medium) return "medium";
  return "compact";
}

/** Split a list into rows of `n`, for a grid that keeps each item's place (left to right, then down). */
export function rowsOf<T>(items: readonly T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Width of the NASA data panel when it docks beside the page (#144, #165). */
export const DOCK_WIDTH = 400;

/**
 * Dock the panel only when the page keeps at least the expanded width (840) beside it; a
 * narrower window gets the sheet from the bottom instead.
 */
export const canDock = (windowWidth: number): boolean => windowWidth >= BREAKPOINTS.expanded + DOCK_WIDTH;

/**
 * Two dashboard columns need about 1000 dp of page once the panel takes its share, so each
 * card stays readable (#165). Without the panel the usual expanded size class (840) applies.
 */
export const TWO_COLUMN_MIN_WITH_DOCK = 1000;
