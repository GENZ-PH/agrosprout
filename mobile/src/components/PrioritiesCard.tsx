import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PriorityKey } from "../engine/scores";
import type { Priorities } from "../types";
import { Icon } from "./Icon";
import { InfoCard } from "./InfoCard";
import { isPicked, notScoredNote, pickedButNotScored, PRIORITY_CHIPS } from "./priorities-core";
import { colors, radius, space, text } from "./theme";

// "What matters to you?" (#40, D14): four chips that re-weight the scores. The farm store
// saves the choice, and the dashboard works the options out again on the phone (offline).

type Props = {
  priorities: Priorities;
  onToggle: (key: PriorityKey) => void;
  /** `rotations.priorities_not_scored`: priorities with no data behind them yet. */
  notScored: readonly PriorityKey[];
  period: string;
};

// No "top score now" line: option D is the best with the farmer's own choice by design
// (docs/07), so it would almost always name D. The scores on the options below move instead.
export function PrioritiesCard({ priorities, onToggle, notScored, period }: Props) {
  const missing = pickedButNotScored(priorities, notScored);
  const note = notScoredNote(notScored);

  return (
    <InfoCard
      title="What matters to you?"
      explainer="priorities"
      period={period}
      subtitle="Tap what matters most. The scores below are worked out again on your phone. Tap again to undo."
    >
      <View style={styles.row}>
        {/* A chip that changes no score on this lot is hidden (dashboard audit): tapping it did nothing.
            Kept if already picked, so the farmer can still undo it. The note says why it is missing. */}
        {PRIORITY_CHIPS.filter((c) => !notScored.includes(c.key) || isPicked(priorities, c.key)).map((c) => {
          const picked = isPicked(priorities, c.key);
          return (
            <Pressable
              key={c.key}
              onPress={() => onToggle(c.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: picked }}
              // React Native Web drops accessibilityState.checked; aria-checked reaches the DOM.
              aria-checked={picked}
              accessibilityLabel={c.label}
              style={({ pressed }) => [styles.chip, picked && styles.chipOn, pressed && styles.pressed]}
            >
              {picked ? <Icon name="check" size={18} color={colors.green} /> : null}
              <Text style={[text.bodyStrong, picked && { color: colors.green }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {note ? (
        <Text style={[text.small, { color: missing.length > 0 ? colors.amber : colors.muted }]} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.greenTint },
  pressed: { backgroundColor: colors.pressed },
});
