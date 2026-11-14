import { StyleSheet, Text, View } from "react-native";

import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { GLOSSARY } from "../src/content/explainers";

// Learn (#31): the plain-language glossary. The words come from src/content/explainers.ts.
export default function LearnScreen() {
  return (
    <Screen footer={<Disclaimer />}>
      <Header title="Learn" fallbackHref="/dashboard" />
      <Text style={text.body}>The words used in your results, in plain language.</Text>
      <View style={styles.list}>
        {GLOSSARY.map((g) => (
          <View key={g.term} style={styles.item}>
            <Text style={text.heading} accessibilityRole="header">
              {g.term}
            </Text>
            <Text style={text.body}>{g.meaning}</Text>
            {g.source ? <Text style={text.caption}>Source: {g.source}</Text> : null}
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
});
