import { Pressable, StyleSheet, Text, View } from "react-native";

import { SOURCES, type SourceKey } from "../content/sources";
import { openInspector } from "./inspector-store";
import { useLayout } from "./useLayout";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// A dataset name you can hover (on a wide screen) or tap to open the inspector panel: which NASA
// source it is, what the app takes from it, how it is used and the formulas.

export function SourceChip({ k, period = "" }: { k: SourceKey; period?: string }) {
  const { wide } = useLayout();
  const s = SOURCES[k];
  return (
    <Pressable
      onPress={() => openInspector(k, period)}
      onHoverIn={wide ? () => openInspector(k, period) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}: how this data is used`}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.chip, s.nasa && styles.nasa, (pressed || hovered) && styles.active]}
    >
      <Text style={[styles.label, s.nasa && styles.nasaLabel]} numberOfLines={1}>
        {s.name}
      </Text>
    </Pressable>
  );
}

/** A row of source chips, for a card's "Sources" line. */
export function SourceChips({ keys, period = "" }: { keys: readonly SourceKey[]; period?: string }) {
  if (keys.length === 0) return null;
  return (
    <View style={styles.row} accessibilityLabel="Sources">
      <Text style={[text.caption, styles.muted]}>Sources</Text>
      {keys.map((k) => (
        <SourceChip key={k} k={k} period={period} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  muted: { color: colors.muted, marginRight: 2 },
  chip: {
    minHeight: Math.min(MIN_TOUCH, 30),
    justifyContent: "center",
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  nasa: { borderColor: colors.green, backgroundColor: colors.greenTint },
  active: { borderColor: colors.ink },
  label: { ...text.caption, fontWeight: "700", color: colors.ink },
  nasaLabel: { color: colors.green },
});
