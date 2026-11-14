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
  green: "#1E6B3B",
  greenPressed: "#14502B",
  greenTint: "#E4EFE6",
  amber: "#A04A06",
  amberTint: "#FCEFE0",
  blue: "#1D5FA8",
  danger: "#9A2B1F",
  dangerPressed: "#7A2118",
  border: "#D9D7CE",
  borderStrong: "#C9C7BD",
  dashed: "#8C8A80",
  disabledBg: "#D9D7CE",
  mapBg: "#3F4A30",
  white: "#FFFFFF",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 10, md: 12, lg: 14, pill: 999 } as const;

/** Smallest touch target in dp. Main actions use 48-56. */
export const MIN_TOUCH = 44;

/** Widest the content gets on a desktop browser (judges use the web build). */
export const MAX_CONTENT_WIDTH = 560;

export const text = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.ink },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: "600", color: colors.ink },
  small: { fontSize: 14, lineHeight: 20, color: colors.ink },
  caption: { fontSize: 13, lineHeight: 18, color: colors.muted },
} satisfies Record<string, TextStyle>;
