import { useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";

import { getConsole, subscribeConsole } from "./console-store";
import { sizeClassFor, type SizeClass } from "./layout-core";

// The window's size class (#114). `useWindowDimensions` updates on a browser resize and on
// phone rotation, so layouts reflow live with no reload.
//
// Presenter layout: on a window of PRESENTER_MIN_WIDTH or more with the NASA data console open,
// the farmer's app keeps a phone-like column and the console takes the rest. The app then lays
// itself out for that column, not for the whole window.

export const PRESENTER_MIN_WIDTH = 1100;
export const CONSOLE_WIDTH = 480;
/** The farmer's column in the presenter layout. */
export const APP_COLUMN_WIDTH = 560;

export interface Layout {
  width: number;
  size: SizeClass;
  /** True on a laptop or desktop window (expanded): the dashboard uses two columns. */
  wide: boolean;
  /** True when the NASA data console sits beside the app. */
  presenter: boolean;
}

export function usePresenter(): boolean {
  const { width } = useWindowDimensions();
  const open = useSyncExternalStore(subscribeConsole, () => getConsole().open, () => getConsole().open);
  return width >= PRESENTER_MIN_WIDTH && open;
}

export function useLayout(): Layout {
  const { width: windowWidth } = useWindowDimensions();
  const presenter = usePresenter();
  const width = presenter ? Math.min(windowWidth - CONSOLE_WIDTH, APP_COLUMN_WIDTH) : windowWidth;
  const size = sizeClassFor(width);
  return { width, size, wide: size === "expanded", presenter };
}
