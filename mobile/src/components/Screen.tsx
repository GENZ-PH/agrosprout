import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, MAX_CONTENT_WIDTH, MAX_WIDE_WIDTH, space } from "./theme";
import { usePresenter } from "./useLayout";

type Props = {
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. the screen's Next button. */
  footer?: ReactNode;
  /** false = the body does not scroll (e.g. a full-screen map). */
  scrollEnabled?: boolean;
  /** true = no side padding or width limit, so content can reach the screen edges. */
  edgeToEdge?: boolean;
  /**
   * How wide the content gets on a big window (#114). "narrow" (default) = the reading column for
   * forms; "wide" = up to MAX_WIDE_WIDTH, for screens that lay cards side by side (the dashboard).
   * Phones look the same either way: both are the full width minus the side padding.
   */
  width?: "narrow" | "wide";
};

/** Page frame for every screen: safe area, scrolling body, optional pinned footer. */
export function Screen({ children, footer, scrollEnabled = true, edgeToEdge = false, width = "narrow" }: Props) {
  // Beside the NASA data console the app keeps its phone-like reading column.
  const presenter = usePresenter();
  const max = width === "wide" && !presenter ? styles.wide : null;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={edgeToEdge ? styles.edge : [styles.content, max]}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, max]}>{footer}</View> : null}
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
  wide: { maxWidth: MAX_WIDE_WIDTH },
});
