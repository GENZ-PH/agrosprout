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
  /** Room for two columns (big window): the verdict and scores left, the reasons right. */
  wide?: boolean;
};

/** " 29 points above your crops." when both totals exist. */
function gap(o: RotationOption, a: RotationOption | undefined): string {
  if (o.total == null || a?.total == null) return "";
  const d = Math.round(o.total) - Math.round(a.total);
  return d > 0 ? ` ${d} points above your crops.` : "";
}

export function TopPickCard({ lotName, pick, a, explanation, cropName, monthsHref, wide = false }: Props) {
  const isA = pick.key === "A";
  const score = (o: RotationOption | undefined) => (o?.total == null ? "–" : String(Math.round(o.total)));
  // Phones get the main reason only (concise); a wide window has room for two.
  const why = (explanation?.why ?? []).slice(0, wide ? 2 : 1).map((l) => l.text);
  const color = optionColors[pick.key];
  return (
    <View style={[styles.card, wide && styles.cardWide, { borderLeftColor: color }]} accessibilityRole="summary">
      <View style={[styles.col, wide && styles.colLeft]}>
        <Text style={text.caption}>Best plan for {lotName}</Text>
        <Text style={text.title} accessibilityRole="header">
          {isA ? "Keep your crops" : `Option ${pick.key}: ${OPTION_LABELS[pick.key]}`}
        </Text>
        <Text style={text.body}>{optionCropsText(pick, cropName)}</Text>
        {/* Summary first (#165): the two scores as bars, so the gap reads at a glance. */}
        <View
          style={styles.bars}
          accessibilityLabel={
            isA
              ? `Your crops score ${score(pick)} out of 100, the highest on this lot.`
              : `Option ${pick.key} scores ${score(pick)} out of 100; your crops now score ${score(a)}.`
          }
        >
          {(isA ? [pick] : [pick, a]).map((o) =>
            o ? (
              <View key={o.key} style={styles.barRow}>
                <Text style={[text.small, styles.barLabel]} numberOfLines={1}>
                  {o.key === "A" ? "Your crops" : `Option ${o.key}`}
                </Text>
                <View style={styles.track}>
                  <View
                    style={[styles.fill, { width: `${Math.max(2, Math.min(100, o.total ?? 0))}%`, backgroundColor: optionColors[o.key] }]}
                  />
                </View>
                <Text style={styles.barValue}>{score(o)}</Text>
              </View>
            ) : null,
          )}
          <Text style={text.caption}>
            {isA ? "Score out of 100. Your crops score highest on this lot." : `Score out of 100; higher is better.${gap(pick, a)}`}
          </Text>
        </View>
        {explanation ? (
          <View style={styles.tags}>
            <ConfidenceTag level={explanation.confidence.level} />
          </View>
        ) : null}
      </View>
      <View style={[styles.col, wide && styles.colRight]}>
        {!isA && why.length > 0 ? (
          <View style={styles.why}>
            <Text style={text.bodyStrong}>Why this plan</Text>
            {why.map((w) => (
              <View key={w} style={styles.bullet}>
                <Text style={text.body}>{"\u2022"}</Text>
                <Text style={[text.body, styles.flex]}>{w}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={[text.small, styles.muted]}>
          {wide
            ? "Talk it over with your agricultural technician before you change anything. All options are below."
            : "Talk it over with your agricultural technician first."}
        </Text>
        {monthsHref ? (
          <View style={styles.months}>
            <Text style={[text.small, styles.muted]}>Your crops use the usual planting months for now (assumed).</Text>
            <Button label="Give your planting months" variant="link" href={monthsHref} />
          </View>
        ) : null}
      </View>
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
  cardWide: { flexDirection: "row", gap: space.xl, padding: space.xl },
  col: { gap: space.sm },
  colLeft: { flex: 5, minWidth: 0 },
  colRight: { flex: 6, minWidth: 0, paddingLeft: space.xl, borderLeftWidth: 1, borderLeftColor: colors.border },
  bullet: { flexDirection: "row", gap: space.sm },
  muted: { color: colors.muted },
  bars: { gap: space.xs, marginVertical: space.xs },
  barRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  barLabel: { width: 84 },
  track: { flex: 1, height: 14, borderRadius: radius.pill, backgroundColor: colors.bg, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  barValue: { width: 32, textAlign: "right", fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.ink },
  flex: { flex: 1, minWidth: 0 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  why: { gap: space.xs },
  months: { gap: 0, alignItems: "flex-start" },
});
