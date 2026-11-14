import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LotDetails } from "../types";
import { Icon } from "./Icon";
import { detailValue, LOT_DETAILS_INTRO, LOT_DETAIL_QUESTIONS, setDetail } from "./lot-details-options";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

type Props = {
  /** The lot's current answers. A new lot has "unknown" for all of them. */
  value: LotDetails;
  /** Called with the full new details each time one answer changes. */
  onChange: (next: LotDetails) => void;
  /** Hides the intro line, e.g. when the screen already explains it. */
  hideIntro?: boolean;
  disabled?: boolean;
};

/**
 * The optional "Lot details" questions (#41): land type, water source, soil feel and equipment. Each is a
 * group of single-choice rows with "I don't know" last and selected by default. It keeps no state
 * of its own: the screen passes `value` and saves what `onChange` returns (`updateLot(id, { details })`).
 */
export function LotDetailsForm({ value, onChange, hideIntro = false, disabled = false }: Props) {
  return (
    <View style={styles.form}>
      {hideIntro ? null : <Text style={text.caption}>{LOT_DETAILS_INTRO}</Text>}
      {LOT_DETAIL_QUESTIONS.map((q) => (
        <View key={q.key} accessibilityRole="radiogroup" accessibilityLabel={q.title} style={styles.group}>
          <Text style={text.bodyStrong} accessibilityRole="header">
            {q.title}
          </Text>
          <Text style={text.caption}>{q.hint}</Text>
          <View style={styles.options}>
            {q.options.map((o) => {
              const selected = detailValue(value, q.key) === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => onChange(setDetail(value, q.key, o.value))}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityLabel={o.label}
                  accessibilityState={{ checked: selected, selected, disabled }}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && !selected && styles.optionPressed,
                  ]}
                >
                  {/* A ring, filled with a check when chosen: the state is not shown by colour alone. */}
                  <View style={[styles.ring, selected && styles.ringSelected]}>
                    {selected ? <Icon name="check" size={16} color={colors.white} /> : null}
                  </View>
                  <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  group: { gap: space.sm },
  options: { gap: space.sm, marginTop: space.xs },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.green, backgroundColor: colors.greenTint },
  optionPressed: { backgroundColor: colors.pressed },
  ring: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.dashed,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSelected: { borderColor: colors.green, backgroundColor: colors.green },
  label: { ...text.body, flex: 1 },
  labelSelected: { fontWeight: "700", color: colors.ink },
});
