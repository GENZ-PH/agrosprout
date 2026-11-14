import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { areaLabel, type LotRowData } from "../lots/lot-editor";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

type Props = {
  lot: LotRowData;
  /** Live area while a corner is being dragged, shown instead of the saved one. */
  editingAreaHa?: number;
  onPlot: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

/** One lot under the S1 map: plot or redraw, rename in place, delete with a confirm step. */
export function LotRow({ lot, editingAreaHa, onPlot, onRename, onDelete }: Props) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const plotted = lot.area_ha !== null;
  const [draftName, setDraftName] = useState(lot.name);

  if (mode === "rename") {
    const save = () => {
      onRename(draftName);
      setMode("view");
    };
    return (
      <View style={[styles.card, styles.column]}>
        <Text style={text.small}>New name for {lot.name}</Text>
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          onSubmitEditing={save}
          autoFocus
          maxLength={40}
          returnKeyType="done"
          accessibilityLabel={`New name for ${lot.name}`}
          placeholder="e.g. Riverside paddy"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <View style={styles.actions}>
          <Button label="Save" onPress={save} disabled={!draftName.trim()} style={styles.flex} />
          <Button
            label="Cancel"
            variant="quiet"
            onPress={() => {
              setDraftName(lot.name);
              setMode("view");
            }}
            style={styles.flex}
          />
        </View>
      </View>
    );
  }

  if (mode === "delete") {
    return (
      <View style={[styles.card, styles.column]}>
        <Text style={text.bodyStrong}>Delete {lot.name}?</Text>
        <View style={styles.actions}>
          <Button label="Delete" variant="danger" onPress={onDelete} style={styles.flex} />
          <Button label="Keep it" variant="quiet" onPress={() => setMode("view")} style={styles.flex} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.row]}>
      <View style={styles.info}>
        <Text style={text.bodyStrong}>{lot.name}</Text>
        <Text style={[text.small, { color: colors.muted }]}>
          {editingAreaHa !== undefined ? `${editingAreaHa.toFixed(2)} ha` : areaLabel(lot)}
        </Text>
      </View>
      <Pressable
        onPress={onPlot}
        accessibilityRole="button"
        accessibilityLabel={`${plotted ? "Redraw" : "Draw"} ${lot.name}`}
        style={({ pressed }) => [
          styles.textButton,
          { backgroundColor: plotted ? colors.pressed : colors.greenTint },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.textButtonLabel, { color: plotted ? colors.ink : colors.green }]}>
          {plotted ? "Redraw" : "Draw"}
        </Text>
      </Pressable>
      <IconButton
        icon="pencil"
        label={`Rename ${lot.name}`}
        onPress={() => {
          setDraftName(lot.name);
          setMode("rename");
        }}
      />
      <IconButton icon="trash" label={`Delete ${lot.name}`} color={colors.danger} onPress={() => setMode("delete")} />
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  color = colors.ink,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6, paddingLeft: 14 },
  column: { gap: space.sm, padding: space.md },
  info: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
  input: {
    ...text.body,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
  textButton: {
    minWidth: 72,
    height: MIN_TOUCH,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  textButtonLabel: { fontSize: 15, fontWeight: "600" },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.border },
});
