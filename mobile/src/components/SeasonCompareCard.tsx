import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { cropById } from "../data/crops";
import type { SeasonWindow } from "../engine/plantingWindow";
import { seasonCompare, type SeasonCompare, type Tone } from "../lots/compare-core";
import { cropShortName } from "../lots/crop-picks";
import { seasonLabel } from "../lots/months-core";
import { Bullets, InfoCard } from "./InfoCard";
import { rowsOf } from "./layout-core";
import type { MonthsCompare } from "./lot-analysis-core";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { colors, radius, space, text } from "./theme";

// S5 "Your months vs better months" cards (#34, #95), shared by the dashboard (always shown,
// under Recommendations) and /compare. SeasonCard is the card from PR #132, moved here unchanged.
// MonthsCompareList renders one card per season of lotView's `months`: the farmer's months, or a
// crop's usual months (labelled assumed) until the farmer gives theirs.

const shortName = (id: string) => {
  const c = cropById(id);
  return c ? cropShortName(c) : id;
};

/**
 * `columns` = 2 on a wide window (#114): the season cards go two per row, in the same order as on
 * a phone (left to right, then down). Each card already sets your months and the better months side
 * by side in its table, at every width.
 */
export function MonthsCompareList({ months, period, columns = 1 }: { months: MonthsCompare; period: string; columns?: 1 | 2 }) {
  // Progressive disclosure (#165): the first season (or the first row on a big window), then a
  // button for the rest, so this section doesn't fill three phone screens.
  const [all, setAll] = useState(false);
  const seasonsOf = (id: string) => months.crops.find((c) => c.crop_id === id)?.seasons ?? [];
  const ctx = { cropName: shortName, seasonsOf, period };
  const assumed = months.assumed.map(shortName);
  const allCards = months.planting.seasons.map((w) => (
    <SeasonCard
      key={`${w.crop_id}-${w.season_index}`}
      w={w}
      c={seasonCompare(w, ctx)}
      period={period}
      count={seasonsOf(w.crop_id).length}
    />
  ));
  const firstCount = columns > 1 ? columns : 1;
  const cards = all ? allCards : allCards.slice(0, firstCount);
  const hidden = allCards.length - cards.length;
  return (
    <>
      {assumed.length > 0 ? (
        <Notice tone="warn">
          {`${assumed.join(", ")}: compared on the usual months (assumed), because you haven't given your own yet. Give your planting months for a sharper comparison.`}
        </Notice>
      ) : null}
      {columns > 1
        ? rowsOf(cards, columns).map((row) => (
            <View key={row.map((c) => c.key).join("|")} style={styles.gridRow}>
              {row.map((card) => (
                <View key={card.key} style={styles.gridCell}>
                  {card}
                </View>
              ))}
              {/* A lone last card keeps its half width, so the cards above and below line up. */}
              {row.length < columns ? <View style={styles.gridCell} /> : null}
            </View>
          ))
        : cards}
      {hidden > 0 || (all && allCards.length > firstCount) ? (
        <Button
          label={all ? "Show fewer seasons" : `Show ${hidden} more ${hidden === 1 ? "season" : "seasons"}`}
          variant="secondary"
          onPress={() => setAll((x) => !x)}
        />
      ) : null}
    </>
  );
}

const TONE: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.greenTint, fg: colors.green },
  warn: { bg: colors.amberTint, fg: colors.amber },
  neutral: { bg: colors.disabledBg, fg: colors.ink },
};

export function SeasonCard({ w, c, period, count }: { w: SeasonWindow; c: SeasonCompare; period: string; count: number }) {
  const tone = TONE[c.tone];
  return (
    <InfoCard
      title={`${shortName(w.crop_id)}: ${seasonLabel(w.yours)}`}
      explainer="months-compare"
      period={period}
      subtitle={count > 1 ? `Season ${w.season_index + 1} of ${count}` : undefined}
    >
      <View style={[styles.headline, { backgroundColor: tone.bg }]}>
        <Text style={[text.bodyStrong, { color: tone.fg }]}>{c.headline.text}</Text>
        {c.detail ? <Text style={text.small}>{c.detail.text}</Text> : null}
      </View>

      <View style={styles.table} accessibilityRole="summary">
        <View style={[styles.tr, styles.th]}>
          <Text style={[text.caption, styles.label]} />
          <Text style={[styles.colHead, styles.cell]}>Your months</Text>
          {c.otherTitle ? <Text style={[styles.colHead, styles.cell]}>{c.otherTitle}</Text> : null}
        </View>
        {c.rows.map((r) => (
          <View key={r.label} style={styles.tr}>
            <Text style={[text.caption, styles.label]}>{r.label}</Text>
            <Text style={[text.small, styles.cell, styles.value]}>{r.yours}</Text>
            {c.otherTitle ? <Text style={[text.small, styles.cell, styles.value]}>{r.other ?? ""}</Text> : null}
          </View>
        ))}
      </View>

      {c.why.length > 0 ? <Section title="Why" lines={c.why.map((l) => l.text)} /> : null}
      {c.unknowns.length > 0 ? <Section title="What we don't know" lines={c.unknowns.map((l) => l.text)} /> : null}
      <Section title="Check locally" lines={c.checks.map((l) => l.text)} />
      <Text style={text.caption}>Confidence: {c.confidence}</Text>
    </InfoCard>
  );
}

function Section({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <View style={styles.section}>
      <Text style={text.bodyStrong}>{title}</Text>
      <Bullets lines={lines} />
    </View>
  );
}

const styles = StyleSheet.create({
  gridRow: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  gridCell: { flex: 1, minWidth: 0 },
  headline: { gap: space.xs, padding: space.md, borderRadius: radius.sm },
  table: { borderTopWidth: 1, borderTopColor: colors.border },
  tr: {
    flexDirection: "row",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { paddingVertical: space.xs },
  label: { flex: 1.3 },
  cell: { flex: 1 },
  colHead: { ...text.caption, fontWeight: "700", color: colors.ink },
  value: { fontWeight: "600" },
  section: { gap: space.xs },
});
