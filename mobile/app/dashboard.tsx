import { Redirect, router, useLocalSearchParams } from "expo-router";
import { tr } from "../src/i18n/lang-store";
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { describeScenario } from "../src/components/what-if-core";
import { AdjustButton, AdjustSheet } from "../src/components/AdjustControls";
import { adjustSummary } from "../src/components/adjust-core";
import { Button } from "../src/components/Button";
import { CropFitCard } from "../src/components/CropFitCard";
import { FarmMapCard } from "../src/components/FarmMapCard";
import { Header } from "../src/components/Header";
import { LeaveFarmDialog } from "../src/components/LeaveFarmDialog";
import { isDemoFarm } from "../src/state/demo-farm-core";
import { HarvestCard } from "../src/components/HarvestCard";
import { Icon, type IconName } from "../src/components/Icon";
import { NasaDataButton } from "../src/components/NasaDataButton";
import { openOverview, setPanelContext, showOverview } from "../src/components/inspector-store";
import { canDock } from "../src/components/SourceInspector";
import type { SourceKey } from "../src/content/sources";
import { WhatIfCard } from "../src/components/WhatIfCard";
import { DataTracePanel } from "../src/components/DataTracePanel";
import { ElNinoNotice } from "../src/components/ElNinoNotice";
import { SatelliteCard } from "../src/components/SatelliteCard";
import { useLiveSatellite } from "../src/data/live-satellite";
import type { LotData } from "../src/types";
import { CheckedAgainstContext, DemoDataContext, SatelliteContext } from "../src/components/SourceChip";
import { satelliteYearFacts } from "../src/components/satellite-facts";
import { SATELLITE } from "../src/data/satellite";
import { YearCalendar } from "../src/components/YearCalendar";
import { SectionSI } from "../src/components/SectionSI";
import { fitFacts, monthsFacts, recommendationFacts, section, soilFacts } from "../src/components/panel-si";
import type { Scenario } from "../src/engine/scenario";
import { LotCompareModal } from "../src/components/LotCompareModal";
import { LotTabs } from "../src/components/LotTabs";
import { LandCard, LandSheet, detailsSummary, unknownDetails } from "../src/components/LandQuestions";
import { Notice } from "../src/components/Notice";
import { PrioritiesCard } from "../src/components/PrioritiesCard";
import { togglePriority } from "../src/components/priorities-core";
import { RecommendationsCard } from "../src/components/RecommendationsCard";
import { shortCropName, topPick } from "../src/components/recommendations-core";
import { Screen } from "../src/components/Screen";
import { MonthsCompareList } from "../src/components/SeasonCompareCard";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { FarmerSuggestion } from "../src/components/FarmerSuggestion";
import { FadeIn, LotSkeleton } from "../src/components/Skeleton";
import { longerSeasons } from "../src/components/farmer-core";
import { colors, MAX_CONTENT_WIDTH, radius, space, text } from "../src/components/theme";
import { useLayout } from "../src/components/useLayout";
import { useFarmLotViews, useLotAnalysis } from "../src/components/useLotAnalysis";
import { LAND_WATER } from "../src/data/land-water";
import { lotLooksLikeWater } from "../src/lots/land-water-core";
import { CROP_LIBRARY, cropById } from "../src/data/crops";
import { cropNeedingMonth, cropShortName, isOtherCrop } from "../src/lots/crop-picks";
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
  const updateLotName = useFarmStore((s) => s.updateLot);
  const views = useFarmLotViews(farm);
  const { wide, width, contentWidth } = useLayout();
  // The lot tabs sit beside the title when there is room, else on their own row under it.
  // Two rows at every width (2026-11-15): logo, title and Technical data, then the lot tabs.
  const oneRowHeader = false;
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
  // Back on the dashboard asks: edit the farm, start over, or stay (the start screen would send a
  // returning farmer straight back here).
  const [leaving, setLeaving] = useState(false);
  // Which NASA satellite datasets have arrived for this lot (D35), for the "Checked against" chips.
  const lotData = lotView?.kind === "ready" ? lotView.data : undefined;
  const liveSat = useLiveSatellite(lotData);
  const checkedAgainst = useMemo(() => {
    const f = lotData?.kind === "demo" ? SATELLITE[lotData.id] : liveSat?.files;
    if (!f) return [] as SourceKey[];
    const out: SourceKey[] = [];
    if (f.imerg) out.push("imerg");
    if (f.smap) out.push("smap");
    if (f.fldas) out.push("fldas");
    if (f.ndvi) out.push("modis");
    if (f.hls) out.push("hls");
    if (f.ecostress) out.push("ecostress");
    if (lotData?.kind === "demo" || liveSat?.srtm) out.push("srtm");
    return out;
  }, [lotData, liveSat]);
  // The files themselves, for the SI notes and their sources; a drawn lot's once nothing is still on its way.
  const satFiles = lotData?.kind === "demo" ? (SATELLITE[lotData.id] ?? null) : liveSat && liveSat.waiting.length === 0 ? liveSat.files : null;
  const scenario = lot ? (scenarios[lot.id] ?? null) : null;
  const setScenario = useCallback(
    (s: Scenario | null) => {
      if (lot) setScenarios((all) => ({ ...all, [lot.id]: s }));
    },
    [lot],
  );

  // Nothing to show yet (no lot with crops, e.g. a shared /dashboard link on a new phone): the
  // dashboard is not a starting point, so go to the welcome screen (S0), where Start begins.
  if (!farm.lots.some((l) => l.crops.length > 0)) return <Redirect href="/" />;

  // The sample farm's numbers come from NASA POWER daily: its source chips say so (#144).
  return (
    <DemoDataContext.Provider value={lot?.data_ref.startsWith("demo/") ?? false}>
    <CheckedAgainstContext.Provider value={checkedAgainst}>
    <SatelliteContext.Provider value={satFiles}>
    <Screen
      width="wide"
      links
      header={
        // Fixed at the top (2026-11-15): the title, the lot tabs and the NASA data button stay in
        // reach while the farmer scrolls. One row on a wide window, two rows on a phone.
        (() => {
          const tabs = lot ? (
            <LotTabs
              lots={farm.lots}
              selectedId={lot.id}
              onSelect={selectLot}
              onAdd={() => router.push({ pathname: "/lots", params: { new: "1" } })}
              onRename={(id, name) => updateLotName(id, { name })}
            />
          ) : null;
          return oneRowHeader ? (
            <Header logo title={tr("Your farm")} middle={tabs} right={<NasaDataButton />} onBack={() => setLeaving(true)} />
          ) : (
            <>
              <Header logo title={contentWidth >= 520 ? tr("Your farm") : ""} right={<NasaDataButton />} onBack={() => setLeaving(true)} />
              {tabs}
            </>
          );
        })()
      }
      overlay={
        // Hidden while the lot comparison dialog is open, so it doesn't sit on top of it.
        lot && views[lot.id]?.kind === "ready" && !compareLot ? (
          <AdjustButton onPress={() => setAdjustOpen(true)} summary={adjustSummary(farm.priorities, scenario)} />
        ) : null
      }
    >
      {lot ? (
        <>
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
      <LeaveFarmDialog open={leaving} onClose={() => setLeaving(false)} sample={isDemoFarm(farm.lots)} />
    </Screen>
    </SatelliteContext.Provider>
    </CheckedAgainstContext.Provider>
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
  const satFiles = useContext(SatelliteContext);
  const updateLot = useFarmStore((s) => s.updateLot);
  const setPriorities = useFarmStore((s) => s.setPriorities);
  // Land type, water and soil (2026-11-15): asked on the dashboard so lots don't stay at "I don't know".
  const [landOpen, setLandOpen] = useState(false);

  // The farm map stays on the page while a lot is loading or has no results yet.
  const withOverview = (node: ReactNode) => (
    <>
      {node}
      {overview}
    </>
  );

  switch (view.kind) {
    case "loading":
      return withOverview(<LotSkeleton lotName={lot.name} />);
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
              <Button label={tr("Try again")} variant="secondary" onPress={() => updateLot(lot.id, { data_status: "pending" })} />
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
      // The NASA cell's average height (POWER caveat) explains "cooler than it likes" on a lowland lot.
      const heightNote = data.caveats.find((c) => /elevation/i.test(c) && /average/i.test(c));
      const fit = <CropFitCard fits={analysis.crop_fits} cropName={cropName} period={period} note={heightNote} />;
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
          columns={1}
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
            <MonthsCompareList months={months} period={period} columns={1} />
          </View>
        ) : null;
      const harvestCard = (
        <HarvestCard lot={lot} destinations={farm.destinations} harvest={analysis.harvest} cropName={cropName} period={period} />
      );
      const yearCalendar = (
        <YearCalendar
          options={analysis.rotations.options}
          lotName={lot.name}
          cropById={cropById}
          period={period}
          initialKey={topPick(analysis.rotations.options)?.key}
          monthly={data.monthly}
          whatIf={scenario !== null}
        />
      );
      const whatIf = (
        <WhatIfCard scenario={scenario} onChange={setScenario} notes={analysis.scenario?.notes ?? []} period={period} />
      );
      // NASA satellite checks (IMERG rain, SMAP soil moisture, MODIS and HLS NDVI, ECOSTRESS, FLDAS): bundled for the sample farm (#144), fetched live through the API Worker for drawn lots.
      // Live lots (2026-11-15): the same checks, fetched through our API Worker for the rounded point.
      const satellite =
        data.kind === "demo" ? (
          <SatelliteCard farmId={data.id} lotName={lot.name} info={{ id: "satellite-checks", period }} />
        ) : (
          <LiveSatelliteCard data={data} lotName={lot.name} period={period} />
        );
      const trace = <DataTracePanel data={data} />;
      const a = analysis.rotations.options.find((o) => o.key === "A");
      const pick = topPick(analysis.rotations.options);
      const topCard = pick ? (
        <FarmerSuggestion
          lotName={lot.name}
          pick={pick}
          a={a}
          explanation={analysis.explanations.find((e) => e.option_key === pick.key)}
          cropName={cropName}
          cropById={cropById}
          componentsLeftOut={analysis.rotations.components_left_out}
          longer={longerSeasons(lot, cropById)}
          whatIf={scenario !== null}
          monthly={data.monthly}
        />
      ) : null;
      const monthsHref = { pathname: "/months", params: { lot: lot.id } } as const;
      const shortName = (id: string) => cropById(id)?.name.replace(/\s*\(.*\)\s*$/, "").trim() || id;
      // A crop grown year-round and no planting month from the farmer: ask for it (2026-11-15).
      const needMonth = cropNeedingMonth(lot, cropById);
      const panelSections = [
        section("plans", "Recommendations: your crops and three other plans", recommendationFacts(analysis.rotations.options, shortName)),
        section("months", "Your months vs better months", [...monthsFacts(months.planting.seasons, shortName), ...satelliteYearFacts(satFiles).slice(0, 2)]),
        section("fit", "How each of your crops fits this lot", fitFacts(analysis.crop_fits, shortName)),
        section("soil", "Soil health over the years, by plan", soilFacts(analysis.soil_health)),
        section("satellite", "NASA satellite checks for this lot (they do not change the scores)", satelliteYearFacts(satFiles)),
      ];
      return (
        <>
          {scenario ? (
            <Narrow>
              <Notice tone="warn" icon="alert">
                {`What-if on: ${describeScenario(scenario)}. The results below are for this what-if, not a forecast.`}
              </Notice>
              <Button label={tr("Back to today's climate")} variant="secondary" onPress={() => setScenario(null)} />
            </Narrow>
          ) : null}
          {/* Farmer first (dashboard audit 2026-11-15): the answer, the year, then what the farmer can do.
              The other plans, scores, evidence and charts live in the NASA data panel
              ("Details for your technician"), docked beside the page on a big window. The farm map
              with its NASA layer switcher stays in the main column (2026-11-15). */}
          <FadeIn>
          {needMonth ? (
            <Narrow>
              <Notice tone="warn" icon="alert">
                {`We don't know when you plant ${cropShortName(needMonth)} on ${lot.name}, so "You now" is empty and the plans are not compared with your crop yet. ${cropShortName(needMonth)} can be planted at different times of the year.`}
              </Notice>
              <Button
                label={`Tell us when you plant ${cropShortName(needMonth)}`}
                onPress={() => router.push({ pathname: "/crops", params: { lot: lot.id } })}
              />
            </Narrow>
          ) : null}
          {topCard}
          {yearCalendar}
          {unknownDetails(lot.details) > 0 ? (
            <Narrow>
              <LandCard lotName={lot.name} details={lot.details} onOpen={() => setLandOpen(true)} />
            </Narrow>
          ) : null}
          {overview}
          <ElNinoNotice />
          {/* With a place added, the travel times are worth a card; without one, it is a next step. */}
          {farm.destinations.length > 0 ? harvestCard : null}
          <NextSteps lot={lot} stage={analysis.stage} hasPlaces={farm.destinations.length > 0} onLand={() => setLandOpen(true)} />
          </FadeIn>
          <LandSheet
            visible={landOpen}
            onClose={() => setLandOpen(false)}
            lotName={lot.name}
            details={lot.details}
            onChange={(details) => updateLot(lot.id, { details })}
          />
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
            details={
              <>
                {/* SI per section (2026-11-15): one plain insight at the top of each, all from one call. */}
                <SectionSI sections={panelSections} index={0} whatIf={scenario !== null} />
                {recommendations}
                {monthsCompare ? <SectionSI sections={panelSections} index={1} whatIf={scenario !== null} /> : null}
                {monthsCompare}
                <SectionSI sections={panelSections} index={2} whatIf={scenario !== null} />
                {fit}
                <SectionSI sections={panelSections} index={3} whatIf={scenario !== null} />
                {soil}
              </>
            }
            extra={
              <>
                <SectionSI sections={panelSections} index={4} whatIf={scenario !== null} />
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
 * "Next steps" at the end of the dashboard (2026-11-15): one list of things the farmer can do, in
 * place of separate cards of different sizes. Planting months (docs/11-user-flow.md S3 → S4), a
 * place to sell (S6, only until one is added), and the details for their technician.
 */
function NextSteps({ lot, stage, hasPlaces, onLand }: { lot: Lot; stage: 1 | 2; hasPlaces: boolean; onLand: () => void }) {
  const unknown = unknownDetails(lot.details);
  const summary = detailsSummary(lot.details);
  const listed = lot.crops.filter((c) => !isOtherCrop(c.crop_id));
  const given = listed.filter((c) => c.seasons.length > 0);
  const short = (id: string) => shortCropName(cropName(id));
  const rows: { key: string; icon: IconName; title: string; body: string; onPress: () => void }[] = [
    stage === 1
      ? {
          key: "months",
          icon: "sprout",
          title: "Tell us your planting months",
          body: `For a sharper comparison: "Your crops" then uses your months on ${lot.name} instead of the usual ones.`,
          onPress: () => router.push({ pathname: "/months", params: { lot: lot.id } }),
        }
      : {
          key: "months",
          icon: "sprout",
          title: "Your planting months",
          body: given.map((c) => `${short(c.crop_id)} ${seasonsText(c.seasons)}`).join("; ") + ". Tap to change.",
          onPress: () => router.push({ pathname: "/months", params: { lot: lot.id } }),
        },
    {
      key: "land",
      icon: "sprout",
      title: unknown > 0 ? "Tell us about your land" : "Your land, water and soil",
      body:
        unknown > 0
          ? `Land type, water and soil on ${lot.name}: ${unknown} of 3 not given yet, so the results are less certain.`
          : `${summary ?? ""}. Tap to change.`,
      onPress: onLand,
    },
    ...(hasPlaces
      ? []
      : [
          {
            key: "places",
            icon: "pin" as IconName,
            title: "Add where you sell your harvest",
            body: "Then travel time to market counts in the results.",
            onPress: () => router.push("/places"),
          },
        ]),
    {
      key: "details",
      icon: "info",
      title: "Details for your technician",
      body: "Every plan, its scores and the NASA data behind them.",
      onPress: showOverview,
    },
  ];
  return (
    <View style={styles.steps}>
      <Text style={[text.heading, styles.stepsTitle]} accessibilityRole="header">
        {tr("Next steps")}
      </Text>
      {rows.map((r, i) => (
        <Pressable
          key={r.key}
          onPress={r.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.step, i > 0 && styles.stepLine, pressed && styles.stepPressed]}
        >
          <View style={styles.stepIcon}>
            <Icon name={r.icon} size={20} color={colors.green} />
          </View>
          <View style={styles.col}>
            <Text style={text.bodyStrong}>{r.title}</Text>
            <Text style={text.caption}>{r.body}</Text>
          </View>
          <Icon name="chevron" size={20} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Tells the NASA data panel (#165) which lot the dashboard shows, and hands it the cards that
 * live there (satellite checks, NASA requests). Renders nothing itself.
 */
function PanelLot({ lotName, period, demo, extra, details }: { lotName: string; period: string; demo: boolean; extra: ReactNode; details: ReactNode }) {
  // The panel renders outside this screen's tree, so hand it the same chip contexts (the sample
  // farm's "daily" chips and the "Checked against" datasets) around what it shows.
  const isDemo = useContext(DemoDataContext);
  const checked = useContext(CheckedAgainstContext);
  const sat = useContext(SatelliteContext);
  const wrap = (node: ReactNode) => (
    <DemoDataContext.Provider value={isDemo}>
      <CheckedAgainstContext.Provider value={checked}>
        <SatelliteContext.Provider value={sat}>{node}</SatelliteContext.Provider>
      </CheckedAgainstContext.Provider>
    </DemoDataContext.Provider>
  );
  useEffect(() => {
    const sources: SourceKey[] = demo
      ? ["power-daily", "srtm", "imerg", "smap", "modis", "hls", "ecostress", "fldas"]
      : ["power", "srtm", "imerg", "smap", "modis", "hls", "ecostress", "fldas"];
    setPanelContext({ lotName, period, demo, sources, extra: wrap(extra), details: wrap(details) });
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
  sheetLinks: { gap: space.sm },
  steps: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  stepsTitle: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  step: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md },
  stepLine: { borderTopWidth: 1, borderTopColor: colors.border },
  stepPressed: { backgroundColor: colors.pressed },
  stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint },
});

/** Satellite checks for a drawn lot, fetched through our API Worker (2026-11-15). */
function LiveSatelliteCard({ data, lotName, period }: { data: LotData; lotName: string; period: string }) {
  const live = useLiveSatellite(data);
  if (!live) return null;
  return <SatelliteCard farmId={data.id} lotName={lotName} info={{ id: "satellite-checks", period }} files={live.files} live={live} />;
}
