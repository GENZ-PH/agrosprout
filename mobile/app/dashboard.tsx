import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropFitCard } from "../src/components/CropFitCard";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { RecommendationsCard } from "../src/components/RecommendationsCard";
import { Screen } from "../src/components/Screen";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { MAX_CONTENT_WIDTH, space, text } from "../src/components/theme";
import { useLayout } from "../src/components/useLayout";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { cropById } from "../src/data/crops";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Farm, Lot } from "../src/types";

// S3 Dashboard (#29, docs/11-user-flow.md): results per lot, worked out on the phone from the
// lot's NASA data. So far: the lot tabs, Your crops here, Recommendations (options A-D with
// their explanations) and the 3-year Soil Health card (#43). The other S3 cards (lot snapshot,
// soil moisture, getting your harvest out, continue prompt) go in LotResults too.
// `useLotAnalysis` already returns everything they need (`LotAnalysis` in src/engine/analyze.ts).
//
// Big screens (#114): on a laptop window (expanded, >= 840 dp) the page widens to 1200 px, Your
// crops here and Soil Health sit side by side, and the Recommendations options go two per row.
// Phones keep one column in the same order as before. Messages and buttons stay in the narrow
// reading column so they don't stretch across a wide window.

const cropName = (id: string) => cropById(id)?.name ?? id;

export default function DashboardScreen() {
  const farm = useFarm();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];

  return (
    <Screen width="wide" footer={<Disclaimer />}>
      <Header title="Your farm" />
      {lot ? (
        <>
          <LotTabs lots={farm.lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
          <LotResults key={lot.id} farm={farm} lot={lot} />
        </>
      ) : (
        <Narrow>
          <Notice tone="warn">Draw your lots on the map first, then pick the crops for each lot.</Notice>
          <Button label="Draw your lots" href="/lots" />
        </Narrow>
      )}
    </Screen>
  );
}

function LotResults({ farm, lot }: { farm: Farm; lot: Lot }) {
  const view = useLotAnalysis(farm, lot);
  const updateLot = useFarmStore((s) => s.updateLot);
  const { wide } = useLayout();

  switch (view.kind) {
    case "loading":
      return <Text style={text.caption}>Loading {lot.name}...</Text>;
    case "no-crops":
      return (
        <Narrow>
          <Notice tone="warn">Pick the crops you grow on {lot.name} to see its results.</Notice>
          <Button label="Pick crops" href="/crops" />
        </Narrow>
      );
    case "no-data":
      // The lot sync downloads pending lots by itself when the phone has signal.
      return (
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
      return (
        <Narrow>
          <Notice tone="warn">Something went wrong while working out the results for {lot.name}.</Notice>
        </Narrow>
      );
    case "ready": {
      const { analysis, period } = view;
      const fit = <CropFitCard fits={analysis.crop_fits} cropName={cropName} period={period} />;
      const soil = <SoilHealthChart result={analysis.soil_health} options={analysis.rotations.options} cropName={cropName} />;
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
      return (
        <>
          {analysis.stage === 1 ? (
            <Notice tone="warn">
              Option A (Your crops) uses typical planting months for now, so it is an assumption. You can give your own
              months later.
            </Notice>
          ) : null}
          {wide ? (
            <>
              <View style={styles.row}>
                <View style={styles.col}>{fit}</View>
                <View style={styles.col}>{soil}</View>
              </View>
              {recommendations}
            </>
          ) : (
            <>
              {fit}
              {recommendations}
              {soil}
            </>
          )}
        </>
      );
    }
  }
}

/** Keeps messages and buttons at reading width on a wide screen. */
function Narrow({ children }: { children: ReactNode }) {
  return <View style={styles.narrow}>{children}</View>;
}

const styles = StyleSheet.create({
  // Each card keeps its own height, so a short card doesn't get an empty stretched bottom.
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  col: { flex: 1, minWidth: 0 },
  narrow: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, gap: space.lg },
});
