import { useWindowDimensions } from "react-native";

import { sizeClassFor, type SizeClass } from "./layout-core";

// The window's size class (#114). `useWindowDimensions` updates on a browser resize and on
// phone rotation, so layouts reflow live with no reload.

export interface Layout {
  width: number;
  size: SizeClass;
  /** True on a laptop or desktop window (expanded): the dashboard uses two columns. */
  wide: boolean;
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const size = sizeClassFor(width);
  return { width, size, wide: size === "expanded" };
}
