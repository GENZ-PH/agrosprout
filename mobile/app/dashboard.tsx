import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeScenario } from "../src/components/what-if-core";
import { AdjustButton, AdjustSheet } from "../src/components/AdjustControls";
import { adjustSummary } from "../src/components/adjust-core";
import { Button } from "../src/components/Button";
import { CropFitCard } from "../src/components/CropFitCard";
import { Disclaimer } from "../src/components/Disclaimer";
import { FarmMapCard } from "../src/components/FarmMapCard";
import { FooterLinks } from "../src/components/FooterLinks";
import { Header } from "../src/components/Header";
import { HarvestCard } from "../src/components/HarvestCard";
import { NasaDataButton } from "../src/components/NasaDataButton";
import { openOverview, setPanelContext } from "../src/components/inspector-store";
import { canDock } from "../src/components/SourceInspector";
import type { SourceKey } from "../src/content/sources";
import { WhatIfCard } from "../src/components/WhatIfCard";
import { DataTracePanel } from "../src/components/DataTracePanel";
import { ElNinoNotice } from "../src/components/ElNinoNotice";
import { SatelliteCard } from "../src/components/SatelliteCard";
import { DemoDataContext } from "../src/components/SourceChip";
import { YearCalendar } from "../src/components/YearCalendar";
import type { Scenario } from "../src/engine/scenario";
import { LotCompareModal } from "../src/components/LotCompareModal";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { PrioritiesCard } from "../src/components/PrioritiesCard";
import { togglePriority } from "../src/components/priorities-core";
import { RecommendationsCard } from "../src/components/RecommendationsCard";
import { shortCropName, topPick } from "../src/components/recommendations-core";
import { Screen } from "../src/components/Screen";
import { MonthsCompareList } from "../src/components/SeasonCompareCard";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { TopPickCard } from "../src/components/TopPickCard";
import { colors, MAX_CONTENT_WIDTH, radius, space, text } from "../src/components/theme";
import { useLayout } from "../src/components/useLayout";
import { useFarmLotViews, useLotAnalysis } from "../src/components/useLotAnalysis";
import { LAND_WATER } from "../src/data/land-water";
import { lotLooksLikeWater } from "../src/lots/land-water-core";
import { CROP_LIBRARY, cropById } from "../src/data/crops";
import { isOtherCrop } from "../src/lots/crop-picks";
import { seasonsText } from "../src/lots/months-core";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Farm, Lot } from "../src/types";

// S3 Dashboard (#29, docs/11-user-flow.md): results per lot, worked out on the phone from the
// lot's NASA data. So far: the lot tabs with "+ Add lot" (D32: S1 then S2 for the new lot), Your crops here,
// What matters to you (priority chips, #40), Recommendations (options A-D with
// their explanations) and the 3-year Soil Health card (#43). The other S3 cards (lot snapshot,
// soil moisture, getting your harvest out, continue prompt) go in LotResults too.
// `useLotAnalysis` already returns everything they need (`LotAnalysis` in src/engine/analyze.ts).
//
// Big screens (#114): on a laptop window (expanded, >= 840 dp) the page widens to 1200 px, Your
// crops here and Soil Health sit side by side, and the Recommendations options go two per row.
// Phones keep one column in the same order as before. Messages and buttons stay in the narrow
// reading column so they don't stretch across a wide window.
//
// Farm map (#124): "Your lots on the map" sits above the lot tabs as the whole-farm overview.
// Each lot is colored by its crop fit; tapping a lot selects it like its tab.
//
// Lot comparison (#134, #171): tapping a lot on the farm map selects it and opens a dialog with
// the lot's own shape drawn twice, now vs the best other option, colored by one data layer. A
// "Compare" button under the map opens it too (screen readers and keyboards can't tap the map).
// It uses the same no-scenario results as the map, so the what-if slider doesn't change it.
//
// Answer first (#165): the lot tabs, then "Best plan for this lot" (TopPickCard), then
// priorities and Recommendations. The farm map moved below the results (the lot comparison opens
// from it in a dialog, #171), and
// the footer links scroll with the page instead of taking a pinned strip of a phone screen.

const cropName = (id: string) => cropById(id)?.name ?? id;
/** The panel opened by itself once this visit (wide windows only). */
let panelShown = false;

export default function DashboardScreen() {
  const farm = useFarm();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];
  const views = useFarmLotViews(farm);
  const { wide, width } = useLayout();
  // On a big window (mostly judges and technicians), the NASA data panel starts open once per
  // visit; on a phone it waits for the header button. Leaving the dashboard clears its lot.
  useEffect(() => {
    if (canDock(width) && !panelShown) {
      panelShown = true;
      openOverview();
    }
  }, [width]);
  useEffect(() => () => setPanelContext(null), []);
  const selectLot = useCallback((id: string) => router.setParams({ lot: id }), []);
  // The lot comparison dialog (#171) is open for this lot id; null = closed.
  const [compareId, setCompareId] = useState<string | null>(null);
  const openLot = useCallback(
    (id: string) => {
      selectLot(id);
      setCompareId(id);
    },
    [selectLot],
  );
  const lotView = lot ? views[lot.id] : undefined;
  const compareLot = farm.lots.find((l) => l.id === compareId);
  const compareView = compareLot ? views[compareLot.id] : undefined;
  // Soft warning from the land map (Natural Earth): NASA's coarse cells read inner seas and lakes as land. Shown
  // first under the tabs, because it is about this lot and asks for action; the no-soil note (sea or ice) wins.
  const onWater = useMemo(() => (lot ? lotLooksLikeWater(LAND_WATER, lot) : false), [lot]);
  // Floating controls (#165): the what-if belongs to each lot (null = today's climate), and the
  // sheet with every control opens from the "Adjust results" button that stays on screen.
  const [scenarios, setScenarios] = useState<Record<string, Scenario | null>>({});
  const [adjustOpen, setAdjustOpen] = useState(false);
  const scenario = lot ? (scenarios[lot.id] ?? null) : null;
  const setScenario = useCallback(
    (s: Scenario | null) => {
      if (lot) setScenarios((all) => ({ ...all, [lot.id]: s }));
    },
    [lot],
  );

  // The sample farm's numbers come from NASA POWER daily: its source chips say so (#144).
  return (
    <DemoDataContext.Provider value={lot?.data_ref.startsWith("demo/") ?? false}>
    <Screen
      width="wide"
      overlay={
        // Hidden while the lot comparison dialog is open, so it doesn't sit on top of it.
        lot && views[lot.id]?.kind === "ready" && !compareLot ? (
          <AdjustButton onPress={() => setAdjustOpen(true)} summary={adjustSummary(farm.priorities, scenario)} />
        ) : null
      }
    >
      <Header
        title="Your farm"
        right={<NasaDataButton />}
      />
      {lot ? (
        <>
          <LotTabs
            lots={farm.lots}
            selectedId={lot.id}
            onSelect={selectLot}
            onAdd={() => router.push({ pathname: "/lots", params: { new: "1" } })}
          />
          {onWater && views[lot.id]?.kind !== "no-soil" ? (
            <Narrow>
              <Notice tone="warn">
                {lot.name} looks like it is on water (sea or lake) on our map. If this is your farm, you can go on. If not, move the
                lot onto your farm.
              </Notice>
              <Button label={`Move ${lot.name} on the map`} variant="secondary" href={{ pathname: "/lots", params: { lot: lot.id } }} />
            </Narrow>
          ) : null}
          <LotResults
            key={lot.id}
            farm={farm}
            lot={lot}
            scenario={scenario}
            setScenario={setScenario}
            adjustOpen={adjustOpen}
            closeAdjust={() => setAdjustOpen(false)}
            overview={
              <>
                <FarmMapCard lots={farm.lots} views={views} selectedId={lot.id} onSelect={openLot} wide={wide} />
                {lotView?.kind === "ready" ? (
                  <Button
                    label={`Compare ${lot.name} with the best option`}
                    variant="secondary"
                    icon="shape"
                    onPress={() => setCompareId(lot.id)}
                    style={styles.compareButton}
                  />
                ) : null}
              </>
            }
          />
          {compareLot && compareView?.kind === "ready" ? (
            <LotCompareModal
              lot={compareLot}
              analysis={compareView.analysis}
              library={CROP_LIBRARY}
              cropName={cropName}
              period={compareView.period}
              onClose={() => setCompareId(null)}
            />
          ) : null}
        </>
      ) : (
        <Narrow>
          <Notice tone="warn">Draw your lots on the map first, then pick the crops for each lot.</Notice>
          <Button label="Draw your lots" href="/lots" />
        </Narrow>
      )}
      <View style={styles.footer}>
        <FooterLinks />
        <Disclaimer />
      </View>
    </Screen>
    </DemoDataContext.Provider>
  );
}

type LotResultsProps = {
  farm: Farm;
  lot: Lot;
  overview: ReactNode;
  scenario: Scenario | null;
  setScenario: (s: Scenario | null) => void;
  adjustOpen: boolean;
  closeAdjust: () => void;
};

function LotResults({ farm, lot, overview, scenario, setScenario, adjustOpen, closeAdjust }: LotResultsProps) {
  const view = useLotAnalysis(farm, lot, scenario);
  const updateLot = useFarmStore((s) => s.updateLot);
  const setPriorities = useFarmStore((s) => s.setPriorities);
  const { wide } = useLayout();

  // The farm map stays on the page while a lot is loading or has no results yet.
  const withOverview = (node: ReactNode) => (
    <>
      {node}
      {overview}
    </>
  );

  switch (view.kind) {
    case "loading":
      return withOverview(<Text style={text.caption}>Loading {lot.name}...</Text>);
    case "no-soil":
      // NASA has no soil wetness for the spot in any month: sea or ice (hasNoSoilData), so no crop is rated.
      return withOverview(
        <Narrow>
          <Notice tone="warn">
            NASA has no soil moisture data for {lot.name}. This spot looks like sea or ice, not farmland, so there are no
            results. Move the lot onto your farm. If your farm really is here, on a very small island, NASA has no data for it, so we can&apos;t rate it.
          </Notice>
          <Button label={`Move ${lot.name} on the map`} href={{ pathname: "/lots", params: { lot: lot.id } }} />
        </Narrow>
      );
    case "no-crops":
      return withOverview(
        <Narrow>
          <Notice tone="warn">Pick the crops you grow on {lot.name} to see its results.</Notice>
          <Button label="Pick crops" href={{ pathname: "/crops", params: { lot: lot.id } }} />
        </Narrow>
      );
    case "no-data":
      // The lot sync downloads pending lots by itself when the phone has signal.
      return withOverview(
        <Narrow>
          {view.status === "pending" ? (
            <Notice icon="clock">Getting NASA climate data for {lot.name}. It downloads by itself when the phone has signal.</Notice>
          ) : (
            <>
              <Notice tone="warn">We couldn&apos;t get NASA climate data for {lot.name}.</Notice>
              <Button label="Try again" variant="secondary" onPress={() => updateLot(lot.id, { data_status: "pending" })} />
            </>
          )}
        </Narrow>
      );
    case "failed":
      return withOverview(
        <Narrow>
          <Notice tone="warn">Something went wrong while working out the results for {lot.name}.</Notice>
        </Narrow>
      );
    case "ready": {
      const { analysis, period, months, data } = view;
      const fit = <CropFitCard fits={analysis.crop_fits} cropName={cropName} period={period} />;
      const soil = <SoilHealthChart result={analysis.soil_health} options={analysis.rotations.options} cropName={cropName} />;
      // Farm-wide choice (#40): the same chips on every lot tab; each lot re-ranks with it.
      const priorities = (
        <PrioritiesCard
          priorities={farm.priorities}
          onToggle={(key) => setPriorities(togglePriority(farm.priorities, key))}
          notScored={analysis.rotations.priorities_not_scored}
          period={period}
        />
      );
      const recommendations = (
        <RecommendationsCard
          options={analysis.rotations.options}
          explanations={analysis.explanations}
          componentsLeftOut={analysis.rotations.components_left_out}
          cropName={cropName}
          period={period}
          columns={wide ? 2 : 1}
        />
      );
      // S5 (#34, #95): always under Recommendations, on the usual months (assumed) until the farmer gives theirs.
      const monthsCompare =
        months.planting.seasons.length > 0 ? (
          <View style={styles.section}>
            <Text style={text.title} accessibilityRole="header">
              Your months vs better months
            </Text>
            <Text style={[text.body, { color: colors.muted }]}>
              Your planting months next to the best months we found for this lot from NASA rain and temperature data. You
              and your agricultural technician decide.
            </Text>
            <MonthsCompareList months={months} period={period} columns={wide ? 2 : 1} />
          </View>
        ) : null;
      const harvestCard = (
        <HarvestCard lot={lot} destinations={farm.destinations} harvest={analysis.harvest} cropName={cropName} period={period} />
      );
      const yearCalendar = (
        <YearCalendar options={analysis.rotations.options} lotName={lot.name} cropById={cropById} period={period} />
      );
      const whatIf = (
        <WhatIfCard scenario={scenario} onChange={setScenario} notes={analysis.scenario?.notes ?? []} period={period} />
      );
      // NASA satellite checks (IMERG rain, SMAP soil moisture) are bundled for the sample farm only (#144).
      const satellite =
        data.kind === "demo" ? <SatelliteCard farmId={data.id} lotName={lot.name} info={{ id: "satellite-checks", period }} /> : null;
      const trace = <DataTracePanel data={data} />;
      const a = analysis.rotations.options.find((o) => o.key === "A");
      const pick = topPick(analysis.rotations.options);
      const topCard = pick ? (
        <TopPickCard
            lotName={lot.name}
            pick={pick}
            a={a}
            explanation={analysis.explanations.find((e) => e.option_key === pick.key)}
            cropName={cropName}
          monthsHref={analysis.stage === 1 ? { pathname: "/months", params: { lot: lot.id } } : undefined}
          wide={wide}
          componentsLeftOut={analysis.rotations.components_left_out}
        />
      ) : null;
      const monthsHref = { pathname: "/months", params: { lot: lot.id } } as const;
      return (
        <>
          {scenario ? (
            <Narrow>
              <Notice tone="warn" icon="alert">
                {`What-if on: ${describeScenario(scenario)}. The results below are for this what-if, not a forecast.`}
              </Notice>
              <Button label="Back to today's climate" variant="secondary" onPress={() => setScenario(null)} />
            </Narrow>
          ) : null}
          {topCard}
          <ElNinoNotice />
          {recommendations}
          {yearCalendar}
          {monthsCompare}
          {fit}
          {soil}
          {overview}
          {harvestCard}
          <MonthsPrompt lot={lot} stage={analysis.stage} />
          <AdjustSheet visible={adjustOpen} onClose={closeAdjust}>
            {priorities}
            {whatIf}
            <View style={styles.sheetLinks}>
              <Button
                label={analysis.stage === 1 ? "Give your planting months" : "Change your planting months"}
                variant="secondary"
                onPress={() => {
                  closeAdjust();
                  router.push(monthsHref);
                }}
              />
              <Button label="Add a place where you sell or store your harvest" variant="secondary"
                onPress={() => {
                  closeAdjust();
                  router.push("/places");
                }}
              />
            </View>
          </AdjustSheet>
          <PanelLot
            lotName={lot.name}
            period={period}
            demo={data.kind === "demo"}
            extra={
              <>
                {satellite}
                {trace}
              </>
            }
          />
        </>
      );
    }
  }
}

/**
 * The Continue prompt at the end of the dashboard (docs/11-user-flow.md S3 → S4): give your
 * planting months for a sharper comparison, or Later. Once months are given, a way to change them.
 */
function MonthsPrompt({ lot, stage }: { lot: Lot; stage: 1 | 2 }) {
  const [later, setLater] = useState(false);
  if (stage === 1 && later) return null;
  const listed = lot.crops.filter((c) => !isOtherCrop(c.crop_id));
  const given = listed.filter((c) => c.seasons.length > 0);
  const usual = listed.filter((c) => c.seasons.length === 0);
  const short = (id: string) => shortCropName(cropName(id));
  return (
    <Narrow>
      <View style={styles.prompt}>
        <Text style={text.heading} accessibilityRole="header">
          {stage === 1 ? "Want a sharper comparison?" : "Your planting months"}
        </Text>
        <Text style={text.body}>
          {stage === 1
            ? `Tell us which months you plant on ${lot.name}. Option A then uses your months instead of the usual ones.`
            : `Option A uses your months: ${given.map((c) => `${short(c.crop_id)} ${seasonsText(c.seasons)}`).join("; ")}.` +
              (usual.length > 0
                ? ` ${usual.map((c) => short(c.crop_id)).join(", ")} ${usual.length === 1 ? "keeps" : "keep"} the usual months (assumed).`
                : "")}
        </Text>
        {/* Stage 2: the comparison itself is above (S5 under Recommendations), so only the change button. */}
        <View style={stage === 1 ? styles.promptRow : styles.promptCol}>
          {stage === 1 ? (
            <>
              <Button
                label="Continue"
                iconAfter="chevron"
                href={{ pathname: "/months", params: { lot: lot.id } }}
                style={styles.col}
              />
              <Button label="Later" variant="quiet" onPress={() => setLater(true)} style={styles.col} />
            </>
          ) : (
            <>
              <Button
                label="Change your months"
                variant="secondary"
                href={{ pathname: "/months", params: { lot: lot.id } }}
              />
            </>
          )}
        </View>
      </View>
    </Narrow>
  );
}

/**
 * Tells the NASA data panel (#165) which lot the dashboard shows, and hands it the cards that
 * live there (satellite checks, NASA requests). Renders nothing itself.
 */
function PanelLot({ lotName, period, demo, extra }: { lotName: string; period: string; demo: boolean; extra: ReactNode }) {
  useEffect(() => {
    const sources: SourceKey[] = demo ? ["power-daily", "srtm", "imerg", "smap"] : ["power"];
    setPanelContext({ lotName, period, demo, sources, extra });
  });
  return null;
}

/** Keeps messages and buttons at reading width on a wide screen. */
function Narrow({ children }: { children: ReactNode }) {
  return <View style={styles.narrow}>{children}</View>;
}

const styles = StyleSheet.create({
  // Each card keeps its own height, so a short card doesn't get an empty stretched bottom.
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  compareButton: { alignSelf: "flex-start" },
  col: { flex: 1, minWidth: 0 },
  section: { gap: space.lg },
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
  sheetLinks: { gap: space.sm },
  footer: { gap: space.xs, marginTop: space.lg },
});
