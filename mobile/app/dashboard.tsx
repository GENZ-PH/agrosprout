import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { SoilHealthChart } from "../src/components/SoilHealthChart";
import { text } from "../src/components/theme";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { cropById } from "../src/data/crops";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Farm, Lot } from "../src/types";

// S3 Dashboard (#29, docs/11-user-flow.md): results per lot, worked out on the phone from the
// lot's NASA data. So far: the lot tabs and the 3-year Soil Health card (#43). The other S3 cards
// (lot snapshot, soil moisture, your crops here, getting your harvest out, recommendations,
// continue prompt) go in LotResults, above the Soil Health card. `useLotAnalysis` already returns
// everything they need (`LotAnalysis` in src/engine/analyze.ts).

const cropName = (id: string) => cropById(id)?.name ?? id;

export default function DashboardScreen() {
  const farm = useFarm();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];

  return (
    <Screen footer={<Disclaimer />}>
      <Header title="Your farm" />
      {lot ? (
        <>
          <LotTabs lots={farm.lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
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
      return (
        <>
          {view.analysis.stage === 1 ? (
            <Notice tone="warn">
              Option A (Your crops) uses typical planting months for now, so it is an assumption. You can give your own
              months later.
            </Notice>
          ) : null}
          <SoilHealthChart
            result={view.analysis.soil_health}
            options={view.analysis.rotations.options}
            cropName={cropName}
          />
        </>
      );
  }
}
