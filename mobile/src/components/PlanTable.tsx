import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { OptionKey, RotationOption } from "../engine/rotations";
import { useT } from "../i18n/lang-store";
import { PLAN_COLOR, planName } from "./field-year-core";
import { planFacts } from "./plan-facts";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// The plans side by side as field facts a farmer can check on the land: days the field is
// empty, months short of water, months too hot or too wet, crop families, days with
// soil-feeding crops, and the overall score last. One column per plan; tap a column to open it.

import { type InfoRef, useExplainer } from "./InfoToggle";

type Props = {
  info?: InfoRef;
  options: readonly RotationOption[];
  selected: OptionKey;
  onSelect: (key: OptionKey) => void;
};

export function PlanTable({ options, selected, onSelect, info }: Props) {
  const { t } = useT();
  const ex = useExplainer(info, t("table.title"));
  const rows = planFacts(options);
  // On a phone the columns are too narrow for names: the letters match the calendar above.
  const narrow = useWindowDimensions().width < 560;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={text.heading} accessibilityRole="header">
          {t("table.title")}
        </Text>
        <Text style={[text.caption, styles.flexHint]}>{t("table.hint")}</Text>
        {ex.button}
      </View>
      {ex.box}

      <View style={styles.row}>
        <View style={[styles.label, narrow && styles.labelNarrow]} />
        {options.map((o) => {
          const on = o.key === selected;
          return (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t("plan.label", { key: o.key })}, ${planName(o.kind, t)}`}
              style={({ pressed }) => [styles.cell, styles.head, on && styles.colOn, on && styles.colTop, pressed && !on && styles.pressed]}
            >
              <View style={[styles.key, { backgroundColor: PLAN_COLOR[o.key] ?? colors.ink }]}>
                <Text style={styles.keyText}>{o.key}</Text>
              </View>
              {narrow ? null : (
                <Text style={styles.headName} numberOfLines={2}>
                  {planName(o.kind, t)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {rows.map((r, ri) => (
        <View key={r.key} style={[styles.row, styles.rule, r.key === "score" && styles.scoreRow]}>
          <Text style={[styles.label, narrow && styles.labelNarrow, text.small]}>{t(`table.${r.key}`)}</Text>
          {options.map((o, i) => (
            <View key={o.key} style={[styles.cell, o.key === selected && styles.colOn, o.key === selected && ri === rows.length - 1 && styles.colBottom]}>
              <Text style={[styles.value, r.best[i] && styles.best]}>{r.values[i] === null ? "?" : r.values[i]}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flexHint: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: space.lg, rowGap: 2, paddingBottom: space.sm },
  row: { flexDirection: "row", alignItems: "stretch" },
  rule: { borderTopWidth: 1, borderTopColor: colors.border },
  scoreRow: { borderTopColor: colors.borderStrong },
  label: { flex: 1.6, minWidth: 0, paddingVertical: 10, paddingRight: space.sm },
  labelNarrow: { flex: 2.4 },
  cell: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 2 },
  head: { minHeight: MIN_TOUCH, gap: 4, justifyContent: "flex-start" },
  headName: { ...text.caption, textAlign: "center", color: colors.ink },
  colOn: { backgroundColor: "#F1F6EF" },
  colTop: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  colBottom: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  pressed: { backgroundColor: colors.pressed },
  key: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 14, fontWeight: "700", color: colors.white },
  value: { ...text.body, fontVariant: ["tabular-nums"] },
  best: { color: colors.green, fontWeight: "700" },
});
