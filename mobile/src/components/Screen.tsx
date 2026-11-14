import type { ReactNode } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, MAX_CONTENT_WIDTH, space, TWO_COLUMN_MIN, WIDE_CONTENT_WIDTH } from "./theme";

/** True on a laptop or tablet-sized window, where screens lay out side by side. */
export const useWide = () => useWindowDimensions().width >= TWO_COLUMN_MIN;

type Props = {
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. the screen's Next button. */
  footer?: ReactNode;
  /** false = the body does not scroll (e.g. a full-screen map). */
  scrollEnabled?: boolean;
  /** true = no side padding or width limit, so content can reach the screen edges. */
  edgeToEdge?: boolean;
  /** true = a wider column on large screens, for side-by-side results (judges use laptops). */
  wide?: boolean;
  /** With `wide`: keep the footer (the Next button) button-sized at the right, not stretched across. */
  footerEnd?: boolean;
};

/** Page frame for every screen: safe area, scrolling body, optional pinned footer. */
export function Screen({ children, footer, scrollEnabled = true, edgeToEdge = false, wide = false, footerEnd = false }: Props) {
  const isWide = useWide();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={edgeToEdge ? styles.edge : [styles.content, wide && styles.wide]}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, wide && styles.wide]}>
          {wide && footerEnd && isWide ? <View style={styles.footerEnd}>{footer}</View> : footer}
        </View>
      ) : null}
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
  wide: { maxWidth: WIDE_CONTENT_WIDTH },
  footerEnd: { alignSelf: "flex-end", width: 380, gap: space.sm },
  footer: { ...column, gap: space.sm, paddingTop: space.sm, paddingBottom: space.lg },
});
