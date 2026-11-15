import { useSyncExternalStore } from "react";
import { tr } from "../i18n/lang-store";
import { Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "./Icon";
import { getInspector, subscribeInspector, toggleOverview } from "./inspector-store";
import { colors, radius, space } from "./theme";

/** The dashboard header's "Technical data" button (#165): opens or closes the panel (renamed 2026-11-15). */
export function NasaDataButton() {
  const open = useSyncExternalStore(subscribeInspector, getInspector, getInspector) !== null;
  return (
    <Pressable
      onPress={toggleOverview}
      accessibilityRole="button"
      accessibilityLabel={open ? "Close the technical data panel" : "Open the technical data panel"}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.pill, open && styles.open, pressed && styles.pressed]}
    >
      <Icon name="info" size={16} color={open ? colors.surface : colors.green} />
      <Text style={[styles.label, open && styles.labelOpen]}>{tr("Technical data")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.surface,
  },
  open: { backgroundColor: colors.green },
  pressed: { opacity: 0.85 },
  label: { fontSize: 14, fontWeight: "700", color: colors.green },
  labelOpen: { color: colors.surface },
});
