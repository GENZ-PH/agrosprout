import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Scenario } from "../engine/scenario";
import { InfoCard } from "./InfoCard";
import { colors, radius, space, text } from "./theme";
import { describeScenario, NO_CHANGE, RAIN_CHOICES, rainLabel, TEMP_CHOICES, tempLabel, toScenario } from "./what-if-core";

// "What if it is drier or warmer?" (#47): two rows of choices. The whole dashboard for the lot
// is worked out again on the phone for the scenario. It is a what-if, never a forecast.

type Props = {
  scenario: Scenario | null;
  onChange: (next: Scenario | null) => void;
  /** Notes from the engine about what changed and what was held fixed (`analysis.scenario.notes`). */
  notes: readonly string[];
  period: string;
};

export function WhatIfCard({ scenario, onChange, notes, period }: Props) {
  const now = scenario ?? NO_CHANGE;
  return (
    <InfoCard
      title="What if it is drier or warmer?"
      explainer="what-if"
      period={period}
      subtitle="A what-if to compare the options, not a forecast. Everything on this page is worked out again."
    >
      <Row
        title="Rain"
        choices={RAIN_CHOICES}
        selected={now.rain_pct}
        label={rainLabel}
        onPick={(v) => onChange(toScenario(v, now.temp_c))}
      />
      <Row
        title="Temperature"
        choices={TEMP_CHOICES}
        selected={now.temp_c}
        label={tempLabel}
        onPick={(v) => onChange(toScenario(now.rain_pct, v))}
      />
      {scenario ? (
        <View style={styles.on} accessibilityLiveRegion="polite">
          <Text style={text.bodyStrong}>Showing a what-if: {describeScenario(scenario)}.</Text>
          {notes.map((n) => (
            <Text key={n} style={text.small}>
              {n}
            </Text>
          ))}
          <Pressable onPress={() => onChange(null)} accessibilityRole="button" style={styles.reset}>
            <Text style={styles.resetText}>Back to today&apos;s climate</Text>
          </Pressable>
        </View>
      ) : null}
    </InfoCard>
  );
}

function Row({
  title,
  choices,
  selected,
  label,
  onPick,
}: {
  title: string;
  choices: readonly number[];
  selected: number;
  label: (v: number) => string;
  onPick: (v: number) => void;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text style={text.bodyStrong}>{title}</Text>
      <View style={styles.row}>
        {choices.map((v) => {
          const on = v === selected;
          return (
            <Pressable
              key={v}
              onPress={() => onPick(v)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              aria-checked={on}
              accessibilityLabel={label(v)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
            >
              <Text style={[text.small, on && { color: colors.green, fontWeight: "700" }]}>{label(v)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.greenTint },
  pressed: { backgroundColor: colors.pressed },
  on: { gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: colors.greenTint },
  reset: { minHeight: 44, justifyContent: "center" },
  resetText: { fontSize: 14, lineHeight: 20, color: colors.green, textDecorationLine: "underline", fontWeight: "600" },
});
