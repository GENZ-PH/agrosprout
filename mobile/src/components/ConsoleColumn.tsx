import { useSyncExternalStore } from "react";
import { useWindowDimensions, View } from "react-native";

import { getConsole, subscribeConsole } from "./console-store";
import { ConsoleRail, NasaConsole } from "./NasaConsole";
import { CONSOLE_WIDTH, PRESENTER_MIN_WIDTH } from "./useLayout";

/** The right-hand column of the presenter layout: the console, or a slim bar to bring it back. */
export function ConsoleColumn() {
  const { width } = useWindowDimensions();
  const open = useSyncExternalStore(subscribeConsole, () => getConsole().open, () => getConsole().open);
  if (width < PRESENTER_MIN_WIDTH) return null;
  if (!open) return <ConsoleRail />;
  return (
    <View style={{ width: CONSOLE_WIDTH, flexShrink: 0 }}>
      <NasaConsole />
    </View>
  );
}
