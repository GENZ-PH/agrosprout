import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { Lot } from "../types";
import { Icon } from "./Icon";
import { colors, radius, space } from "./theme";

type Props = {
  lots: readonly Pick<Lot, "id" | "name">[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Shows a "+" tab after the lots (S3, D32). */
  onAdd?: () => void;
  /** Lets the farmer name the open lot ("Riverside paddy"): tapping its tab edits the name in place. */
  onRename?: (id: string, name: string) => void;
};

/** Same limit as naming a lot on the map (S1) and in Edit farm. */
const MAX_NAME = 40;

/**
 * One tab per lot, for the per-lot screens (S3, S4, S5): a row of chips with the open lot filled
 * green, then an "Add lot" chip. Scrolls sideways when the names don't fit. Tapping the open lot turns
 * its name into a text field right in the tab: Enter or tapping away saves, Escape or an empty name
 * keeps the old one. Results then read "Our suggestion for Riverside paddy".
 */
export function LotTabs({ lots, selectedId, onSelect, onAdd, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Escape fires before blur: this stops the blur from saving what was just cancelled.
  const cancelled = useRef(false);
  const current = lots.find((l) => l.id === selectedId);

  const startRename = () => {
    cancelled.current = false;
    setDraft(current?.name ?? "");
    setEditing(true);
  };
  const finish = () => {
    const name = draft.trim();
    if (!cancelled.current && current && onRename && name && name !== current.name) onRename(current.id, name);
    setEditing(false);
  };

  return (
    <View style={styles.wrap}>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          style={styles.scroll}
          contentContainerStyle={styles.row}
        >
          {lots.map((l) => {
            const selected = l.id === selectedId;
            if (selected && editing) {
              return (
                <View key={l.id} style={[styles.tab, styles.selected]} accessibilityRole="tab" accessibilityState={{ selected }}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={finish}
                    onBlur={finish}
                    onKeyPress={(e) => {
                      if (e.nativeEvent.key === "Escape") {
                        cancelled.current = true;
                        setEditing(false);
                      }
                    }}
                    autoFocus
                    selectTextOnFocus
                    maxLength={MAX_NAME}
                    returnKeyType="done"
                    accessibilityLabel="Lot name"
                    placeholder="Lot name"
                    placeholderTextColor={colors.greenTint}
                    style={[styles.chipText, styles.input]}
                  />
                  <Icon name="check" size={18} color={colors.white} />
                </View>
              );
            }
            return (
              <Pressable
                key={l.id}
                onPress={() => (selected && onRename ? startRename() : onSelect(l.id))}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityHint={selected && onRename ? "Tap to rename this lot" : undefined}
                style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, selected ? styles.selectedLabel : styles.label]} numberOfLines={1}>
                  {l.name}
                </Text>
                {selected && onRename ? <Icon name="pencil" size={14} color={colors.white} /> : null}
              </Pressable>
            );
          })}
          {onAdd ? (
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel="Add a lot"
              style={({ pressed }) => [styles.tab, styles.add, pressed && styles.pressed]}
            >
              <Icon name="plus" size={16} color={colors.green} />
              <Text style={[styles.chipText, styles.addLabel]}>Add lot</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  scroll: { flexGrow: 0 },
  row: { gap: space.sm, paddingVertical: 2 },
  // Chips: the open lot is solid green, the others are white with a clear border, so each lot
  // reads as something to tap (the 2026-11-15 underline tabs were too easy to miss).
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.green, borderColor: colors.green },
  pressed: { backgroundColor: colors.pressed },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  label: { color: colors.ink },
  selectedLabel: { color: colors.white },
  add: { borderStyle: "dashed", borderColor: colors.green, backgroundColor: "transparent" },
  addLabel: { color: colors.green },
  input: {
    minWidth: 120,
    maxWidth: 220,
    paddingVertical: 4,
    paddingHorizontal: 0,
    color: colors.white,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.white,
  },
});
