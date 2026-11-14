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
