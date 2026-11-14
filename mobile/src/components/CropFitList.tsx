import { StyleSheet, Text, View } from "react-native";

import type { CropFit, FitLevel } from "../engine/cropFit";
import type { Crop } from "../types";
import { useT } from "../i18n/lang-store";
import { cropLabel } from "../i18n/strings";
import { shortCropName } from "./field-year-core";
import { fitReasonText } from "./plan-text";
import { type InfoRef, useExplainer } from "./InfoToggle";
import { colors, radius, space, text } from "./theme";

type Props = { fits: readonly CropFit[]; cropById: (id: string) => Crop | undefined; info?: InfoRef };

const TONE: Record<FitLevel, { bg: string; fg: string }> = {
  good: { bg: colors.greenTint, fg: colors.green },
  watch: { bg: colors.amberTint, fg: colors.amber },
  poor: { bg: "#F6E1DE", fg: colors.danger },
  unknown: { bg: colors.bg, fg: colors.muted },
};

/** "Your crops here": how each crop the farmer grows fits this lot's rain and temperature. */
export function CropFitList({ fits, cropById, info }: Props) {
  const { t, lang, months } = useT();
  const ex = useExplainer(info, t("fit.title"));
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[text.heading, styles.titleText]} accessibilityRole="header">
          {t("fit.title")}
        </Text>
        {ex.button}
      </View>
      {ex.box}
      {fits.map((f) => {
        const crop = cropById(f.crop_id);
        const tone = TONE[f.level];
        const name = cropLabel(lang, crop, f.crop_id);
        // The other name next to it: the local one in English, the English one otherwise.
        const other = lang === "en" ? crop?.local_name : shortCropName(crop, f.crop_id);
        return (
          <View key={f.crop_id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={text.bodyStrong}>
                {name}
                {other && other !== name ? <Text style={styles.local}>{`  ${other}`}</Text> : null}
              </Text>
              <Text style={[styles.pill, { backgroundColor: tone.bg, color: tone.fg }]}>{t(`fit.${f.level}`)}</Text>
            </View>
            {f.reasons.length === 0 && f.level === "good" ? (
              <Text style={text.small}>{t("fit.ok")}</Text>
            ) : (
              f.reasons.map((r, i) => (
                <Text key={i} style={text.small}>
                  {fitReasonText(r, t, months)}
                </Text>
              ))
            )}
            {f.assumed_calendar ? <Text style={text.caption}>{t("fit.assumed")}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  titleText: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  row: { gap: 4, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  local: { ...text.small, color: colors.muted, fontWeight: "400" },
  pill: { ...text.caption, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
});
