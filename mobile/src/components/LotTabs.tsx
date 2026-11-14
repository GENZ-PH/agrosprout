import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { Lot } from "../types";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

type Props = {
  lots: readonly Pick<Lot, "id" | "name">[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Shows a "+" tab after the lots (S3, D32). */
  onAdd?: () => void;
  /** Lets the farmer name the open lot ("Riverside paddy"): a pencil on its tab opens a field. */
  onRename?: (id: string, name: string) => void;
};

/** Same limit as naming a lot on the map (S1) and in Edit farm. */
const MAX_NAME = 40;

/**
 * One tab per lot, for the per-lot screens (S3, S4, S5): a tab bar with the open lot underlined,
 * then a "+" tab to add a lot. Scrolls sideways when the names don't fit. On the open lot, a
 * pencil lets the farmer give it their own name, so results read "Our suggestion for Riverside paddy".
 */
export function LotTabs({ lots, selectedId, onSelect, onAdd, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const current = lots.find((l) => l.id === selectedId);

  const startRename = () => {
    setDraft(current?.name ?? "");
    setEditing(true);
  };
  const save = () => {
    if (current && onRename && draft.trim()) onRename(current.id, draft.trim());
    setEditing(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
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
                onPress={() => (selected && onRename ? startRename() : (setEditing(false), onSelect(l.id)))}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityHint={selected && onRename ? "Tap to name this lot" : undefined}
                style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && styles.pressed]}
              >
                <Text style={[text.bodyStrong, selected ? styles.selectedLabel : styles.label]} numberOfLines={1}>
                  {l.name}
                </Text>
                {selected && onRename ? <Icon name="pencil" size={16} color={colors.green} /> : null}
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
              <Icon name="plus" size={22} color={colors.green} />
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {editing && current ? (
        <View style={styles.edit}>
          <Text style={text.bodyStrong}>Name this lot</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={save}
            autoFocus
            maxLength={MAX_NAME}
            returnKeyType="done"
            accessibilityLabel="Lot name"
            placeholder="e.g. Riverside paddy"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.editRow}>
            <Button label="Save" icon="check" disabled={!draft.trim()} onPress={save} style={styles.flex} />
            <Button label="Cancel" variant="quiet" onPress={() => setEditing(false)} style={styles.flex} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  bar: { borderBottomWidth: 1, borderBottomColor: colors.border },
  scroll: { flexGrow: 0 },
  row: { gap: space.xs },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: space.md,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  selected: { borderBottomColor: colors.green },
  pressed: { backgroundColor: colors.pressed },
  label: { color: colors.muted },
  selectedLabel: { color: colors.green },
  add: { minWidth: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
  edit: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.ink,
  },
  editRow: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
