import { StyleSheet, Text, View } from "react-native";

import type { CropFit, FitLevel } from "../engine";
import { FIT_COLORS } from "./farm-map-core";
import { CropImage } from "./CropImage";
import { Bullets, InfoCard } from "./InfoCard";
import { FIT_LABELS, fitReasonText, fitSeasonsText, GOOD_FIT_TEXT, shortCropName } from "./recommendations-core";
import { colors, radius, space, text } from "./theme";

// "Your crops here" (#29, docs/11-user-flow.md S3): each crop the farmer picked for the lot as
// Good fit / Watch out / Poor fit, with its one or two main reasons from the engine (cropFit.ts).

type Props = {
  /** `analysis.crop_fits`: one per crop the farmer chose, in their order. */
  fits: readonly CropFit[];
  cropName: (id: string) => string;
  period: string;
};

/**
 * Badge colors: tint + dark text, each pair contrast-checked in theme.ts. The word is the cue.
 * The text color is the level's FIT_COLORS, which the dashboard's farm map (#124) fills lots with.
 */
const BADGE: Record<FitLevel, { bg: string; fg: string; border: string }> = {
  good: { bg: colors.greenTint, fg: FIT_COLORS.good, border: colors.greenTint },
  watch: { bg: colors.amberTint, fg: FIT_COLORS.watch, border: colors.amberTint },
  poor: { bg: colors.surface, fg: FIT_COLORS.poor, border: colors.danger },
  unknown: { bg: colors.disabledBg, fg: FIT_COLORS.unknown, border: colors.disabledBg },
};

export function CropFitCard({ fits, cropName, period }: Props) {
  return (
    <InfoCard title="Your crops here" explainer="your-crops" period={period} subtitle="How well this lot suits each crop you grow.">
      <View style={styles.list}>
        {fits.map((fit, i) => {
          const name = shortCropName(cropName(fit.crop_id));
          const seasons = fitSeasonsText(fit);
          const reasons = fit.reasons.length > 0 ? fit.reasons.map(fitReasonText) : fit.level === "good" ? [GOOD_FIT_TEXT] : [];
          return (
            <View key={`${fit.crop_id}-${i}`} style={[styles.crop, i > 0 && styles.divider]}>
              <View style={styles.row}>
                <CropImage cropId={fit.crop_id} size={40} />
                <Text style={[text.bodyStrong, styles.flex]}>{name}</Text>
                <FitBadge level={fit.level} />
              </View>
              <Bullets lines={reasons} />
              {seasons ? <Text style={text.caption}>{seasons}</Text> : null}
            </View>
          );
        })}
      </View>
    </InfoCard>
  );
}

/** Good fit / Watch out / Poor fit / Not sure yet, in the level's colors. Also used by S2's top 3. */
export function FitBadge({ level }: { level: FitLevel }) {
  const b = BADGE[level];
  return (
    <View style={[styles.badge, { backgroundColor: b.bg, borderColor: b.border }]}>
      <Text style={[styles.badgeText, { color: b.fg }]}>{FIT_LABELS[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  crop: { gap: space.xs },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  badge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: 3 },
  badgeText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
});
