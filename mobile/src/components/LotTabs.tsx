import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import type { Lot } from "../types";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

type Props = {
  lots: readonly Pick<Lot, "id" | "name">[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** One tab per lot, for the per-lot screens (S3, S4, S5). Scrolls sideways when the names don't fit. */
export function LotTabs({ lots, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {lots.map((l) => {
        const selected = l.id === selectedId;
        return (
          <Pressable
            key={l.id}
            onPress={() => onSelect(l.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.tab, selected ? styles.selected : pressed && styles.pressed]}
          >
            <Text style={[text.bodyStrong, selected && styles.selectedLabel]} numberOfLines={1}>
              {l.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: space.sm },
  tab: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.green, borderColor: colors.green },
  pressed: { backgroundColor: colors.pressed },
  selectedLabel: { color: colors.white },
});
