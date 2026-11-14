import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import context from "../../assets/data/context.json";
import type { ClimateContext } from "../types";
import { contextLines } from "./climate-context-core";
import { InfoCard } from "./InfoCard";
import { colors, MIN_TOUCH, space, text } from "./theme";

// "Climate right now" (#10): the ocean temperature index and the national advisory, as context only.
// They don't change any score. Hidden when context.json has neither value.

const LINES = contextLines(context as ClimateContext);

export function ClimateContextCard({ period }: { period: string }) {
  if (LINES.length === 0) return null;
  return (
    <InfoCard
      title="Climate right now"
      explainer="climate-context"
      period={period}
      subtitle="Context only. It does not change your scores."
    >
      <View style={styles.list}>
        {LINES.map((l) => (
          <View key={l.heading} style={styles.item}>
            <Text style={text.bodyStrong}>{l.heading}</Text>
            <Text style={text.body}>{l.body}</Text>
            <Pressable
              onPress={() => void Linking.openURL(l.url)}
              accessibilityRole="link"
              accessibilityLabel={`Open source: ${l.source}`}
              style={styles.linkRow}
            >
              <Text style={styles.link}>{l.source}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { gap: space.xs },
  link: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
  linkRow: { minHeight: MIN_TOUCH, justifyContent: "center" },
});
