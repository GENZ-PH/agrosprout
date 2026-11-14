import { StyleSheet, Text, View } from "react-native";

import type { CropFit, FitLevel } from "../engine/cropFit";
import type { Crop } from "../types";
import { shortCropName } from "./field-year-core";
import { FIT_LABEL, fitReasonText } from "./plan-text";
import { colors, radius, space, text } from "./theme";

type Props = { fits: readonly CropFit[]; cropById: (id: string) => Crop | undefined };

const TONE: Record<FitLevel, { bg: string; fg: string }> = {
  good: { bg: colors.greenTint, fg: colors.green },
  watch: { bg: colors.amberTint, fg: colors.amber },
  poor: { bg: "#F6E1DE", fg: colors.danger },
  unknown: { bg: colors.bg, fg: colors.muted },
};

/** "Your crops here": how each crop the farmer grows fits this lot's rain and temperature. */
export function CropFitList({ fits, cropById }: Props) {
  return (
    <View style={styles.card}>
      <Text style={text.heading} accessibilityRole="header">
        Your crops on this lot
      </Text>
      {fits.map((f) => {
        const crop = cropById(f.crop_id);
        const tone = TONE[f.level];
        return (
          <View key={f.crop_id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={text.bodyStrong}>
                {shortCropName(crop, f.crop_id)}
                {crop?.local_name ? <Text style={styles.local}>{`  ${crop.local_name}`}</Text> : null}
              </Text>
              <Text style={[styles.pill, { backgroundColor: tone.bg, color: tone.fg }]}>{FIT_LABEL[f.level]}</Text>
            </View>
            {f.reasons.length === 0 && f.level === "good" ? (
              <Text style={text.small}>Rain and temperature suit it in a typical year and in a dry year.</Text>
            ) : (
              f.reasons.map((r, i) => (
                <Text key={i} style={text.small}>
                  {fitReasonText(r)}
                </Text>
              ))
            )}
            {f.assumed_calendar ? <Text style={text.caption}>Based on typical planting months. Add your own months to refine it.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  row: { gap: 4, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  local: { ...text.small, color: colors.muted, fontWeight: "400" },
  pill: { ...text.caption, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
});
