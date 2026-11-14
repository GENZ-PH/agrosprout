import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { cropById } from "../data/crops";
import { cropShortName } from "../lots/crop-picks";
import { goodMonthsText, topCropReason, type CropSuggestion } from "../lots/suggest-core";
import { CropImage } from "./CropImage";
import { FitBadge } from "./CropFitCard";
import { Icon } from "./Icon";
import { ExplainerBox } from "./InfoCard";
import { FIT_LABELS } from "./recommendations-core";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// S2 "Top 3 for this lot" (#152): the library crops that suit the lot best on its NASA data, best first.
// One crop per lot (D13): the rows are one radio group; tapping a row makes that crop the lot's crop.

type Props = {
  lotName: string;
  /** `topCrops(lotSuggestions(...))`, best first. */
  top: readonly CropSuggestion[];
  /** The years of the lot's data, for the ⓘ text. */
  period: string;
  /** The lot's crop, or null when it has none, or several (a farm saved before D13 changed). */
  chosen: string | null;
  onChoose: (cropId: string) => void;
};

export const TOP_CROPS_CAPTION =
  "From NASA rain, temperature and soil wetness at this lot. A guide, not a rule: check with your agricultural technician.";

export function TopCrops({ lotName, top, period, chosen, onChoose }: Props) {
  const [info, setInfo] = useState(false);
  if (top.length === 0) return null;
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={[text.bodyStrong, styles.flex]} accessibilityRole="header">
          Top {top.length} for this lot
        </Text>
        <Pressable
          onPress={() => setInfo((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`What am I looking at? About the top ${top.length} crops for ${lotName}`}
          accessibilityState={{ expanded: info }}
          aria-expanded={info}
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <Icon name="info" size={22} color={colors.green} />
        </Pressable>
      </View>
      {info ? <ExplainerBox id="top-crops" period={period} /> : null}
      <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={`Top ${top.length} crops for ${lotName}`}>
        {top.map((s, i) => (
          <TopRow key={s.crop_id} rank={i + 1} s={s} selected={s.crop_id === chosen} onPress={() => onChoose(s.crop_id)} />
        ))}
      </View>
      <Text style={text.caption}>{TOP_CROPS_CAPTION}</Text>
    </View>
  );
}

function TopRow({ rank, s, selected, onPress }: { rank: number; s: CropSuggestion; selected: boolean; onPress: () => void }) {
  const crop = cropById(s.crop_id);
  const name = crop ? cropShortName(crop) : s.crop_id;
  const local = crop?.local_name ?? null;
  const when = `if planted in ${goodMonthsText(s.best_months)}`;
  const reason = topCropReason(s);
  const label = [`${rank}. ${name}${local ? `, ${local}` : ""}.`, `${FIT_LABELS[s.level]} ${when}.`, reason].filter(Boolean).join(" ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      // React Native Web drops accessibilityState.checked; aria-checked reaches the DOM.
      aria-checked={selected}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && styles.pressed]}
    >
      <CropImage cropId={s.crop_id} />
      <View style={[styles.flex, styles.body]}>
        <Text style={text.bodyStrong}>
          <Text style={{ color: colors.muted }}>{rank}. </Text>
          {name}
          {local ? <Text style={[text.body, { color: colors.muted }]}> · {local}</Text> : null}
        </Text>
        {/* Read together: "Good fit if planted in Mar–Sep". */}
        <View style={styles.fitLine}>
          <FitBadge level={s.level} />
          <Text style={[text.small, styles.shrink]}>{when}</Text>
        </View>
        {reason ? <Text style={text.caption}>{reason}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.dot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  block: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  info: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  list: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  // White, not the green tint: the Good fit badge is green tint and would disappear into the row.
  rowOn: { borderColor: colors.green, borderWidth: 2 },
  pressed: { backgroundColor: colors.pressed },
  body: { gap: space.xs },
  fitLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.sm, rowGap: space.xs },
  radio: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  radioOn: { borderColor: colors.green },
  dot: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.green },
});
