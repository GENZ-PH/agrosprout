import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PriorityKey } from "../engine/scores";
import type { Priorities } from "../types";
import { Icon } from "./Icon";
import { useExplainer } from "./InfoToggle";
import { useT } from "../i18n/lang-store";
import { chosenPriorities, PRIORITY_KEYS, togglePriority } from "./plan-text";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

type Props = {
  priorities: Priorities;
  onChange: (next: Priorities) => void;
  /** Priorities no score can answer on this lot yet; shown, but not selectable. */
  unavailable: readonly PriorityKey[];
  /** The years of the lot's data, for the ⓘ. */
  period: string;
};

/** "What matters to you": tap to re-rank the plans. Works offline, on the phone. */
export function PriorityChips({ priorities, onChange, unavailable, period }: Props) {
  const { t } = useT();
  const ex = useExplainer({ id: "priorities", period }, t("chips.title"));
  const chosen = new Set(chosenPriorities(priorities));
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[text.bodyStrong, styles.flex]}>{t("chips.title")}</Text>
        {ex.button}
      </View>
      {ex.box}
      <View style={styles.row}>
        {PRIORITY_KEYS.map((k) => {
          const off = unavailable.includes(k);
          const on = chosen.has(k) && !off;
          // A goal that cannot be scored is left out, and named once in the line below.
          if (off) return null;
          return (
            <Pressable
              key={k}
              onPress={() => onChange(togglePriority(priorities, k))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.chip, on ? styles.on : pressed && styles.pressed]}
            >
              {on ? <Icon name="check" size={18} color={colors.white} /> : null}
              <Text style={[text.bodyStrong, on && styles.onLabel]}>{t(`prio.${k}`)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  wrap: { gap: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  on: { backgroundColor: colors.green, borderColor: colors.green },
  pressed: { backgroundColor: colors.pressed },
  onLabel: { color: colors.white },
});
