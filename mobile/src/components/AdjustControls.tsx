import type { ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// Floating controls (#165): everything that changes the results (what matters to you, the
// drier or warmer what-if, planting months, harvest places) sits behind one button that stays on
// screen, instead of at the bottom of a long page. The results update as the farmer taps.

/** The floating button. `summary` = what is changed now ("Save water; what-if: ..."), if anything. */
export function AdjustButton({ onPress, summary }: { onPress: () => void; summary: string | null }) {
  return (
    <View style={styles.floatWrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={summary ? `Adjust results. Now: ${summary}` : "Adjust results"}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Icon name="pencil" size={20} color={colors.surface} />
        <View style={styles.fabText}>
          <Text style={styles.fabLabel}>Adjust results</Text>
          {summary ? (
            <Text style={styles.fabSummary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

/** The sheet with the controls. Children = the control cards; `actions` = links to other screens. */
export function AdjustSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={text.heading} accessibilityRole="header">
                Adjust the results
              </Text>
              <Text style={[text.small, styles.muted]}>The results update as you tap. Close to see them.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Icon name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
          <View style={styles.foot}>
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.done, pressed && styles.fabPressed]}>
              <Text style={styles.doneText}>See the results</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Fixed to the window on web, so it floats while the page scrolls; absolute over the screen on a phone.
  floatWrap: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as "absolute",
    left: 0,
    right: 0,
    bottom: space.lg,
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    maxWidth: 420,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { backgroundColor: colors.greenPressed },
  fabText: { flexShrink: 1 },
  fabLabel: { fontSize: 16, lineHeight: 20, fontWeight: "700", color: colors.surface },
  fabSummary: { fontSize: 13, lineHeight: 17, color: colors.greenTint },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "88%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, padding: space.lg, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: colors.muted },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, marginRight: -space.sm },
  pressed: { backgroundColor: colors.pressed },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: space.lg, gap: space.lg },
  foot: { padding: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  done: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  doneText: { fontSize: 17, fontWeight: "700", color: colors.surface },
});
