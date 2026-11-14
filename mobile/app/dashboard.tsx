import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropFitList } from "../src/components/CropFitList";
import { Disclaimer } from "../src/components/Disclaimer";
import { FieldYear } from "../src/components/FieldYear";
import { Header } from "../src/components/Header";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { planName } from "../src/components/field-year-core";
import { PlanDetail } from "../src/components/PlanDetail";
import { PlanTable } from "../src/components/PlanTable";
import { chosenPriorities, unavailablePriorities, verdictText } from "../src/components/plan-text";
import { PriorityChips } from "../src/components/PriorityChips";
import { Screen } from "../src/components/Screen";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { colors, radius, space, text, TWO_COLUMN_MIN } from "../src/components/theme";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { cropById } from "../src/data/crops";
import type { LotAnalysis, OptionKey } from "../src/engine";
import { useT } from "../src/i18n/lang-store";
import { cropLabel } from "../src/i18n/strings";
import { isDemoFarm } from "../src/state/demo-farm";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Farm, Lot, Priorities } from "../src/types";

// S3 Dashboard (#29, docs/11-user-flow.md): results per lot, worked out on the phone from the
// lot's NASA data. What matters to you, the field-year comparison of the plans (the farmer's
// own crops plus the alternatives), one plan in detail (why, gains, losses, unknowns, what to
// check locally, sources), how the farmer's crops fit, and the 3-year Soil Health card (#43).

const cropName = (id: string) => cropById(id)?.name ?? id;
export default function DashboardScreen() {
  const farm = useFarm();
  const { t } = useT();
  // On a phone the switch gets its own row, so the title is never cut short.
  const wide = useWindowDimensions().width >= TWO_COLUMN_MIN;
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];

  return (
    <Screen wide footer={<Disclaimer />}>
      <Header title={t("dash.title")} right={wide ? <LanguageSwitch /> : undefined} />
      {wide ? null : <LanguageSwitch />}
      {lot ? (
        <>
          <View style={styles.lotRow}>
            <LotTabs lots={farm.lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
            <Text style={text.small}>
              <Text style={styles.strong}>{lot.area_ha} ha</Text>
              {`  ${t(`land.${lot.details.land_type}`)}, ${t(`water.${lot.details.water}`)}`}
            </Text>
          </View>
          {isDemoFarm(farm.lots) ? <Text style={text.caption}>{t("dash.demo")}</Text> : null}
          <LotResults key={lot.id} farm={farm} lot={lot} />
        </>
      ) : (
        <>
          <Notice tone="warn">{t("dash.drawFirst")}</Notice>
          <Button label={t("dash.draw")} href="/lots" />
        </>
      )}
    </Screen>
  );
}

function LotResults({ farm, lot }: { farm: Farm; lot: Lot }) {
  const view = useLotAnalysis(farm, lot);
  const updateLot = useFarmStore((s) => s.updateLot);
  const { t } = useT();
  const lotName = { lot: lot.name };

  switch (view.kind) {
    case "loading":
      return <Text style={text.caption}>{t("dash.loading", lotName)}</Text>;
    case "no-crops":
      return (
        <>
          <Notice tone="warn">{t("dash.noCrops", lotName)}</Notice>
          <Button label={t("dash.pickCrops")} href="/crops" />
        </>
      );
    case "no-data":
      // The lot sync downloads pending lots by itself when the phone has signal.
      return view.status === "pending" ? (
        <Notice icon="clock">{t("dash.getting", lotName)}</Notice>
      ) : (
        <>
          <Notice tone="warn">{t("dash.noData", lotName)}</Notice>
          <Button label={t("dash.retry")} variant="secondary" onPress={() => updateLot(lot.id, { data_status: "pending" })} />
        </>
      );
    case "failed":
      return <Notice tone="warn">{t("dash.failed", lotName)}</Notice>;
    case "ready":
      return <Results farm={farm} analysis={view.analysis} />;
  }
}

function Results({ farm, analysis }: { farm: Farm; analysis: LotAnalysis }) {
  const setPriorities = useFarmStore((s) => s.setPriorities);
  const { t, lang, months } = useT();
  const { width } = useWindowDimensions();
  const twoColumns = width >= TWO_COLUMN_MIN;
  const { options } = analysis.rotations;
  const best = options.find((o) => o.top_total) ?? options[0];
  const [picked, setPicked] = useState<OptionKey | null>(null);
  const selected = options.find((o) => o.key === picked) ?? best;
  const baseline = options[0];
  const unavailable = unavailablePriorities(analysis.rotations.components_left_out);
  // A new choice of goals brings the detail back to the plan that now fits best.
  const choose = (next: Priorities) => {
    setPicked(null);
    setPriorities(next);
  };
  // What to plant under the best plan, in order: "Mungbean (Apr to Jun) › Lowland rice (Jul to Nov)".
  const sequence = best.slots
    .map((s) => `${cropLabel(lang, cropById(s.crop_id), s.crop_id)} (${months[s.plant_month - 1]} ${t("list.to")} ${months[s.harvest_month - 1]})`)
    .join("  \u203A  ");
  const verdict = verdictText(
    {
      chosen: chosenPriorities(farm.priorities).filter((k) => !unavailable.includes(k)),
      bestKey: best.key,
      bestName: planName(best.kind, t),
      bestTotal: best.total,
      baselineTotal: baseline.total,
      bestIsBaseline: best.key === baseline.key,
    },
    t,
  );

  const compare = (
    <>
      <View style={styles.intro}>
        <Text style={text.heading} accessibilityRole="header">
          {t("year.title")}
        </Text>
        <Text style={[text.small, styles.muted]}>
          {t("year.hint")}
        </Text>
      </View>
      <FieldYear options={options} selected={selected.key} onSelect={setPicked} monthly={analysis.monthly} cropById={cropById} />
      <Text style={text.caption}>{t("year.source")}</Text>
    </>
  );
  const detail = (
    <PlanDetail
      key={selected.key}
      option={selected}
      baseline={baseline}
      explanation={analysis.explanations.find((e) => e.option_key === selected.key)}
      leftOut={analysis.rotations.components_left_out}
      cropById={cropById}
      defaultOpen={twoColumns}
    />
  );
  const table = <PlanTable options={options} selected={selected.key} onSelect={setPicked} />;
  const rest = (
    <>
      <CropFitList fits={analysis.crop_fits} cropById={cropById} />
      <SoilHealthChart result={analysis.soil_health} options={options} cropName={cropName} />
    </>
  );

  return (
    <>
      <PriorityChips priorities={farm.priorities} onChange={choose} unavailable={unavailable} />
      <View style={styles.verdict} accessibilityLiveRegion="polite">
        <Text style={styles.verdictText}>{verdict}</Text>
        <Text style={text.body}>{t("verdict.plant", { sequence })}</Text>
      </View>
      {compare}
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {table}
            {rest}
          </View>
          <View style={styles.column}>{detail}</View>
        </View>
      ) : (
        <>
          {table}
          {detail}
          {rest}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  strong: { fontWeight: "700" },
  muted: { color: colors.muted },
  intro: { gap: 4 },
  lotRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.lg, rowGap: space.sm },
  verdict: { borderLeftWidth: 4, borderLeftColor: colors.green, backgroundColor: colors.greenTint, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, gap: 4 },
  verdictText: { ...text.heading, fontWeight: "600" },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: space.xl },
  column: { flex: 1, gap: space.lg, minWidth: 0 },
});
