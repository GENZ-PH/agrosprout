import { Pressable, StyleSheet, Text, View } from "react-native";

import type { OptionKey, RotationOption } from "../engine/rotations";
import { useT } from "../i18n/lang-store";
import { cropLabel } from "../i18n/strings";
import type { Crop } from "../types";
import { PLAN_COLOR, planName } from "./field-year-core";
import { cropListText } from "./plan-text";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// Every option for the lot as one tappable row named by its crops, so a farmer picks by what
// gets planted, not by a letter. The best match carries a badge; the score stays small.

import { type InfoRef, useExplainer } from "./InfoToggle";

type Props = {
  info?: InfoRef;
  options: readonly RotationOption[];
  selected: OptionKey;
  onSelect: (key: OptionKey) => void;
  cropById: (id: string) => Crop | undefined;
};

export function PlanOptions({ options, selected, onSelect, cropById, info }: Props) {
  const { t, lang } = useT();
  const ex = useExplainer(info, t("options.title"));
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Text style={[text.heading, styles.flex]} accessibilityRole="header">
            {t("options.title")}
          </Text>
          {ex.button}
        </View>
        <Text style={text.caption}>{t("options.hint")}</Text>
      </View>
      {ex.box}
      {options.map((o) => {
        const on = o.key === selected;
        const crops = cropListText(o.slots.map((s) => cropLabel(lang, cropById(s.crop_id), s.crop_id)));
        return (
          <Pressable
            key={o.key}
            onPress={() => onSelect(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${planName(o.kind, t)}: ${crops}`}
            style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && !on && styles.pressed]}
          >
            <View style={[styles.key, { backgroundColor: PLAN_COLOR[o.key] ?? colors.ink }]}>
              <Text style={styles.keyText}>{o.key}</Text>
            </View>
            <View style={styles.text}>
              <Text style={text.bodyStrong}>{crops}</Text>
              <Text style={text.small}>{planName(o.kind, t)}</Text>
            </View>
            {o.top_total ? <Text style={styles.badge}>{t("plan.best")}</Text> : null}
            <Text style={styles.score}>{o.total === null ? "?" : Math.round(o.total)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  wrap: { gap: space.sm },
  head: { gap: 2 },
  row: {
    minHeight: MIN_TOUCH + 12,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowOn: { borderColor: colors.green, backgroundColor: "#F1F6EF" },
  pressed: { backgroundColor: colors.pressed },
  key: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 14, fontWeight: "700", color: colors.white },
  text: { flex: 1, minWidth: 0, gap: 2 },
  badge: { ...text.caption, color: colors.green, fontWeight: "700", backgroundColor: colors.greenTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  score: { ...text.bodyStrong, minWidth: 28, textAlign: "right", color: colors.muted, fontVariant: ["tabular-nums"] },
});
