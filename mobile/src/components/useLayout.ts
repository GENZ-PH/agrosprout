import { useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";

import { getInspector, subscribeInspector } from "./inspector-store";
import { canDock, DOCK_WIDTH, sizeClassFor, type SizeClass, TWO_COLUMN_MIN_WITH_DOCK } from "./layout-core";

// The window's size class (#114). `useWindowDimensions` updates on a browser resize and on
// phone rotation, so layouts reflow live with no reload. When the NASA data panel docks beside
// the page (#165), the page lays out for the width that is left, not the whole window.

export interface Layout {
  /** The whole window (decides whether the panel can dock). */
  width: number;
  /** The width the page itself gets: the window minus the docked panel, if open. */
  contentWidth: number;
  size: SizeClass;
  /** True when the page has room for two dashboard columns. */
  wide: boolean;
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const docked = useSyncExternalStore(subscribeInspector, getInspector, getInspector) !== null && canDock(width);
  const contentWidth = docked ? width - DOCK_WIDTH : width;
  const size = sizeClassFor(contentWidth);
  const wide = size === "expanded" && (!docked || contentWidth >= TWO_COLUMN_MIN_WITH_DOCK);
  return { width, contentWidth, size, wide };
}
