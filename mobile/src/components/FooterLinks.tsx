import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, MIN_TOUCH, space } from "./theme";

/** Links to Edit farm (#35) and the Learn and Data and limits pages (#31). */
export function FooterLinks() {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push("/edit-farm")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Edit farm</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/learn")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Learn</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/data")} accessibilityRole="link" style={styles.link}>
        <Text style={styles.text}>Data and limits</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.lg },
  link: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
});
