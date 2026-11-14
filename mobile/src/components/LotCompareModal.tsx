import { type ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon } from "./Icon";
import { LotCutoutCard } from "./LotCutoutCard";
import { colors, MIN_TOUCH, radius, space } from "./theme";
import { useLayout } from "./useLayout";

// The lot comparison card (#171) in a dialog: it opens when the farmer taps a lot on the farm map
// (or the "Compare" button under it). Phones get a sheet from the bottom, like the source
// inspector; a laptop window gets a centred dialog. Tapping outside, the close button, the Android
// back button and Escape on web all close it.

type Props = ComponentProps<typeof LotCutoutCard> & { onClose: () => void };

/** Widest the dialog gets on a laptop window: room for the two shapes side by side. A layout choice. */
const DIALOG_MAX_WIDTH = 960;

export function LotCompareModal({ onClose, ...card }: Props) {
  const { wide } = useLayout();
  return (
    <Modal transparent visible animationType={wide ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={[styles.root, wide ? styles.rootCentre : styles.rootBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close the lot comparison" />
        <View
          style={[styles.panel, wide ? styles.dialog : styles.sheet]}
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={`${card.lot.name}: lot comparison`}
        >
          <View style={styles.bar}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close the lot comparison"
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Icon name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <LotCutoutCard {...card} flat />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  rootCentre: { alignItems: "center", justifyContent: "center", padding: space.xl },
  rootBottom: { justifyContent: "flex-end" },
  panel: { backgroundColor: colors.surface, overflow: "hidden" },
  dialog: { width: "100%", maxWidth: DIALOG_MAX_WIDTH, maxHeight: "92%", borderRadius: radius.lg },
  sheet: { maxHeight: "90%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  pressed: { backgroundColor: colors.pressed },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: space.lg },
});
