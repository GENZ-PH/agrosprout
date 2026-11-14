import { router, useLocalSearchParams } from "expo-router";
import { Fragment, type ReactNode, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropFitList } from "../src/components/CropFitList";
import { Disclaimer } from "../src/components/Disclaimer";
import { FarmMapCard } from "../src/components/FarmMapCard";
import { FieldYear } from "../src/components/FieldYear";
import { FooterLinks } from "../src/components/FooterLinks";
import { DataTracePanel } from "../src/components/DataTracePanel";
import { HarvestCard } from "../src/components/HarvestCard";
import { Header } from "../src/components/Header";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { ensoLine, LotDataCard } from "../src/components/LotDataCard";
import { SatelliteCard } from "../src/components/SatelliteCard";
import { SeasonGuide } from "../src/components/SeasonGuide";
import { ClimateExtremesCard } from "../src/components/ClimateExtremesCard";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { PlanDetail } from "../src/components/PlanDetail";
import { PlanTable } from "../src/components/PlanTable";
import { formatHa, unavailablePriorities } from "../src/components/plan-text";
import { PriorityChips } from "../src/components/PriorityChips";
import { Screen } from "../src/components/Screen";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { colors, MAX_CONTENT_WIDTH, radius, space, text } from "../src/components/theme";
import { useLayout } from "../src/components/useLayout";
import { useFarmLotViews, useLotAnalysis } from "../src/components/useLotAnalysis";
import { ViewSwitch } from "../src/components/ViewSwitch";
import { WhatIfCard } from "../src/components/WhatIfCard";
import { cropById } from "../src/data/crops";
import type { LotAnalysis, OptionKey } from "../src/engine";
import type { Scenario } from "../src/engine/scenario";
import { useT } from "../src/i18n/lang-store";
import { isOtherCrop } from "../src/lots/crop-picks";
import { seasonsText } from "../src/lots/months-core";
import { shortCropName } from "../src/components/recommendations-core";
import { isDemoFarm } from "../src/state/demo-farm";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Farm, Lot, LotData, Priorities } from "../src/types";

// S3 Dashboard, PREVIEW presentation (branch preview/dashboard-ui, not for merge). Same app
// and same engine output as main; only the results are presented differently, in two views:
//   What to plant: the farmer's answer first. Goals, the crops to plant in order with their
//     months, plain reasons against the crops grown now, what to ask the technician, every
//     option named by its crops, how the farmer's crops fit, and getting the harvest out.
//   Why, the NASA data: the evidence for judges and technicians. The year chart (rain against
//     water demand, every plan on one axis), the plans side by side as field facts, the full
//     explanation with sources, the what-if card and the 3-year Soil Health card.
// The team's farm map, lot tabs and months prompt are main's; the farm map moves below the
// results so the answer is the first thing on the screen.

const cropName = (id: string) => cropById(id)?.name ?? id;
type ViewKey = "plant" | "evidence";

export default function DashboardScreen() {
  const farm = useFarm();
  const { t } = useT();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];
  const views = useFarmLotViews(farm);
  const { wide } = useLayout();
  const selectLot = useCallback((id: string) => router.setParams({ lot: id }), []);

  return (
    <Screen width="wide">
      <Header title={t("dash.title")} right={wide ? <LanguageSwitch /> : undefined} />
      {wide ? null : <LanguageSwitch />}
      {lot ? (
        <>
          <LotTabs
            lots={farm.lots}
            selectedId={lot.id}
            onSelect={selectLot}
            onAdd={() => router.push({ pathname: "/lots", params: { new: "1" } })}
          />
          <LotLine lot={lot} demo={isDemoFarm(farm.lots)} />
          <LotResults key={lot.id} farm={farm} lot={lot} />
          {/* The answer comes first; the whole-farm map (#124) follows as the overview. */}
          <FarmMapCard lots={farm.lots} views={views} selectedId={lot.id} onSelect={selectLot} wide={wide} />
        </>
      ) : (
        <Narrow>
          <Notice tone="warn">{t("dash.drawFirst")}</Notice>
          <Button label={t("dash.draw")} href="/lots" />
        </Narrow>
      )}
      {/* In the scroll, not pinned: on a phone a pinned footer hides about 110 px of results. */}
      <View style={styles.footer}>
        <FooterLinks />
        <Disclaimer />
      </View>
    </Screen>
  );
}

/** Area, land and water in one line. Missing details become a link to fill them in. */
function LotLine({ lot, demo }: { lot: Lot; demo: boolean }) {
  const { t } = useT();
  const known = lot.details.land_type !== "unknown" || lot.details.water !== "unknown";
  return (
    <View style={styles.lotLine}>
      <Text style={text.small}>
        <Text style={styles.strong}>{formatHa(lot.area_ha)}</Text>
        {known ? `  ${t(`land.${lot.details.land_type}`)}, ${t(`water.${lot.details.water}`)}` : ""}
      </Text>
      {known ? null : <Button label={t("lot.tell")} variant="link" href="/edit-farm" />}
      {demo ? <Text style={text.caption}>{t("dash.demo")}</Text> : null}
    </View>
  );
}

function LotResults({ farm, lot }: { farm: Farm; lot: Lot }) {
  // The what-if scenario (#47) belongs to the lot being looked at; null = today's climate.
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const view = useLotAnalysis(farm, lot, scenario);
  const updateLot = useFarmStore((s) => s.updateLot);
  const { t } = useT();
  const lotName = { lot: lot.name };

  switch (view.kind) {
    case "loading":
      return <Text style={text.caption}>{t("dash.loading", lotName)}</Text>;
    case "no-crops":
      return (
        <Narrow>
          <Notice tone="warn">{t("dash.noCrops", lotName)}</Notice>
          <Button label={t("dash.pickCrops")} href={{ pathname: "/crops", params: { lot: lot.id } }} />
        </Narrow>
      );
    case "no-data":
      // The lot sync downloads pending lots by itself when the phone has signal.
      return (
        <Narrow>
          {view.status === "pending" ? (
            <Notice icon="clock">{t("dash.getting", lotName)}</Notice>
          ) : (
            <>
              <Notice tone="warn">{t("dash.noData", lotName)}</Notice>
              <Button label={t("dash.retry")} variant="secondary" onPress={() => updateLot(lot.id, { data_status: "pending" })} />
            </>
          )}
        </Narrow>
      );
    case "failed":
      return (
        <Narrow>
          <Notice tone="warn">{t("dash.failed", lotName)}</Notice>
        </Narrow>
      );
    case "ready":
      return <Results farm={farm} lot={lot} analysis={view.analysis} period={view.period} data={view.data} scenario={scenario} setScenario={setScenario} />;
  }
}

function Results({
  farm,
  lot,
  analysis,
  period,
  data,
  scenario,
  setScenario,
}: {
  farm: Farm;
  lot: Lot;
  analysis: LotAnalysis;
  period: string;
  data?: LotData;
  scenario: Scenario | null;
  setScenario: (s: Scenario | null) => void;
}) {
  const setPriorities = useFarmStore((s) => s.setPriorities);
  const { t } = useT();
  const { wide } = useLayout();
  const [tab, setTab] = useState<ViewKey>("plant");
  const { options } = analysis.rotations;
  const best = options.find((o) => o.top_total) ?? options[0];
  const [picked, setPicked] = useState<OptionKey | null>(null);
  const selected = options.find((o) => o.key === picked) ?? best;
  const baseline = options[0];
  const unavailable = unavailablePriorities(analysis.rotations.components_left_out);
  // A new choice of goals brings the answer back to the plan that now fits best.
  const choose = (next: Priorities) => {
    setPicked(null);
    setPriorities(next);
  };

  const fit = <CropFitList fits={analysis.crop_fits} cropById={cropById} info={{ id: "your-crops", period }} />;
  const harvest = <HarvestCard lot={lot} destinations={farm.destinations} harvest={analysis.harvest} cropName={cropName} period={period} />;

  // The farmer's view: a season guide (what to do now, the year month by month, why, a checklist
  // and the other ways), with the harvest and planting-month prompts as actions below it.
  const plantView = (
    <>
      <SeasonGuide
        options={options}
        selected={selected}
        onSelect={setPicked}
        lotName={lot.name}
        cropById={cropById}
        onEvidence={() => setTab("evidence")}
        elNino={ensoLine() !== null}
        wide={wide}
        period={period}
      />
      {wide ? (
        <View style={styles.row}>
          <View style={styles.col}>{harvest}</View>
          <View style={styles.col}>
            <MonthsPrompt lot={lot} stage={analysis.stage} bare />
          </View>
        </View>
      ) : (
        harvest
      )}
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
      defaultOpen={wide}
      info={{ id: "recommendations", period }}
    />
  );
  const evidenceView = (
    <>
      <Text style={[text.small, styles.muted]}>{t("evidence.intro")}</Text>
      <FieldYear options={options} selected={selected.key} onSelect={setPicked} monthly={analysis.monthly} cropById={cropById} info={{ id: "lot-snapshot", period }} />
      <Text style={text.caption}>{t("year.source")}</Text>
      {data && wide ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <LotDataCard data={data} info={{ id: "data-sources", period }} />
          </View>
          <View style={styles.col}>
            <ClimateExtremesCard data={data} info={{ id: "climate-extremes", period }} />
          </View>
        </View>
      ) : data ? (
        <>
          <LotDataCard data={data} info={{ id: "data-sources", period }} />
          <ClimateExtremesCard data={data} info={{ id: "climate-extremes", period }} />
        </>
      ) : null}
      {data?.kind === "demo" ? <SatelliteCard farmId={data.id} lotName={lot.name} info={{ id: "satellite-checks", period }} /> : null}
      {fit}
      {wide ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <PlanTable options={options} selected={selected.key} onSelect={setPicked} info={{ id: "season-calendar", period }} />
            <WhatIfCard scenario={scenario} onChange={setScenario} notes={analysis.scenario?.notes ?? []} period={period} />
            <SoilHealthChart result={analysis.soil_health} options={options} cropName={cropName} period={period} />
          </View>
          <View style={styles.col}>{detail}</View>
        </View>
      ) : (
        <>
          <PlanTable options={options} selected={selected.key} onSelect={setPicked} info={{ id: "season-calendar", period }} />
          {detail}
          <WhatIfCard scenario={scenario} onChange={setScenario} notes={analysis.scenario?.notes ?? []} period={period} />
          <SoilHealthChart result={analysis.soil_health} options={options} cropName={cropName} period={period} />
        </>
      )}
    </>
  );

  return (
    <>
      <PriorityChips priorities={farm.priorities} onChange={choose} unavailable={unavailable} period={period} />
      <ViewSwitch
        items={[
          { key: "plant", label: t("view.plant") },
          { key: "evidence", label: t("view.evidence") },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "plant" ? plantView : evidenceView}
      <DataTracePanel data={data} />
      {/* On a wide plant view the prompt already sits beside the harvest card. */}
      {wide && tab === "plant" ? null : <MonthsPrompt lot={lot} stage={analysis.stage} />}
    </>
  );
}

/**
 * The Continue prompt at the end of the dashboard (docs/11-user-flow.md S3 → S4): give your
 * planting months for a sharper comparison, or Later. Once months are given, a way to change them.
 * Kept from main as is.
 */
function MonthsPrompt({ lot, stage, bare = false }: { lot: Lot; stage: 1 | 2; bare?: boolean }) {
  const [later, setLater] = useState(false);
  if (stage === 1 && later) return null;
  const listed = lot.crops.filter((c) => !isOtherCrop(c.crop_id));
  const given = listed.filter((c) => c.seasons.length > 0);
  const usual = listed.filter((c) => c.seasons.length === 0);
  const short = (id: string) => shortCropName(cropName(id));
  const Wrap = bare ? Fragment : Narrow;
  return (
    <Wrap>
      <View style={styles.prompt}>
        <Text style={text.heading} accessibilityRole="header">
          {stage === 1 ? "Want a sharper comparison?" : "Your planting months"}
        </Text>
        <Text style={text.body}>
          {stage === 1
            ? `Tell us which months you plant on ${lot.name}. Your crops (plan A) then use your months instead of the usual ones.`
            : `Plan A uses your months: ${given.map((c) => `${short(c.crop_id)} ${seasonsText(c.seasons)}`).join("; ")}.` +
              (usual.length > 0
                ? ` ${usual.map((c) => short(c.crop_id)).join(", ")} ${usual.length === 1 ? "keeps" : "keep"} the usual months (assumed).`
                : "")}
        </Text>
        <View style={stage === 1 ? styles.promptRow : styles.promptCol}>
          {stage === 1 ? (
            <>
              <Button label="Continue" iconAfter="chevron" href={{ pathname: "/months", params: { lot: lot.id } }} style={styles.col} />
              <Button label="Later" variant="quiet" onPress={() => setLater(true)} style={styles.col} />
            </>
          ) : (
            <>
              <Button label="Compare your months" iconAfter="chevron" href={{ pathname: "/compare", params: { lot: lot.id } }} />
              <Button label="Change your months" variant="secondary" href={{ pathname: "/months", params: { lot: lot.id } }} />
            </>
          )}
        </View>
      </View>
    </Wrap>
  );
}

/** Keeps messages and buttons at reading width on a wide screen. */
function Narrow({ children }: { children: ReactNode }) {
  return <View style={styles.narrow}>{children}</View>;
}

const styles = StyleSheet.create({
  footer: { gap: space.sm, marginTop: space.lg },
  strong: { fontWeight: "700" },
  muted: { color: colors.muted },
  lotLine: { gap: 2 },
  // Each card keeps its own height, so a short card doesn't get an empty stretched bottom.
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  col: { flex: 1, minWidth: 0, gap: space.lg },
  colMain: { flex: 1.15 },
  narrow: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, gap: space.lg },
  prompt: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.greenTint,
  },
  promptRow: { flexDirection: "row", gap: space.sm },
  promptCol: { gap: space.sm },
});
