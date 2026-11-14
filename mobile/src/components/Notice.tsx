import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors, radius, space, text } from "./theme";

type Props = {
  children: ReactNode;
  /** good = green (reassurance), warn = amber (assumption or caution). */
  tone?: "good" | "warn";
  icon?: IconName;
};

/** Tinted box for privacy notes, assumptions and cautions. */
export function Notice({ children, tone = "good", icon = tone === "good" ? "check" : "alert" }: Props) {
  const fg = tone === "good" ? colors.green : colors.amber;
  return (
    <View style={[styles.box, { backgroundColor: tone === "good" ? colors.greenTint : colors.amberTint }]}>
      <View style={styles.icon}>
        <Icon name={icon} size={22} color={fg} />
      </View>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  icon: { marginTop: 1 },
  text: { ...text.body, flex: 1 },
});
