import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, MIN_TOUCH, radius, space, text } from "./theme";

/** Two big tabs: the farmer's answer, and the evidence behind it. */
export function ViewSwitch<K extends string>({ items, value, onChange }: { items: readonly { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.tab, on && styles.on, pressed && !on && styles.pressed]}
          >
            <Text style={[text.bodyStrong, on && styles.onText]} numberOfLines={2}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: MIN_TOUCH + 4, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, borderRadius: radius.md },
  on: { backgroundColor: colors.green },
  onText: { color: colors.white, textAlign: "center" },
  pressed: { backgroundColor: colors.pressed },
});
