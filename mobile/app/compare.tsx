import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { LotTabs } from "../src/components/LotTabs";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { MonthsCompareList } from "../src/components/SeasonCompareCard";
import { colors, MAX_CONTENT_WIDTH, space, text } from "../src/components/theme";
import { useLayout } from "../src/components/useLayout";
import { useLotAnalysis } from "../src/components/useLotAnalysis";
import { useFarm } from "../src/state/farm-store";
import type { Farm, Lot } from "../src/types";

// S5 Your months vs better months (#34, #95, docs/11-user-flow.md S5). For each season the
// farmer gave on S4: their months next to the best months the engine's planting-window scan
// found on this lot (`analysis.planting`), with why, what we don't know, and what to check.
// A "blocked" month (it would clash with another season of theirs) is a trade-off, never a
// move: there is no button that moves a season. Opened as /compare?lot=<id> from S4's Next; the
// dashboard shows the same cards under Recommendations. The whole-lot calendar (docs/11) is not built yet.
//
// Big screens (#114): on a laptop window (expanded) the page widens like the dashboard and the
// season cards go two per row. Text, notices and buttons stay at reading width. Phones are unchanged.

export default function CompareScreen() {
  const farm = useFarm();
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = farm.lots.find((l) => l.id === lotParam) ?? farm.lots[0];
  const { wide } = useLayout();

  return (
    <Screen
      width={wide ? "wide" : "narrow"}
      footer={
        <Narrow>
          {lot ? (
            <Button
              label="Done: see your results"
              iconAfter="chevron"
              size="lg"
              onPress={() => router.dismissTo({ pathname: "/dashboard", params: { lot: lot.id } })}
            />
          ) : null}
          <Disclaimer />
        </Narrow>
      }
    >
      <Header title="Your months vs better months" fallbackHref="/dashboard" />
      {!lot ? (
        <Text style={text.body}>Draw a lot and pick its crops first.</Text>
      ) : (
        <>
          <Narrow>
            <Text style={[text.body, { color: colors.muted }]}>
              For each season you gave, your planting months next to the best months we found for this lot from NASA
              rain and temperature data.
            </Text>
          </Narrow>
          {farm.lots.length > 1 ? (
            <LotTabs lots={farm.lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
          ) : null}
          <LotCompare key={lot.id} farm={farm} lot={lot} columns={wide ? 2 : 1} />
        </>
      )}
    </Screen>
  );
}

function LotCompare({ farm, lot, columns }: { farm: Farm; lot: Lot; columns: 1 | 2 }) {
  const view = useLotAnalysis(farm, lot);
  const monthsLink = (
    <Button label="Give or change your months" variant="secondary" href={{ pathname: "/months", params: { lot: lot.id } }} />
  );

  if (view.kind === "loading") return <Text style={text.caption}>Loading {lot.name}...</Text>;
  if (view.kind === "no-soil")
    return (
      <Narrow>
        <Notice tone="warn">
          NASA has no soil data for {lot.name}. This spot looks like sea or ice, not farmland, so its months can&apos;t be compared.
          Move the lot onto your farm.
        </Notice>
        <Button label={`Move ${lot.name} on the map`} href={{ pathname: "/lots", params: { lot: lot.id } }} />
      </Narrow>
    );
  if (view.kind === "no-crops")
    return (
      <Narrow>
        <Notice tone="warn">Pick the crops you grow on {lot.name} first.</Notice>
        <Button label="Pick crops" href={{ pathname: "/crops", params: { lot: lot.id } }} />
      </Narrow>
    );
  if (view.kind === "no-data")
    return (
      <Narrow>
        <Notice icon="clock">NASA climate data for {lot.name} is not on this phone yet. It downloads by itself when the phone has signal.</Notice>
      </Narrow>
    );
  if (view.kind === "failed")
    return (
      <Narrow>
        <Notice tone="warn">Something went wrong while comparing the months for {lot.name}.</Notice>
      </Narrow>
    );

  const { months, period } = view;
  if (months.planting.seasons.length === 0)
    return (
      <Narrow>
        <Notice tone="warn">There is nothing to compare on {lot.name} yet. Give your planting months.</Notice>
        {monthsLink}
      </Narrow>
    );

  return (
    <>
      <MonthsCompareList months={months} period={period} columns={columns} />
      <Narrow>{monthsLink}</Narrow>
    </>
  );
}

/** Keeps text and buttons at reading width on a wide screen (same as the dashboard). */
function Narrow({ children }: { children: ReactNode }) {
  return <View style={styles.narrow}>{children}</View>;
}

const styles = StyleSheet.create({
  narrow: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, gap: space.lg },
});
