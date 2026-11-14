import { Pressable, StyleSheet, Text, View } from "react-native";

import { SOURCES, type SourceKey } from "../content/sources";
import { openInspector } from "./inspector-store";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// A dataset name. A NASA one can be clicked to open the inspector panel: which NASA
// source it is, what the app takes from it, how it is used and the formulas.

export function SourceChip({ k, period = "" }: { k: SourceKey; period?: string }) {
  const s = SOURCES[k];
  // Only NASA data opens the inspector; other sources are plain labels (their formulas are
  // listed under the NASA data they work on).
  if (!s.nasa) {
    return (
      <View style={styles.chip}>
        <Text style={styles.label} numberOfLines={1}>
          {s.name}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => openInspector(k, period)}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}: how this NASA data is used`}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.chip, styles.nasa, (pressed || hovered) && styles.active]}
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
