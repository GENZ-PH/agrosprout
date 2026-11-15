import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AboutDialog } from "./AboutDialog";

import { colors, MIN_TOUCH, space } from "./theme";

/** About AgroSprout (a dialog), then links to Edit farm (#35), Learn and Data and limits (#31), and Licenses and credits. */
export function FooterLinks() {
  const [about, setAbout] = useState(false);
  return (
    <View style={styles.row}>
      <Pressable onPress={() => setAbout(true)} accessibilityRole="button" style={styles.link}>
        <Text style={styles.text}>About AgroSprout</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/edit-farm")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Edit farm</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/learn")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Learn</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/data")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Data and limits</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/credits")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Credits</Text>
      </Pressable>
      <AboutDialog visible={about} onClose={() => setAbout(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg },
  link: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
});
