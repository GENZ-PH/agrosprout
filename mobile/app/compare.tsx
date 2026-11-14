import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { MonthsCompareList } from "../src/components/SeasonCompareCard";
import { colors, text } from "../src/components/theme";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { useFarm } from "../src/state/farm-store";
import type { Farm, Lot } from "../src/types";

// S5 Your months vs better months (#34, #95, docs/11-user-flow.md S5). For each season the
// farmer gave on S4: their months next to the best months the engine's planting-window scan
// found on this lot (`analysis.planting`), with why, what we don't know, and what to check.
// A "blocked" month (it would clash with another season of theirs) is a trade-off, never a
// move: there is no button that moves a season. Opened as /compare?lot=<id> from S4's Next; the
// dashboard shows the same cards under Recommendations. The whole-lot calendar (docs/11) is not built yet.

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

  const { months, period } = view;
  if (months.planting.seasons.length === 0)
    return (
      <>
        <Notice tone="warn">There is nothing to compare on {lot.name} yet. Give your planting months.</Notice>
        {monthsLink}
      </>
    );

  return (
    <>
      <MonthsCompareList months={months} period={period} />
      {monthsLink}
    </>
  );
}
