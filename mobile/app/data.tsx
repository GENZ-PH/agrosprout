import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { CHALLENGE_DATASETS, DATA_SOURCES, fill, LIMITATIONS } from "../src/content/explainers";

// Data & limits (#31): every source with its period and resolution, then the known limits.
const PERIOD = "the years your lot's own data covers (shown on each card's ⓘ)";

export default function DataScreen() {
  return (
    <Screen footer={<Disclaimer />}>
      <Header title="Data and limits" fallbackHref="/dashboard" />
      <Text style={text.heading} accessibilityRole="header">
        Where the numbers come from
      </Text>
      <View style={styles.list}>
        {DATA_SOURCES.map((d) => (
          <View key={d.name} style={styles.item}>
            <Text style={text.bodyStrong}>{d.name}</Text>
            <Text style={text.body}>{d.used_for}</Text>
            <Text style={text.caption}>Period: {fill(d.period, { period: PERIOD })}</Text>
            <Text style={text.caption}>Resolution: {d.resolution}</Text>
            {d.url ? (
              <Pressable
                onPress={() => void Linking.openURL(d.url as string)}
                accessibilityRole="link"
                accessibilityLabel={`Open ${d.name}`}
              >
                <Text style={styles.link}>{d.url}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <Text style={text.heading} accessibilityRole="header">
        NASA datasets we use and do not use
      </Text>
      <View style={styles.list}>
        {CHALLENGE_DATASETS.map((d) => (
          <View key={d.name} style={styles.item}>
            <Text style={text.bodyStrong}>
              {d.name}: {d.status}
            </Text>
            <Text style={text.small}>{d.note}</Text>
          </View>
        ))}
      </View>
      <Text style={text.heading} accessibilityRole="header">
        What to keep in mind
      </Text>
      <View style={styles.list}>
        {LIMITATIONS.map((l) => (
          <View key={l} style={styles.bullet}>
            <Text style={text.body}>•</Text>
            <Text style={[text.body, styles.flex]}>{l}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bullet: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
  link: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
});
