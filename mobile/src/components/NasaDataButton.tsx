import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "./Icon";
import { getInspector, subscribeInspector, toggleOverview } from "./inspector-store";
import { colors, MIN_TOUCH, radius, space } from "./theme";

/** The dashboard header's "NASA data" button (#165): opens or closes the NASA data panel. */
export function NasaDataButton() {
  const open = useSyncExternalStore(subscribeInspector, getInspector, getInspector) !== null;
  return (
    <Pressable
      onPress={toggleOverview}
      accessibilityRole="button"
      accessibilityLabel={open ? "Close the NASA data panel" : "Open the NASA data panel"}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.pill, open && styles.open, pressed && styles.pressed]}
    >
      <Icon name="info" size={18} color={open ? colors.surface : colors.green} />
      <Text style={[styles.label, open && styles.labelOpen]}>NASA data</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.surface,
  },
  open: { backgroundColor: colors.green },
  pressed: { opacity: 0.85 },
  label: { fontSize: 15, fontWeight: "700", color: colors.green },
  labelOpen: { color: colors.surface },
});
