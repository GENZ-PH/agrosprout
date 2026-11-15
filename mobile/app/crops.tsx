import { onlineManager } from "@tanstack/react-query";
import { tr } from "../src/i18n/lang-store";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropImage, CropPhotoCredit } from "../src/components/CropImage";
import { sciNameFor } from "../src/data/crop-photo-core";
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
import { chooseCrop, cropNeedingMonth, cropShortName, dataLine, isOtherCrop, lotsWithoutCrops, otherCropName, seasonFromPlantMonth, toggleCrop } from "../src/lots/crop-picks";
import { buildSearchEntries } from "../src/lots/crop-search-core";
import { lotLooksLikeWater } from "../src/lots/land-water-core";
import { FIT_LABELS } from "../src/components/recommendations-core";
import { goodMonthsText, lotSuggestions, safeLotTop, type CropSuggestion } from "../src/lots/suggest-core";
import { areaLabel, isPinLot } from "../src/lots/lot-editor";
import { useFarmStore } from "../src/state/farm-store";
import type { Crop, Lot, LotCrop } from "../src/types";

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
  // A crop grown year-round needs the farmer's planting month before the results can compare with it.
  const noMonth = lots.flatMap((l) => {
    const c = cropNeedingMonth(l, cropById);
    return c ? [`${cropShortName(c)} on ${l.name}`] : [];
  });
  const ready = lots.length > 0 && missing.length === 0 && noMonth.length === 0;

  return (
    <Screen
      footer={
        <>
          {lots.length > 0 && missing.length > 0 ? (
            <Text style={[text.small, { color: colors.amber }]}>
              {tr("Choose a crop for {names}.", { names: missing.map((l) => l.name).join(", ") })}
            </Text>
          ) : null}
          {lots.length > 0 && missing.length === 0 && noMonth.length > 0 ? (
            <Text style={[text.small, { color: colors.amber }]}>Choose when you plant {noMonth.join(", ")}.</Text>
          ) : null}
          {oneLot ? (
            <Button
              label={tr("Next: see {name}", { name: oneLot.name })}
              iconAfter="chevron"
              size="lg"
              disabled={!ready}
              // Back to the dashboard already open under S1, on the new lot's tab.
              onPress={() => router.dismissTo({ pathname: "/dashboard", params: { lot: oneLot.id } })}
            />
          ) : (
            <Button label={tr("Next: see your results")} href="/dashboard" size="lg" disabled={!ready} />
          )}
        </>
      }
    >
      <Header
        title={oneLot ? tr("Main crop on {name}", { name: oneLot.name }) : tr("Main crop on each lot")}
        right={oneLot ? undefined : tr("Step 2 of 2")}
        fallbackHref={oneLot ? "/dashboard" : "/lots"}
      />
      {lots.length === 0 ? (
        <View style={styles.empty}>
          <Text style={text.body}>Plot a lot on the map first, then choose its main crop here.</Text>
          <Button label={tr("Plot your lots")} href="/lots" variant="secondary" />
        </View>
      ) : (
        <>
          <Text style={[text.body, { color: colors.muted }]}>
            {oneLot
              ? tr("Choose one crop, the main one you grow on this lot: search for it, or tap one of the top crops. Choosing another crop replaces it, and you can change it later.")
              : tr("Choose one crop for each lot, the main one you grow there: search for it, or tap one of the top crops. Choosing another crop replaces it, and you can change it later.")}
          </Text>
          {lots.map((lot) => (
            <LotCrops key={lot.id} lot={lot} />
          ))}
          <Pressable onPress={() => router.push("/credits")} accessibilityRole="link" style={styles.creditsLink}>
            <Text style={[text.small, styles.creditsText]}>{tr("Photo credits")}</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * "When do you usually plant it?" (2026-11-15): shown for a crop with no usual planting months in
 * the crop library (the DA guides say several are grown year-round). The farmer's month is saved
 * as the crop's season, so "You now" and every comparison on the results use it. Nothing invented.
 */
function PlantMonthAsk({ lot, fit }: { lot: Lot; fit: CropSuggestion | null }) {
  const setSeasons = useFarmStore((s) => s.setSeasons);
  const lc = lot.crops.length === 1 ? lot.crops[0] : null;
  const crop: Crop | undefined = lc ? cropById(lc.crop_id) : undefined;
  if (!lc || !crop || crop.typical_calendar.length > 0) return null;
  const picked = lc.seasons[0]?.plant_month ?? null;
  const name = cropShortName(crop);
  // The same check as the top 3 crops: the planting months where this crop fits the lot best.
  const best = new Set(fit && (fit.level === "good" || fit.level === "watch") ? fit.best_months : []);
  return (
    <View style={styles.monthAsk} accessibilityRole="radiogroup" accessibilityLabel={`When do you usually plant ${name} on ${lot.name}?`}>
      <Text style={text.heading}>When do you usually plant {name}?</Text>
      <Text style={[text.small, { color: colors.muted }]}>
        {name} can be planted at different times of the year, so tell us your month. The results compare every plan with it.
      </Text>
      {best.size > 0 && fit ? (
        <Text style={[text.small, styles.bestLine]}>
          {tr("Best on this lot from NASA data: {level} if planted in {months}. Marked with a dot.", {
            level: FIT_LABELS[fit.level],
            months: goodMonthsText(fit.best_months),
          })}
        </Text>
      ) : null}
      <View style={styles.monthRow}>
        {MONTHS.map((m, i) => {
          const on = picked === i + 1;
          return (
            <Pressable
              key={m}
              onPress={() => {
                const season = seasonFromPlantMonth(crop, i + 1);
                if (season) setSeasons(lot.id, crop.id, [season]);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={best.has(i + 1) ? `${MONTHS_LONG[i]}, ${fit ? FIT_LABELS[fit.level] : ""}` : MONTHS_LONG[i]}
              style={({ pressed }) => [styles.monthChip, best.has(i + 1) && styles.monthChipBest, on && styles.monthChipOn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.monthText, on && styles.monthTextOn]}>{m}</Text>
              {best.has(i + 1) ? <View style={[styles.bestDot, on && { backgroundColor: colors.surface }]} /> : null}
            </Pressable>
          );
        })}
      </View>
      {picked && lc.seasons[0] ? (
        <Text style={[text.small, { color: colors.muted }]}>
          {`Planted in ${MONTHS_LONG[picked - 1]}, harvested around ${MONTHS_LONG[lc.seasons[0].harvest_month - 1]} (the crop's usual season length). You can change it later.`}
        </Text>
      ) : null}
    </View>
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
  const chosenFit = useMemo(() => {
    if (!data || seaData || !chosen) return null;
    try {
      return lotSuggestions(lot.details, data, CROP_LIBRARY).crops.find((c) => c.crop_id === chosen) ?? null;
    } catch {
      return null;
    }
  }, [data, seaData, lot.details, chosen]);
  const line = dataLine(lot.data_status, online, noSoil);
  const search = useRef<{ focus: () => void }>(null);
  // Soft: NASA's coarse cells read inner seas and lakes as land, so the lot is also checked against a land map.
  const onWater = useMemo(() => !noSoil && lotLooksLikeWater(LAND_WATER, lot), [noSoil, lot]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={text.title} accessibilityRole="header">
          {lot.name}
        </Text>
        <Text style={[text.small, { color: colors.muted }]}>
          {areaLabel({ id: lot.id, name: lot.name, area_ha: lot.area_ha, pin: isPinLot(lot) })}
        </Text>
      </View>

      <CropSearch
        lotName={lot.name}
        entries={SEARCH_ENTRIES}
        chosen={chosen}
        onPick={(id) => setCrops(lot.id, chooseCrop(lot.crops, id))}
        searchRef={search}
      />

      <YourCrops
        lotName={lot.name}
        crops={lot.crops}
        hasTop={top.length > 0}
        onRemove={(id) => setCrops(lot.id, toggleCrop(lot.crops, id))}
        onSearch={() => search.current?.focus()}
      />

      <PlantMonthAsk lot={lot} fit={chosenFit} />

      <View
        style={line.tone === "ready" ? styles.dataQuiet : [styles.dataLine, line.tone === "error" ? styles.dataError : null]}
        accessibilityLiveRegion="polite"
      >
        <Icon
          name={line.tone === "ready" ? "check" : line.tone === "error" ? "alert" : "clock"}
          size={18}
          color={line.tone === "ready" ? colors.green : line.tone === "error" ? colors.amber : colors.muted}
        />
        <Text style={[text.small, styles.flex, line.tone === "ready" && { color: colors.muted }]}>{tr(line.text)}</Text>
        {noSoil ? (
          <Button
            label={tr("Move lot")}
            variant="quiet"
            href={{ pathname: "/lots", params: { lot: lot.id } }}
            accessibilityLabel={`Move ${lot.name} on the map`}
          />
        ) : line.tone === "error" ? (
          <Button
            label={tr("Try again")}
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
            label={tr("Move lot")}
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
  onSearch,
}: {
  lotName: string;
  crops: readonly LotCrop[];
  /** Top crops are shown below, so the empty text can point to them. */
  hasTop: boolean;
  onRemove: (cropId: string) => void;
  /** Puts the cursor in the search box above. */
  onSearch: () => void;
}) {
  return (
    <View style={styles.yours} accessibilityLiveRegion="polite">
      <Text style={text.heading} accessibilityRole="header">
        {crops.length > 1 ? `Your crops on ${lotName}` : tr("Main crop on {name}", { name: lotName })}
      </Text>
      {crops.length > 1 ? (
        <Text style={[text.small, { color: colors.muted }]}>One crop per lot now: the crop you choose next replaces these.</Text>
      ) : null}
      {crops.length === 0 ? (
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel={`No crop on ${lotName} yet. Search for a crop`}
          style={({ pressed }) => [styles.emptyCrop, pressed && styles.pressed]}
        >
          <Text style={[text.body, { color: colors.muted }]}>
            {hasTop ? tr("None yet. Search for a crop above, or tap one of the top crops below.") : tr("None yet. Search for a crop above.")}
          </Text>
        </Pressable>
      ) : (
        crops.map((c) => {
          const other = isOtherCrop(c.crop_id);
          const crop = other ? undefined : cropById(c.crop_id);
          const name = other ? otherCropName(c.crop_id) : crop ? cropShortName(crop) : c.crop_id;
          const sub = other ? "Not scored yet" : (crop?.local_name ?? null);
          // A crop from the search has no bundled picture: its picture comes online (Wikipedia), with its credit below.
          const sci = other ? sciNameFor(name, ECOCROP_NAMES) : null;
          return (
            <View key={c.crop_id}>
              <View style={styles.cropCard}>
                <Icon name="check" size={24} color={colors.green} />
                <CropImage cropId={c.crop_id} size={40} sci={sci} />
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
              <CropPhotoCredit sci={sci} />
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthAsk: { gap: space.xs, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberTint },
  monthRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  monthChip: { minWidth: 52, minHeight: MIN_TOUCH, paddingHorizontal: space.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  monthChipOn: { backgroundColor: colors.green, borderColor: colors.green },
  monthText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  monthTextOn: { color: colors.surface },
  monthChipBest: { borderColor: colors.green, borderWidth: 2 },
  bestDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, marginTop: 2 },
  bestLine: { color: colors.green, fontWeight: "600" },
  flex: { flex: 1 },
  creditsLink: { minHeight: MIN_TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  creditsText: { color: colors.blue, textDecorationLine: "underline" },
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
  // Ready needs no action, so no box: a green box here read like a second chosen crop (UI review 2026-11-15).
  dataQuiet: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
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
