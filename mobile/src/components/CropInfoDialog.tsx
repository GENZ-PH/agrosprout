import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Crop } from "../types";
import { Button } from "./Button";
import { lacksData, missing, rows, UNKNOWN } from "./crop-facts";
import { CropImage } from "./CropImage";
import { Icon } from "./Icon";
import { section } from "./panel-si";
import { SectionSI } from "./SectionSI";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// A crop's card on the dashboard (2026-11-15): tap a crop picture in the suggestion to see its
// characteristics, what is not known yet, and a short SI note on what it means for this lot. The
// SI gets only the crop's library values and its months in the plan (no location, no names).

export function CropInfoDialog({
  crop,
  planLine,
  lotName,
  whatIf,
  onClose,
}: {
  crop: Crop | null;
  /** What the plan does with this crop, e.g. "In the suggested plan: plant in Apr, harvest in Jun." */
  planLine: string;
  lotName: string;
  whatIf: boolean;
  onClose: () => void;
}) {
  if (!crop) return null;
  const facts = rows(crop);
  const gaps = missing(crop);
  const siSections = [
    section(
      `crop-${crop.id}`,
      `What to know about ${crop.name} on this lot`,
      [
        planLine,
        crop.notes,
        ...facts.filter(([, v]) => v !== UNKNOWN).map(([k, v]) => `${k}: ${v}`),
        gaps.length ? `Not known yet: ${gaps.join(", ")}.` : "",
      ].filter(Boolean),
    ),
  ];
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.head}>
            <CropImage cropId={crop.id} size={56} />
            <View style={styles.flex}>
              <Text style={text.heading} accessibilityRole="header">
                {crop.name}
              </Text>
              <Text style={text.caption}>{[crop.local_name, crop.family].filter(Boolean).join(", ")}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={text.small}>{planLine}</Text>
            <SectionSI sections={siSections} index={0} whatIf={whatIf} />
            {lacksData(crop) ? (
              <View style={styles.warn}>
                <Icon name="alert" size={18} color={colors.amber} />
                <Text style={[text.small, styles.flex]}>
                  {`Some of this crop's data is missing, so results for ${lotName} are less sure: ${gaps.join(", ")}. Ask your agricultural technician.`}
                </Text>
              </View>
            ) : gaps.length ? (
              <Text style={text.caption}>{`Not known yet: ${gaps.join(", ")}.`}</Text>
            ) : null}
            <View style={styles.table}>
              {facts.map(([k, v]) => (
                <View key={k} style={styles.tr}>
                  <Text style={[text.caption, styles.k]}>{k}</Text>
                  <Text style={[text.small, styles.v, v === UNKNOWN && styles.unknown]}>{v}</Text>
                </View>
              ))}
            </View>
            <Button
              label="Sources for every value"
              variant="secondary"
              onPress={() => {
                onClose();
                router.push("/crop-library");
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  dialog: { width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  body: { gap: space.md, padding: space.md },
  flex: { flex: 1, minWidth: 0 },
  warn: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.amberTint },
  table: { borderTopWidth: 1, borderTopColor: colors.border },
  tr: { flexDirection: "row", gap: space.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  k: { flex: 1.2 },
  v: { flex: 1, fontWeight: "600" },
  unknown: { color: colors.muted, fontWeight: "400" },
});
