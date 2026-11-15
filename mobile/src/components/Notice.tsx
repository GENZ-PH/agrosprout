import type { ReactNode } from "react";
import { tr } from "../i18n/lang-store";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors, radius, space, text } from "./theme";

type Props = {
  children: ReactNode;
  /** good = green (reassurance), warn = amber (assumption or caution). */
  tone?: "good" | "warn";
  icon?: IconName;
  /** Smaller text and padding, for a short side note (the start screen's privacy line). */
  small?: boolean;
};

/** Tinted box for privacy notes, assumptions and cautions. */
export function Notice({ children, tone = "good", icon = tone === "good" ? "check" : "alert", small = false }: Props) {
  const fg = tone === "good" ? colors.green : colors.amber;
  return (
    <View style={[styles.box, small && styles.boxSmall, { backgroundColor: tone === "good" ? colors.greenTint : colors.amberTint }]}>
      <View style={styles.icon}>
        <Icon name={icon} size={small ? 16 : 22} color={fg} />
      </View>
      <Text style={[styles.text, small && styles.textSmall]}>{typeof children === "string" ? tr(children) : children}</Text>
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
  boxSmall: { paddingVertical: space.sm, paddingHorizontal: space.md, gap: space.sm },
  textSmall: { fontSize: 14, lineHeight: 20 },
});
