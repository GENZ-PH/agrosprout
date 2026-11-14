import { Platform } from "react-native";
import type { CartesianChartTheme } from "react-native-chart-kit/v2";

import { colors, optionColors } from "./theme";

// One Chart Kit theme for every chart in the app (#114, D30): the app's own colors, so charts use
// the contrast pairs already checked in theme.ts (#45), and the system font (SVG text is a serif
// font on web unless told otherwise). Charts draw with react-native-svg: nothing from the network.

export const CHART_FONT = Platform.OS === "web" ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" : undefined;

export const chartTheme: CartesianChartTheme = {
  background: colors.surface,
  plotBackground: colors.surface,
  grid: colors.border,
  axis: colors.borderStrong,
  text: colors.ink,
  mutedText: colors.muted,
  series: [optionColors.A, optionColors.B, optionColors.C, optionColors.D],
  typography: { fontFamily: CHART_FONT, axisLabelSize: 12, legendLabelSize: 13 },
};
