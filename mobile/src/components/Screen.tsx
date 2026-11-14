import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, MAX_CONTENT_WIDTH, space } from "./theme";

type Props = {
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. the screen's Next button. */
  footer?: ReactNode;
};

/** Page frame for every screen: safe area, scrolling body, optional pinned footer. */
export function Screen({ children, footer }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const column = {
  width: "100%",
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: "center",
  paddingHorizontal: space.xl,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { ...column, flexGrow: 1, gap: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  footer: { ...column, gap: space.sm, paddingTop: space.sm, paddingBottom: space.lg },
});
