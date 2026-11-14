import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropFitList } from "../src/components/CropFitList";
import { Disclaimer } from "../src/components/Disclaimer";
import { FieldYear } from "../src/components/FieldYear";
import { Header } from "../src/components/Header";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { PLAN_NAME } from "../src/components/field-year-core";
import { PlanDetail } from "../src/components/PlanDetail";
import { chosenPriorities, unavailablePriorities, verdictText } from "../src/components/plan-text";
import { PriorityChips } from "../src/components/PriorityChips";
import { Screen } from "../src/components/Screen";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { colors, radius, space, text, TWO_COLUMN_MIN } from "../src/components/theme";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { cropById } from "../src/data/crops";
import type { LotAnalysis, OptionKey } from "../src/engine";
import { isDemoFarm } from "../src/state/demo-farm";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Farm, Lot, Priorities } from "../src/types";

// S3 Dashboard (#29, docs/11-user-flow.md): results per lot, worked out on the phone from the
// lot's NASA data. What matters to you, the field-year comparison of the plans (the farmer's
// own crops plus the alternatives), one plan in detail (why, gains, losses, unknowns, what to
// check locally, sources), how the farmer's crops fit, and the 3-year Soil Health card (#43).

const cropName = (id: string) => cropById(id)?.name ?? id;
const LAND = { lowland: "Lowland", upland: "Upland", sloping: "Sloping", unknown: "Land type not given" } as const;
const WATER = { rain: "rain only", some: "some irrigation", full: "full irrigation", unknown: "water source not given" } as const;

export default function DashboardScreen() {
  const farm = useFarm();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];

  return (
    <Screen wide footer={<Disclaimer />}>
      <Header title="Your farm" />
      {lot ? (
        <>
          {isDemoFarm(farm.lots) ? (
            <Notice icon="info">
              This is the demo farm, a made-up two-lot farm in Lanao del Norte. Its numbers are real NASA data for that place.
            </Notice>
          ) : null}
          <View style={styles.lotRow}>
            <LotTabs lots={farm.lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
            <Text style={text.small}>
              <Text style={styles.strong}>{lot.area_ha} ha</Text>
              {`  ${LAND[lot.details.land_type]}, ${WATER[lot.details.water]}`}
            </Text>
          </View>
          <LotResults key={lot.id} farm={farm} lot={lot} />
        </>
      ) : (
        <>
          <Notice tone="warn">Draw your lots on the map first, then pick the crops for each lot.</Notice>
          <Button label="Draw your lots" href="/lots" />
        </>
      )}
    </Screen>
  );
}

function LotResults({ farm, lot }: { farm: Farm; lot: Lot }) {
  const view = useLotAnalysis(farm, lot);
  const updateLot = useFarmStore((s) => s.updateLot);

  switch (view.kind) {
    case "loading":
      return <Text style={text.caption}>Loading {lot.name}...</Text>;
    case "no-crops":
      return (
        <>
          <Notice tone="warn">Pick the crops you grow on {lot.name} to see its results.</Notice>
          <Button label="Pick crops" href="/crops" />
        </>
      );
    case "no-data":
      // The lot sync downloads pending lots by itself when the phone has signal.
      return view.status === "pending" ? (
        <Notice icon="clock">Getting NASA climate data for {lot.name}. It downloads by itself when the phone has signal.</Notice>
      ) : (
        <>
          <Notice tone="warn">We couldn&apos;t get NASA climate data for {lot.name}.</Notice>
          <Button label="Try again" variant="secondary" onPress={() => updateLot(lot.id, { data_status: "pending" })} />
        </>
      );
    case "failed":
      return <Notice tone="warn">Something went wrong while working out the results for {lot.name}.</Notice>;
    case "ready":
      return <Results farm={farm} analysis={view.analysis} />;
  }
}

function Results({ farm, analysis }: { farm: Farm; analysis: LotAnalysis }) {
  const setPriorities = useFarmStore((s) => s.setPriorities);
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
  const verdict = verdictText({
    chosen: chosenPriorities(farm.priorities).filter((k) => !unavailable.includes(k)),
    bestKey: best.key,
    bestName: PLAN_NAME[best.kind],
    bestTotal: best.total,
    baselineTotal: baseline.total,
    bestIsBaseline: best.key === baseline.key,
  });

  const compare = (
    <>
      <View style={styles.intro}>
        <Text style={text.heading} accessibilityRole="header">
          Your year next to {options.length - 1} other {options.length - 1 === 1 ? "plan" : "plans"}
        </Text>
        <Text style={[text.small, styles.muted]}>
          Each row is one year on this lot. Tap a plan to see why it was suggested and what to check first.
        </Text>
      </View>
      <FieldYear options={options} selected={selected.key} onSelect={setPicked} precip={analysis.monthly.precip_mm} cropById={cropById} />
      <Text style={text.caption}>
        Climate numbers are from NASA POWER for a grid cell about 50 km across, not your exact field.
      </Text>
    </>
  );
  const detail = (
    <PlanDetail
      option={selected}
      baseline={baseline}
      explanation={analysis.explanations.find((e) => e.option_key === selected.key)}
      leftOut={analysis.rotations.components_left_out}
      cropById={cropById}
    />
  );
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
      </View>
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {compare}
            {rest}
          </View>
          <View style={styles.column}>{detail}</View>
        </View>
      ) : (
        <>
          {compare}
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
  verdict: { borderLeftWidth: 4, borderLeftColor: colors.green, backgroundColor: colors.greenTint, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  verdictText: { ...text.heading, fontWeight: "600" },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: space.xl },
  column: { flex: 1, gap: space.lg, minWidth: 0 },
});
