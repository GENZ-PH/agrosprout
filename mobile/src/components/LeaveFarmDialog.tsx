import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useFarmStore } from "../state/farm-store";
import { Button } from "./Button";
import { colors, radius, space, text } from "./theme";

// Back on the dashboard (2026-11-15): the welcome screen sends a farmer with crops straight back to
// the dashboard, so a plain Back did nothing. This asks what they want: change the farm, or start
// over from the welcome screen (clears the farm saved on this phone).

export function LeaveFarmDialog({ open, onClose, sample }: { open: boolean; onClose: () => void; sample: boolean }) {
  if (!open) return null;
  const startOver = () => {
    useFarmStore.getState().clearAll();
    onClose();
    router.replace("/");
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={text.heading} accessibilityRole="header">
            Leave your farm?
          </Text>
          <Text style={text.small}>
            {sample
              ? "Start over goes back to the start screen and closes the sample farm."
              : "Start over goes back to the start screen and deletes the lots, crops and places saved on this phone. This cannot be undone."}
          </Text>
          <Button
            label="Edit farm"
            variant="secondary"
            onPress={() => {
              onClose();
              router.push("/edit-farm");
            }}
          />
          <Button label="Start over" onPress={startOver} />
          <Button label="Stay here" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  dialog: { width: "100%", maxWidth: 420, gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
});
