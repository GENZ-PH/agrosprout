import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

export type Choice<T extends string> = { value: T; label: string; hint?: string };

type Props<T extends string> = {
  title: string;
  hint?: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/**
 * One question with single-choice rows (a radio group). Same look as the lot-details questions:
 * the chosen row shows a check in a filled ring, so the state is not shown by colour alone.
 * It keeps no state: the screen passes `value` and saves what `onChange` returns.
 */
export function ChoiceGroup<T extends string>({ title, hint, options, value, onChange, disabled = false }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.group}>
      <Text style={text.bodyStrong} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={text.caption}>{hint}</Text> : null}
      <View style={styles.options}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={o.hint ? `${o.label}. ${o.hint}` : o.label}
              accessibilityState={{ checked: selected, selected, disabled }}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !selected && styles.optionPressed]}
            >
              <View style={[styles.ring, selected && styles.ringSelected]}>
                {selected ? <Icon name="check" size={16} color={colors.white} /> : null}
              </View>
              <View style={styles.labels}>
                <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
                {o.hint ? <Text style={text.caption}>{o.hint}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  options: { gap: space.sm, marginTop: space.xs },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TOUCH + 4,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
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
  ringSelected: { backgroundColor: colors.green, borderColor: colors.green },
  labels: { flex: 1 },
  label: { ...text.body },
  labelSelected: { fontWeight: "600" },
});
