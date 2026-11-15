import { createContext, useContext } from "react";
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
      hitSlop={8}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.chip, styles.nasa, (pressed || hovered) && styles.active]}
    >
      <Text style={[styles.label, s.nasa && styles.nasaLabel]} numberOfLines={1}>
        {s.name}
      </Text>
    </Pressable>
  );
}

/**
 * True on the sample farm: its climate numbers are built from NASA POWER daily values, so a
 * card's "NASA POWER, monthly" chip shows as "NASA POWER, daily" there.
 */
export const DemoDataContext = createContext(false);

/**
 * The NASA satellite and model datasets this lot's results were checked against (D35): bundled for
 * the sample farm, fetched through our server for a drawn lot. Shown as a second row under a card's
 * NASA POWER chip, so every card says which NASA data stands behind it. They do not change scores.
 */
export const CheckedAgainstContext = createContext<readonly SourceKey[]>([]);

/** The NASA datasets a card uses, as clickable chips. Non-NASA sources are left out (they open nothing). */
export function SourceChips({ keys, period = "" }: { keys: readonly SourceKey[]; period?: string }) {
  const demo = useContext(DemoDataContext);
  const checked = useContext(CheckedAgainstContext);
  const nasa = [...new Set(keys.map((k) => (demo && k === "power" ? "power-daily" : k)))].filter((k) => SOURCES[k].nasa);
  if (nasa.length === 0) return null;
  const usesPower = nasa.some((k) => k === "power" || k === "power-daily");
  const extra = usesPower ? checked.filter((k) => !nasa.includes(k)) : [];
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityLabel="NASA data used">
        {nasa.map((k) => (
          <SourceChip key={k} k={k} period={period} />
        ))}
      </View>
      {extra.length > 0 ? (
        <View style={styles.row} accessibilityLabel="Checked against other NASA data">
          <Text style={[text.caption, styles.muted]}>Checked against</Text>
          {extra.map((k) => (
            <SourceChip key={k} k={k} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
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
