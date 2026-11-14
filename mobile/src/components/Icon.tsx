import type { ReactNode } from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { colors } from "./theme";

// Stroke icons drawn in a 24x24 box. No emoji and no icon font, so they look the
// same on Android and web and need nothing from the network.
const ICONS = {
  back: <Path d="M15 18l-6-6 6-6" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  check: <Path d="M5 12l5 5 9-10" />,
  chevron: <Path d="M9 6l6 6-6 6" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v5M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 8v5M12 16h.01" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  locate: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  pencil: (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  trash: (
    <>
      <Path d="M3 6h18" />
      <Path d="M8 6V4h8v2" />
      <Path d="M6 6l1 14h10l1-14" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  sprout: (
    <>
      <Path d="M12 21v-9" />
      <Path d="M12 12C12 8 9 5.5 4.5 5.5c0 4.2 3 6.5 7.5 6.5z" />
      <Path d="M12 14c0-4 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z" />
    </>
  ),
  undo: (
    <>
      <Path d="M9 14L4 9l5-5" />
      <Path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  draw: <Path d="M3 17c3-3 5 1 8-2s3-7 6-7 3 3 4 4" />,
  corners: <Path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />,
  pin: (
    <>
      <Path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
      <Circle cx={12} cy={9} r={2.5} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Decorative icon. The control around it carries the accessible label. */
export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[name]}
      </G>
    </Svg>
  );
}
