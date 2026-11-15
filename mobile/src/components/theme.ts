import type { TextStyle } from "react-native";

// Design tokens shared by every screen (#21). Same look as the #24 prototype.
// Text contrast (WCAG 2.1, 4.5:1 minimum), checked for each pair we use:
//   ink on bg 15.3 · muted on bg 7.0 · muted on surface 7.7 · green on bg 6.0 ·
//   white on green 6.5 · green on greenTint 5.5 · amber on amberTint 5.3 ·
//   danger on surface 7.7 · muted on disabledBg 5.3 · white on mapBg 9.4
export const colors = {
  bg: "#F6F5F0",
  surface: "#FFFFFF",
  pressed: "#F0EFE9",
  ink: "#1B1F1A",
  muted: "#4F554D",
  // AgroSprout brand (#177): dark green #3b5a2e is the primary (7.8:1 on white, 7.2:1 on bg).
  green: "#3B5A2E",
  greenPressed: "#2C4422",
  greenTint: "#E8EEDD",
  /** Brand olive #4e6c12 (6.0:1 on white): secondary accents and text. */
  olive: "#4E6C12",
  /** Brand leaf green #79973d (3.3:1 on white): bars, icons and fills only, never text. */
  leaf: "#79973D",
  /** Brand gold #e4a427 (2.2:1 on white): fills behind dark text only (ink on gold 7.7:1). */
  gold: "#E4A427",
  goldTint: "#FBEFD5",
  amber: "#A04A06",
  amberTint: "#FCEFE0",
  blue: "#1D5FA8",
  danger: "#9A2B1F",
  dangerPressed: "#7A2118",
  border: "#D9D7CE",
  /**
   * Outline of controls (inputs, chips, month cells, tabs, quiet buttons): #8C8A80 is 3.5:1 on
   * surface and 3.2:1 on bg, so the edge of a control is visible (WCAG 1.4.11 asks 3:1, #45).
   */
  borderStrong: "#8C8A80",
  dashed: "#8C8A80",
  disabledBg: "#D9D7CE",
  mapBg: "#3F4A30",
  white: "#FFFFFF",
} as const;

/**
 * One color per rotation option (A Your crops, B Best for water, C Best for soil, D Balanced), shared
 * by the Soil Health chart and the Recommendations card so an option looks the same everywhere.
 * Each is also drawn with its letter, so color is never the only cue.
 */
export const optionColors = { A: colors.ink, B: colors.blue, C: colors.green, D: colors.amber } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 10, md: 12, lg: 14, pill: 999 } as const;

/** Smallest touch target in dp. Main actions use 48-56. */
export const MIN_TOUCH = 44;

/** Widest a reading column gets (forms, S0, S2, S4, S6): long lines are hard to read. */
export const MAX_CONTENT_WIDTH = 560;

/** Widest a "wide" screen (the dashboard) gets on a big monitor (#114). A layout choice, not data. */
export const MAX_WIDE_WIDTH = 1200;

/**
 * Window size classes (#114), from Material 3: compact < 600 dp (phones, the Android app),
 * medium 600-839 dp, expanded >= 840 dp (laptops, where judges open the web build).
 * https://m3.material.io/foundations/layout/applying-layout/window-size-classes
 */
export const BREAKPOINTS = { medium: 600, expanded: 840 } as const;

export const text = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.ink },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: "600", color: colors.ink },
  small: { fontSize: 14, lineHeight: 20, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 20, color: colors.muted },
} satisfies Record<string, TextStyle>;
