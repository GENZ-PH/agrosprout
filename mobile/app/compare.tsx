import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { Bullets, InfoCard } from "../src/components/InfoCard";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { cropById } from "../src/data/crops";
import type { SeasonWindow } from "../src/engine/plantingWindow";
import { seasonCompare, type SeasonCompare, type Tone } from "../src/lots/compare-core";
import { cropShortName } from "../src/lots/crop-picks";
import { seasonLabel } from "../src/lots/months-core";
import { useFarm } from "../src/state/farm-store";
import type { Farm, Lot } from "../src/types";

// S5 Your months vs better months (#34, #95, docs/11-user-flow.md S5). For each season the
// farmer gave on S4: their months next to the best months the engine's planting-window scan
// found on this lot (`analysis.planting`), with why, what we don't know, and what to check.
// A "blocked" month (it would clash with another season of theirs) is a trade-off, never a
// move: there is no button that moves a season. Opened as /compare?lot=<id> from S4's Next and
// from the dashboard. The whole-lot calendar (docs/11) is not built yet.

const shortName = (id: string) => {
  const c = cropById(id);
  return c ? cropShortName(c) : id;
};

export default function CompareScreen() {
  const farm = useFarm();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];

  return (
    <Screen
      footer={
        <>
          {lot ? (
            <Button
              label="Done: see your results"
              iconAfter="chevron"
              size="lg"
              onPress={() => router.dismissTo({ pathname: "/dashboard", params: { lot: lot.id } })}
            />
          ) : null}
          <Disclaimer />
        </>
      }
    >
      <Header title="Your months vs better months" fallbackHref="/dashboard" />
      {!lot ? (
        <Text style={text.body}>Draw a lot and pick its crops first.</Text>
      ) : (
        <>
          <Text style={[text.body, { color: colors.muted }]}>
            For each season you gave, your planting months next to the best months we found for this lot from NASA
            rain and temperature data.
          </Text>
          {farm.lots.length > 1 ? (
            <LotTabs lots={farm.lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
          ) : null}
          <LotCompare key={lot.id} farm={farm} lot={lot} />
        </>
      )}
    </Screen>
  );
}

function LotCompare({ farm, lot }: { farm: Farm; lot: Lot }) {
  const view = useLotAnalysis(farm, lot);
  const monthsLink = (
    <Button label="Give or change your months" variant="secondary" href={{ pathname: "/months", params: { lot: lot.id } }} />
  );

  if (view.kind === "loading") return <Text style={text.caption}>Loading {lot.name}...</Text>;
  if (view.kind === "no-crops")
    return (
      <>
        <Notice tone="warn">Pick the crops you grow on {lot.name} first.</Notice>
        <Button label="Pick crops" href={{ pathname: "/crops", params: { lot: lot.id } }} />
      </>
    );
  if (view.kind === "no-data")
    return <Notice icon="clock">NASA climate data for {lot.name} is not on this phone yet. It downloads by itself when the phone has signal.</Notice>;
  if (view.kind === "failed") return <Notice tone="warn">Something went wrong while comparing the months for {lot.name}.</Notice>;

  const { analysis, period } = view;
  const seasons = analysis.planting.seasons;
  const noMonths = analysis.planting.gaps.filter((g) => g.code === "no-months").map((g) => shortName(g.crop_id));
  const ctx = {
    cropName: shortName,
    seasonsOf: (id: string) => lot.crops.find((c) => c.crop_id === id)?.seasons ?? [],
    period,
  };

  if (seasons.length === 0)
    return (
      <>
        <Notice tone="warn">
          You haven&apos;t given planting months for {lot.name} yet, so there is nothing to compare. Until then, option A
          uses the usual months (assumed).
        </Notice>
        {monthsLink}
      </>
    );

  return (
    <>
      {seasons.map((w) => (
        <SeasonCard key={`${w.crop_id}-${w.season_index}`} w={w} c={seasonCompare(w, ctx)} period={period} count={ctx.seasonsOf(w.crop_id).length} />
      ))}
      {noMonths.length > 0 ? (
        <Text style={text.caption}>
          {noMonths.join(", ")}: no months given, so {noMonths.length === 1 ? "it keeps" : "they keep"} the usual months
          (assumed) and {noMonths.length === 1 ? "is" : "are"} not compared here.
        </Text>
      ) : null}
      {monthsLink}
    </>
  );
}

const TONE: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.greenTint, fg: colors.green },
  warn: { bg: colors.amberTint, fg: colors.amber },
  neutral: { bg: colors.disabledBg, fg: colors.ink },
};

function SeasonCard({ w, c, period, count }: { w: SeasonWindow; c: SeasonCompare; period: string; count: number }) {
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
