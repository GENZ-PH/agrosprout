import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, MAX_CONTENT_WIDTH, space } from "./theme";

type Props = {
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. the screen's Next button. */
  footer?: ReactNode;
  /** false = the body does not scroll (e.g. a full-screen map). */
  scrollEnabled?: boolean;
  /** true = no side padding or width limit, so content can reach the screen edges. */
  edgeToEdge?: boolean;
};

/** Page frame for every screen: safe area, scrolling body, optional pinned footer. */
export function Screen({ children, footer, scrollEnabled = true, edgeToEdge = false }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={edgeToEdge ? styles.edge : styles.content}
        scrollEnabled={scrollEnabled}
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
  edge: { flexGrow: 1 },
  footer: { ...column, gap: space.sm, paddingTop: space.sm, paddingBottom: space.lg },
});
