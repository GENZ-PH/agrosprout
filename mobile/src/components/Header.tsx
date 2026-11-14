import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import { colors, MIN_TOUCH, text } from "./theme";

type Props = {
  title: string;
  /** "back" = chevron, "close" = X, false = no button. */
  leading?: "back" | "close" | false;
  /** Where the button goes when there is no history (e.g. the page was opened by URL on web). */
  fallbackHref?: Href;
  /** Right side, e.g. "Step 1 of 2". */
  right?: ReactNode;
};

export function Header({ title, leading = "back", fallbackHref = "/", right }: Props) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallbackHref));
  return (
    <View style={styles.row}>
      {leading ? (
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={leading === "close" ? "Close" : "Back"}
          hitSlop={4}
          style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
        >
          <Icon name={leading} />
        </Pressable>
      ) : null}
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
      {typeof right === "string" ? <Text style={styles.right}>{right}</Text> : right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48 },
  lead: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    marginLeft: -10,
    borderRadius: MIN_TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.pressed },
  title: { ...text.title, flex: 1 },
  right: { ...text.small, color: colors.muted },
});
