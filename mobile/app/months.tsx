import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { LotTabs } from "../src/components/LotTabs";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { cropById } from "../src/data/crops";
import { cropShortName, isOtherCrop, otherCropName } from "../src/lots/crop-picks";
import {
  cellState,
  type CellState,
  type Draft,
  monthLong,
  monthShort,
  pickMonth,
  seasonLabel,
  seasonsText,
  usualSeasons,
} from "../src/lots/months-core";
import { useFarmStore } from "../src/state/farm-store";
import type { CropSeason, Lot, LotCrop } from "../src/types";

// S4 When do you plant? (#34, docs/11-user-flow.md), optional. For each crop on the lot,
// a 12-month strip: tap the planting month, then the harvest month. "+ Add another season"
// for crops planted twice a year. Saved in lot.crops[].seasons as soon as a season is
// complete. A crop with no months keeps its usual (typical) calendar, labelled assumed.
// Opened from the dashboard's Continue prompt as /months?lot=<id>; Next goes to S5 (/compare).

export default function MonthsScreen() {
  const lots = useFarmStore((s) => s.lots);
  const { lot: lotParam } = useLocalSearchParams<{ lot?: string }>();
  const lot = lots.find((l) => l.id === lotParam) ?? lots[0];
  // With months given, next is S5 (your months vs better months); with none, back to the results.
  // dismissTo goes back to S5 if it is under this screen, else replaces this screen with it.
  const hasMonths = lot?.crops.some((c) => c.seasons.length > 0) ?? false;

  return (
    <Screen
      footer={
        lot ? (
          <Button
            label={hasMonths ? "Next: compare your months" : "Done: see your results"}
            iconAfter="chevron"
            size="lg"
            onPress={() =>
              router.dismissTo({ pathname: hasMonths ? "/compare" : "/dashboard", params: { lot: lot.id } })
            }
          />
        ) : null
      }
    >
      <Header title="When do you plant?" right="Optional" fallbackHref="/dashboard" />
      {!lot ? (
        <Text style={text.body}>Draw a lot and pick its crops first.</Text>
      ) : (
        <>
          <Text style={[text.body, { color: colors.muted }]}>
            Tap the month you plant, then the month you harvest. Your months are saved as you tap. A crop you skip
            keeps its usual months (assumed).
          </Text>
          {lots.length > 1 ? (
            <LotTabs lots={lots} selectedId={lot.id} onSelect={(id) => router.setParams({ lot: id })} />
          ) : null}
          <LotMonths key={lot.id} lot={lot} />
        </>
      )}
    </Screen>
  );
}

function LotMonths({ lot }: { lot: Lot }) {
  const listed = lot.crops.filter((c) => !isOtherCrop(c.crop_id));
  const others = lot.crops.filter((c) => isOtherCrop(c.crop_id));
  return (
    <>
      {listed.map((c) => (
        <CropMonths key={c.crop_id} lotId={lot.id} lotCrop={c} />
      ))}
      {listed.length === 0 ? <Text style={text.body}>Pick the crops for {lot.name} first.</Text> : null}
      {others.length > 0 ? (
        <Text style={text.caption}>
          {others.map((c) => otherCropName(c.crop_id)).join(", ")}: not in our crop list, so no months are needed
          (it is not scored).
        </Text>
      ) : null}
    </>
  );
}

/** Which season is being picked: an index into the crop's seasons (= length for a new one). */
type Editing = { index: number; draft: Draft };

function CropMonths({ lotId, lotCrop }: { lotId: string; lotCrop: LotCrop }) {
  const setSeasons = useFarmStore((s) => s.setSeasons);
  const crop = cropById(lotCrop.crop_id);
  const name = crop ? cropShortName(crop) : lotCrop.crop_id;
  const seasons = lotCrop.seasons;
  const usual = crop ? usualSeasons(crop) : [];
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = (next: CropSeason[]) => setSeasons(lotId, lotCrop.crop_id, next);

  const tap = (index: number, month: number) => {
    const result = pickMonth(editing?.index === index ? editing.draft : null, month);
    if (result.kind === "draft") {
      setEditing({ index, draft: result.draft });
      setMessage(`Planting in ${monthLong(month)}. Now tap the harvest month.`);
    } else if (result.kind === "same-month") {
      setMessage("The harvest is in a different month. Tap the harvest month.");
    } else {
      const next = [...seasons];
      next[index] = result.season;
      save(next);
      setEditing(null);
      setMessage(`Saved: ${name}, ${seasonLabel(result.season)}.`);
    }
  };

  const remove = (index: number) => {
    save(seasons.filter((_, i) => i !== index));
    setEditing(null);
    setMessage("Season removed.");
  };

  // One strip per saved season, plus the new one being picked. No months yet: one empty strip.
  const addingNew = editing !== null && editing.index >= seasons.length;
  const count = seasons.length === 0 ? 1 : seasons.length + (addingNew ? 1 : 0);
  // A way back from a half-picked season: a change to a saved one, a new one, or the first one.
  const cancelLabel = !editing
    ? null
    : editing.index < seasons.length
      ? "Cancel the change"
      : seasons.length > 0
        ? "Cancel the new season"
        : "Pick the planting month again";

  return (
    <View style={styles.card}>
      <View style={styles.cropHead}>
        <View style={styles.flex}>
          <Text style={text.heading} accessibilityRole="header">
            {name}
          </Text>
          {crop?.local_name ? <Text style={text.caption}>{crop.local_name}</Text> : null}
        </View>
        <Text style={[styles.tag, seasons.length > 0 ? styles.tagYours : styles.tagAssumed]}>
          {seasons.length > 0 ? "Your months" : "Usual months, assumed"}
        </Text>
      </View>

      {seasons.length === 0 && usual.length > 0 ? (
        <View style={styles.usual}>
          <Text style={[text.small, styles.flex]}>
            Usual months here: <Text style={text.bodyStrong}>{seasonsText(usual)}</Text>
          </Text>
          <Button label="Use these" variant="secondary" onPress={() => save(usual)} accessibilityLabel={`Use the usual months for ${name}`} />
        </View>
      ) : null}

      {Array.from({ length: count }, (_, i) => {
        const season = seasons[i] ?? null;
        const draft = editing?.index === i ? editing.draft : null;
        return (
          <View key={i} style={styles.season}>
            <View style={styles.seasonHead}>
              <Text style={[text.bodyStrong, styles.flex]}>
                {count > 1 ? `Season ${i + 1}: ` : ""}
                {draft ? `${monthShort(draft.plant)} → ?` : season ? seasonLabel(season) : "Tap the planting month"}
              </Text>
              {season ? (
                <Pressable
                  onPress={() => remove(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name} season ${i + 1}, ${seasonLabel(season)}`}
                  style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                >
                  <Icon name="close" size={18} color={colors.muted} />
                  <Text style={text.small}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <MonthStrip
              cropName={name}
              season={season}
              draft={draft}
              onTap={(m) => tap(i, m)}
            />
          </View>
        );
      })}

      {message ? (
        <Text style={text.small} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      {seasons.length > 0 && !addingNew ? (
        <Button
          label="Add another season"
          icon="plus"
          variant="dashed"
          onPress={() => {
            setEditing({ index: seasons.length, draft: null });
            setMessage(`Tap the month you plant ${name} again.`);
          }}
        />
      ) : null}
      {cancelLabel ? (
        <Button
          label={cancelLabel}
          variant="quiet"
          onPress={() => {
            setEditing(null);
            setMessage(null);
          }}
        />
      ) : null}
    </View>
  );
}

const CELL_HINT: Record<CellState, string> = {
  plant: ", planting month",
  harvest: ", harvest month",
  growing: ", growing",
  none: "",
};

/** 12 month buttons, 6 per row. */
function MonthStrip({
  cropName,
  season,
  draft,
  onTap,
}: {
  cropName: string;
  season: CropSeason | null;
  draft: Draft;
  onTap: (month: number) => void;
}) {
  return (
    <View style={styles.strip} accessibilityLabel={`Months for ${cropName}`}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const state = cellState(m, season, draft);
        return (
          <Pressable
            key={m}
            onPress={() => onTap(m)}
            accessibilityRole="button"
            accessibilityLabel={`${monthLong(m)}${CELL_HINT[state]}`}
            accessibilityHint={draft ? "Sets the harvest month" : "Sets the planting month"}
            style={({ pressed }) => [styles.cell, CELL_STYLE[state], pressed && state === "none" && styles.pressed]}
          >
            <Text style={[styles.cellLabel, (state === "plant" || state === "harvest") && styles.cellLabelOn]}>
              {monthShort(m)}
            </Text>
            {state === "plant" || state === "harvest" ? (
              <Text style={styles.cellSub}>{state === "plant" ? "Plant" : "Harvest"}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  cropHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  tag: {
    ...text.caption,
    fontWeight: "600",
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  tagYours: { backgroundColor: colors.greenTint, color: colors.green },
  tagAssumed: { backgroundColor: colors.amberTint, color: colors.amber },
  usual: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  season: { gap: space.sm },
  seasonHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  remove: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.pressed },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: {
    flexBasis: "15%",
    flexGrow: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cellLabel: { ...text.bodyStrong, fontSize: 15 },
  cellLabelOn: { color: colors.white },
  cellSub: { fontSize: 11, lineHeight: 14, fontWeight: "600", color: colors.white },
});

const CELL_STYLE = StyleSheet.create({
  none: {},
  growing: { backgroundColor: colors.greenTint, borderColor: colors.green },
  plant: { backgroundColor: colors.green, borderColor: colors.green },
  harvest: { backgroundColor: colors.amber, borderColor: colors.amber },
});
