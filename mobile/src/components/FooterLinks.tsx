import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AboutDialog } from "./AboutDialog";
import { Disclaimer } from "./Disclaimer";

import { colors, MAX_WIDE_WIDTH, MIN_TOUCH, space } from "./theme";

/** About AgroSprout (a dialog), then links to Edit farm (#35), Learn, Crop library, Data and limits (#31), and Licenses and credits. */
export function FooterLinks({ compact = false }: { compact?: boolean }) {
  const [about, setAbout] = useState(false);
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Pressable onPress={() => setAbout(true)} accessibilityRole="button" style={[styles.link, compact && styles.linkCompact]}>
        <Text style={styles.text}>About AgroSprout</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/edit-farm")} accessibilityRole="link" style={[styles.link, compact && styles.linkCompact]}>
        <Text style={styles.text}>Edit farm</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/learn")} accessibilityRole="link" style={[styles.link, compact && styles.linkCompact]}>
        <Text style={styles.text}>Learn</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/crop-library")} accessibilityRole="link" style={[styles.link, compact && styles.linkCompact]}>
        <Text style={styles.text}>Crop library</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/data")} accessibilityRole="link" style={[styles.link, compact && styles.linkCompact]}>
        <Text style={styles.text}>Data and limits</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/credits")} accessibilityRole="link" style={[styles.link, compact && styles.linkCompact]}>
        <Text style={styles.text}>Credits</Text>
      </Pressable>
      <AboutDialog visible={about} onClose={() => setAbout(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg },
  rowCompact: { flexWrap: "nowrap" },
  link: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: "center", alignItems: "center" },
  linkCompact: { minHeight: 40 },
  text: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
});

/**
 * The pinned footer (2026-11-15): the links and the CLAUDE.md rule 6 line, always at the bottom of
 * the screen. The links scroll sideways on a narrow phone, so the bar keeps one short height.
 */
export function FooterBar() {
  return (
    <View style={bar.wrap} accessibilityRole="none">
      <View style={bar.inner}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={bar.scroll}>
          <FooterLinks compact />
        </ScrollView>
        <Disclaimer />
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  inner: { width: "100%", maxWidth: MAX_WIDE_WIDTH, alignSelf: "center", paddingHorizontal: space.xl, paddingBottom: space.sm },
  scroll: { flexGrow: 1 },
});
