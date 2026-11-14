import { onlineManager } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropSearch } from "../src/components/CropSearch";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { Screen } from "../src/components/Screen";
import { colors, MIN_TOUCH, radius, space, text } from "../src/components/theme";
import { TopCrops } from "../src/components/TopCrops";
import { hasNoSoilData } from "../src/components/lot-analysis-core";
import { useLotData } from "../src/components/useLotAnalysis";
import { CROP_LIBRARY, cropById } from "../src/data/crops";
import { ECOCROP_NAMES } from "../src/data/ecocrop";
import { LAND_WATER } from "../src/data/land-water";
import { chooseCrop, cropShortName, dataLine, isOtherCrop, lotsWithoutCrops, otherCropName, toggleCrop } from "../src/lots/crop-picks";
import { buildSearchEntries } from "../src/lots/crop-search-core";
import { lotLooksLikeWater } from "../src/lots/land-water-core";
import { safeLotTop } from "../src/lots/suggest-core";
import { areaLabel, isPinLot } from "../src/lots/lot-editor";
import { useFarmStore } from "../src/state/farm-store";
import type { Lot, LotCrop } from "../src/types";

// S2 What do you plant on each lot? (#25, #152, docs/11-user-flow.md). One crop per lot (D13, changed by the
// team 2026-11-14). Per lot: a search over our crop list and the FAO Ecocrop names (first, as the team asked),
// the top 3 crops for the lot from its NASA data (once the data is on the phone), and the lot's crop. A farm saved earlier may still have
// several crops on a lot: they all show, and the next crop chosen replaces them. Saved as it is tapped. The NASA data for each lot
// keeps loading in the background (lot sync); Next never waits for it. Onboarding ends here.
// A lot with no NASA soil data (sea or ice, `hasNoSoilData`) gets no top crops and a "Move lot" button instead.
// A lot that our land map (Natural Earth) puts on the sea or a lake gets a soft warning and the same button.
// /crops?lot=<id> shows one lot only: the lot just added with "+ Add lot" (D32), or
// a lot whose crops are missing on the dashboard. Next goes back to that lot's results.

/** Built once: our crops plus every Ecocrop species, with their names ready to match. */
const SEARCH_ENTRIES = buildSearchEntries(CROP_LIBRARY, ECOCROP_NAMES);
const NO_TOP: ReturnType<typeof safeLotTop> = { top: [], noFit: null };

const useOnline = () =>
  useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );

export default function CropsScreen() {
  const allLots = useFarmStore((s) => s.lots);
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const oneLot = lotParam ? allLots.find((l) => l.id === lotParam) : undefined;
  const lots = oneLot ? [oneLot] : allLots;
  const missing = lotsWithoutCrops(lots);
  const ready = lots.length > 0 && missing.length === 0;

  return (
    <Screen
      footer={
        <>
          {lots.length > 0 && missing.length > 0 ? (
            <Text style={[text.small, { color: colors.amber }]}>
              Choose a crop for {missing.map((l) => l.name).join(", ")}.
            </Text>
          ) : null}
          {oneLot ? (
            <Button
              label={`Next: see ${oneLot.name}`}
              iconAfter="chevron"
              size="lg"
              disabled={!ready}
              // Back to the dashboard already open under S1, on the new lot's tab.
              onPress={() => router.dismissTo({ pathname: "/dashboard", params: { lot: oneLot.id } })}
            />
          ) : (
            <Button label="Next: see your results" href="/dashboard" size="lg" disabled={!ready} />
          )}
        </>
      }
    >
      <Header
        title={oneLot ? `What do you plant on ${oneLot.name}?` : "What do you plant?"}
        right={oneLot ? undefined : "Step 2 of 2"}
        fallbackHref={oneLot ? "/dashboard" : "/lots"}
      />
      {lots.length === 0 ? (
        <View style={styles.empty}>
          <Text style={text.body}>Plot a lot on the map first, then pick its crops here.</Text>
          <Button label="Plot your lots" href="/lots" variant="secondary" />
        </View>
      ) : (
        <>
          <Text style={[text.body, { color: colors.muted }]}>
            {oneLot
              ? "Choose the crop you grow on this lot: search for it, or tap one of the top crops. You can change it later."
              : "Choose the crop you grow on each lot: search for it, or tap one of the top crops. You can change it later."}
          </Text>
          {lots.map((lot) => (
            <LotCrops key={lot.id} lot={lot} />
          ))}
        </>
      )}
    </Screen>
  );
}

function LotCrops({ lot }: { lot: Lot }) {
  const setCrops = useFarmStore((s) => s.setCrops);
  const updateLot = useFarmStore((s) => s.updateLot);
  const online = useOnline();
  const data = useLotData(lot);
  // Sea data saved before the lot was moved is not rated, but the line says the new download is coming.
  const seaData = data ? hasNoSoilData(data) : false;
  const noSoil = seaData && lot.data_status === "ready";
  const { top, noFit } = useMemo(
    () => (data && !seaData ? safeLotTop(lot.details, data, CROP_LIBRARY) : NO_TOP),
    [data, seaData, lot.details],
  );

  // One crop per lot: a crop counts as chosen only when it is the lot's only crop.
  const chosen = lot.crops.length === 1 ? lot.crops[0].crop_id : null;
  const line = dataLine(lot.data_status, online, noSoil);
  // Soft: NASA's coarse cells read inner seas and lakes as land, so the lot is also checked against a land map.
  const onWater = useMemo(() => !noSoil && lotLooksLikeWater(LAND_WATER, lot), [noSoil, lot]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={text.heading} accessibilityRole="header">
          {lot.name}
        </Text>
        <Text style={[text.small, { color: colors.muted }]}>
          {areaLabel({ id: lot.id, name: lot.name, area_ha: lot.area_ha, pin: isPinLot(lot) })}
        </Text>
      </View>

      <CropSearch lotName={lot.name} entries={SEARCH_ENTRIES} chosen={chosen} onPick={(id) => setCrops(lot.id, chooseCrop(lot.crops, id))} />

      <YourCrops
        lotName={lot.name}
        crops={lot.crops}
        hasTop={top.length > 0}
        onRemove={(id) => setCrops(lot.id, toggleCrop(lot.crops, id))}
      />

      <View
        style={[styles.dataLine, line.tone === "ready" ? styles.dataReady : line.tone === "error" ? styles.dataError : null]}
        accessibilityLiveRegion="polite"
      >
        <Icon
          name={line.tone === "ready" ? "check" : line.tone === "error" ? "alert" : "clock"}
          size={18}
          color={line.tone === "ready" ? colors.green : line.tone === "error" ? colors.amber : colors.muted}
        />
        <Text style={[text.small, styles.flex]}>{line.text}</Text>
        {noSoil ? (
          <Button
            label="Move lot"
            variant="quiet"
            href={{ pathname: "/lots", params: { lot: lot.id } }}
            accessibilityLabel={`Move ${lot.name} on the map`}
          />
        ) : line.tone === "error" ? (
          <Button
            label="Try again"
            variant="quiet"
            onPress={() => updateLot(lot.id, { data_status: "pending" })}
            accessibilityLabel={`Try loading the NASA data for ${lot.name} again`}
          />
        ) : null}
      </View>

      {onWater ? (
        <View style={[styles.dataLine, styles.dataError]}>
          <Icon name="alert" size={18} color={colors.amber} />
          <Text style={[text.small, styles.flex]}>
            {lot.name} looks like it is on water (sea or lake) on our map. If this is your farm, go on. If not, move it.
          </Text>
          <Button
            label="Move lot"
            variant="quiet"
            href={{ pathname: "/lots", params: { lot: lot.id } }}
            accessibilityLabel={`Move ${lot.name} on the map`}
          />
        </View>
      ) : null}

      {data && !seaData ? (
        <TopCrops
          lotName={lot.name}
          top={top}
          noFit={noFit}
          period={data.period}
          chosen={chosen}
          onChoose={(id) => setCrops(lot.id, chooseCrop(lot.crops, id))}
        />
      ) : null}

    </View>
  );
}

/**
 * The lot's crop, right under the search and bigger than the top crops (the farmer's own answer comes first), with a
 * ✕ to take it off. A farm saved before D13 changed may show several, until one is chosen.
 */
function YourCrops({
  lotName,
  crops,
  hasTop,
  onRemove,
}: {
  lotName: string;
  crops: readonly LotCrop[];
  /** Top crops are shown below, so the empty text can point to them. */
  hasTop: boolean;
  onRemove: (cropId: string) => void;
}) {
  return (
    <View style={styles.yours} accessibilityLiveRegion="polite">
      <Text style={text.heading} accessibilityRole="header">
        {crops.length > 1 ? `Your crops on ${lotName}` : `Your crop on ${lotName}`}
      </Text>
      {crops.length > 1 ? (
        <Text style={[text.small, { color: colors.muted }]}>One crop per lot now: the crop you choose next replaces these.</Text>
      ) : null}
      {crops.length === 0 ? (
        <View style={styles.emptyCrop}>
          <Text style={[text.body, { color: colors.muted }]}>
            {hasTop ? "None yet. Search for a crop above, or tap one of the top crops below." : "None yet. Search for a crop above."}
          </Text>
        </View>
      ) : (
        crops.map((c) => {
          const other = isOtherCrop(c.crop_id);
          const crop = other ? undefined : cropById(c.crop_id);
          const name = other ? otherCropName(c.crop_id) : crop ? cropShortName(crop) : c.crop_id;
          const sub = other ? "Not scored yet" : (crop?.local_name ?? null);
          return (
            <View key={c.crop_id} style={styles.cropCard}>
              <Icon name="check" size={24} color={colors.green} />
              <View style={[styles.flex, styles.cropText]}>
                <Text style={text.title}>{name}</Text>
                {sub ? <Text style={[text.body, { color: colors.muted }]}>{sub}</Text> : null}
              </View>
              <Pressable
                onPress={() => onRemove(c.crop_id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name} from ${lotName}${other ? ". It is not scored" : ""}`}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              >
                <Icon name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { gap: space.md, paddingVertical: space.lg },
  section: {
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm },
  dataLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.pressed,
  },
  dataReady: { backgroundColor: colors.greenTint },
  dataError: { backgroundColor: colors.amberTint },
  yours: { gap: space.sm },
  cropCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 64,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: radius.md,
    backgroundColor: colors.greenTint,
  },
  cropText: { gap: 2 },
  remove: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  emptyCrop: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.pressed },
});
