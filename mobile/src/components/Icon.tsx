import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Clock from "lucide-react-native/icons/clock";
import Info from "lucide-react-native/icons/info";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import Lock from "lucide-react-native/icons/lock";
import MapPin from "lucide-react-native/icons/map-pin";
import Maximize2 from "lucide-react-native/icons/maximize-2";
import Minimize2 from "lucide-react-native/icons/minimize-2";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import Scan from "lucide-react-native/icons/scan";
import Spline from "lucide-react-native/icons/spline";
import Sprout from "lucide-react-native/icons/sprout";
import Trash2 from "lucide-react-native/icons/trash-2";
import Undo2 from "lucide-react-native/icons/undo-2";
import VectorSquare from "lucide-react-native/icons/vector-square";
import X from "lucide-react-native/icons/x";

import { colors } from "./theme";

// Lucide icons (lucide-react-native, ISC, #114): SVG through react-native-svg, no icon font and
// nothing from the network, so they look the same on Android and web and work offline. Each icon
// is imported from its own file, so only these icons go into the bundle (Metro doesn't tree-shake
// the package's index). Screens use our names; swap a Lucide icon here without touching them.
const ICONS = {
  back: ChevronLeft,
  close: X,
  check: Check,
  chevron: ChevronRight,
  plus: Plus,
  info: Info,
  alert: CircleAlert,
  clock: Clock,
  locate: LocateFixed,
  pencil: Pencil,
  trash: Trash2,
  lock: Lock,
  sprout: Sprout,
  undo: Undo2,
  /** "Draw with your finger": a freehand line. */
  draw: Spline,
  expand: Maximize2,
  collapse: Minimize2,
  corners: Scan,
  pin: MapPin,
  /** A shape with corner handles: "Adjust the corners". */
  shape: VectorSquare,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Decorative icon. The control around it carries the accessible label. */
export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2 }: Props) {
  const Glyph = ICONS[name];
  // Hidden from screen readers (#45): the View's aria-hidden works on web, Android and iOS.
  // (react-native-svg would pass the native-only accessibility props to the DOM on web.)
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Glyph size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}
