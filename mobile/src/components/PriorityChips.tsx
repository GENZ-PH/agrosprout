import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PriorityKey } from "../engine/scores";
import type { Priorities } from "../types";
import { Icon } from "./Icon";
import { useT } from "../i18n/lang-store";
import { chosenPriorities, listText, PRIORITY_KEYS, togglePriority } from "./plan-text";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

type Props = {
  priorities: Priorities;
  onChange: (next: Priorities) => void;
  /** Priorities no score can answer on this lot yet; shown, but not selectable. */
  unavailable: readonly PriorityKey[];
};

/** "What matters to you": tap to re-rank the plans. Works offline, on the phone. */
export function PriorityChips({ priorities, onChange, unavailable }: Props) {
  const { t } = useT();
  const chosen = new Set(chosenPriorities(priorities));
  return (
    <View style={styles.wrap}>
      <Text style={text.bodyStrong}>{t("chips.title")}</Text>
      <View style={styles.row}>
        {PRIORITY_KEYS.map((k) => {
          const off = unavailable.includes(k);
          const on = chosen.has(k) && !off;
          if (off) {
            return (
              <View key={k} style={[styles.chip, styles.off]} accessibilityRole="checkbox" accessibilityState={{ disabled: true, checked: false }}>
                <Text style={[text.bodyStrong, styles.offLabel]}>{t(`prio.${k}`)}</Text>
                <Text style={[text.caption, styles.offLabel]}>{t("chips.needsData")}</Text>
              </View>
            );
          }
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
      {unavailable.length > 0 ? (
        <Text style={text.caption}>
          {t("chips.unavailable", { goals: listText(unavailable.map((k) => t(`prio.${k}`)), t) })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  off: { borderStyle: "dashed", backgroundColor: "transparent" },
  offLabel: { color: colors.muted },
});
