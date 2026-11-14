import type { Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import type { Explanation, RotationOption } from "../engine";
import { Button } from "./Button";
import { ConfidenceTag } from "./RecommendationsCard";
import { optionCropsText } from "./recommendations-core";
import { OPTION_LABELS } from "./soil-health-chart-core";
import { colors, optionColors, radius, space, text } from "./theme";

// "Best plan for this lot" (#165): the first thing on the dashboard, so a farmer (or a judge) sees
// the answer before the charts. It only repeats the engine's own top option, its score next to
// the farmer's crops, and the first two "Why" lines from engine/explain.ts. It decides nothing.

type Props = {
  lotName: string;
  /** The top-total option (`topPick`), A included. */
  pick: RotationOption;
  /** Option A, the farmer's crops, to compare the score with. */
  a: RotationOption | undefined;
  explanation: Explanation | undefined;
  cropName: (id: string) => string;
  /** Set while option A uses the usual months (stage 1): a short note and a link to give them. */
  monthsHref?: Href;
};

export function TopPickCard({ lotName, pick, a, explanation, cropName, monthsHref }: Props) {
  const isA = pick.key === "A";
  const score = (o: RotationOption | undefined) => (o?.total == null ? "–" : String(Math.round(o.total)));
  const why = (explanation?.why ?? []).slice(0, 2).map((l) => l.text);
  const color = optionColors[pick.key];
  return (
    <View style={[styles.card, { borderLeftColor: color }]} accessibilityRole="summary">
      <Text style={text.caption}>Best plan for {lotName}</Text>
      <Text style={text.heading} accessibilityRole="header">
        {isA ? "Keep your crops" : `Option ${pick.key}: ${OPTION_LABELS[pick.key]}`}
      </Text>
      <Text style={text.body}>{optionCropsText(pick, cropName)}</Text>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>
          {score(pick)}
          <Text style={text.caption}> /100</Text>
        </Text>
        <Text style={[text.small, styles.flex]}>
          {isA ? "Your crops score highest on this lot." : `Your crops now: ${score(a)} /100. Higher is better.`}
        </Text>
      </View>
      {explanation ? (
        <View style={styles.tags}>
          <ConfidenceTag level={explanation.confidence.level} />
        </View>
      ) : null}
      {!isA && why.length > 0 ? (
        <View style={styles.why}>
          {why.map((w) => (
            <Text key={w} style={text.small}>
              {"• "}
              {w}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={[text.small, { color: colors.muted }]}>
        Talk it over with your agricultural technician before you change anything. All options are below.
      </Text>
      {monthsHref ? (
        <View style={styles.months}>
          <Text style={[text.small, { color: colors.muted }]}>
            Your crops use the usual planting months for now (assumed).
          </Text>
          <Button label="Give your planting months" variant="link" href={monthsHref} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  score: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.ink },
  flex: { flex: 1, minWidth: 0 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  why: { gap: space.xs },
  months: { gap: 0, alignItems: "flex-start" },
});
