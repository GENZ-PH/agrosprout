import { onlineManager } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../src/components/Button";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { Screen, useWide } from "../src/components/Screen";
import { colors, MIN_TOUCH, radius, space, text } from "../src/components/theme";
import { CROP_LIBRARY } from "../src/data/crops";
import {
  cropShortName,
  dataLine,
  isOtherCrop,
  lotsWithoutCrops,
  otherCropId,
  otherCropName,
  toggleCrop,
} from "../src/lots/crop-picks";
import { areaLabel, isPinLot } from "../src/lots/lot-editor";
import { useFarmStore } from "../src/state/farm-store";
import type { Lot } from "../src/types";

// S2 What do you plant on each lot? (#25, docs/11-user-flow.md). Picks are saved
// in the farm store as they are tapped. The NASA data for each lot keeps loading
// in the background (lot sync); Next never waits for it. Onboarding ends here.

const useOnline = () =>
  useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );

export default function CropsScreen() {
  const lots = useFarmStore((s) => s.lots);
  const missing = lotsWithoutCrops(lots);
  const wide = useWide();

  return (
    <Screen
      wide
      footerEnd
      footer={
        <>
          {lots.length > 0 && missing.length > 0 ? (
            <Text style={[text.small, { color: colors.amber }]}>
              Pick at least one crop for {missing.map((l) => l.name).join(", ")}.
            </Text>
          ) : null}
          <Button
            label="Next: see your results"
            href="/dashboard"
            size="lg"
            disabled={lots.length === 0 || missing.length > 0}
          />
        </>
      }
    >
      <Header title="What do you plant?" right="Step 2 of 2" fallbackHref="/lots" />
      {lots.length === 0 ? (
        <View style={styles.empty}>
          <Text style={text.body}>Plot a lot on the map first, then pick its crops here.</Text>
          <Button label="Plot your lots" href="/lots" variant="secondary" />
        </View>
      ) : (
        <>
          <Text style={[text.body, { color: colors.muted }]}>
            Tap every crop you grow on each lot, one after another or at the same time. You can change this later.
          </Text>
          <View style={wide ? styles.lotGrid : styles.stack}>
            {lots.map((lot) => (
              <View key={lot.id} style={wide ? styles.cell : undefined}>
                <LotCrops lot={lot} />
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function LotCrops({ lot }: { lot: Lot }) {
  const setCrops = useFarmStore((s) => s.setCrops);
  const updateLot = useFarmStore((s) => s.updateLot);
  const online = useOnline();
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");

  const picked = new Set(lot.crops.map((c) => c.crop_id));
  const others = lot.crops.filter((c) => isOtherCrop(c.crop_id));
  const line = dataLine(lot.data_status, online);
  const toggle = (cropId: string) => setCrops(lot.id, toggleCrop(lot.crops, cropId));
  const addOther = () => {
    const id = otherCropId(otherText);
    if (id && !picked.has(id)) setCrops(lot.id, [...lot.crops, { crop_id: id, seasons: [] }]);
    setOtherText("");
    setOtherOpen(false);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={text.heading}>{lot.name}</Text>
        <Text style={[text.small, { color: colors.muted }]}>
          {areaLabel({ id: lot.id, name: lot.name, area_ha: lot.area_ha, pin: isPinLot(lot) })}
        </Text>
      </View>

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
        {line.tone === "error" ? (
          <Button
            label="Try again"
            variant="quiet"
            onPress={() => updateLot(lot.id, { data_status: "pending" })}
            accessibilityLabel={`Try loading the NASA data for ${lot.name} again`}
          />
        ) : null}
      </View>

      <View style={styles.grid} accessibilityLabel={`Crops on ${lot.name}`}>
        {CROP_LIBRARY.crops.map((crop) => (
          <CropChip
            key={crop.id}
            label={cropShortName(crop)}
            sublabel={crop.local_name}
            selected={picked.has(crop.id)}
            onPress={() => toggle(crop.id)}
          />
        ))}
        {others.map((c) => (
          <CropChip
            key={c.crop_id}
            label={otherCropName(c.crop_id)}
            sublabel="Not in our list: no scores"
            selected
            onPress={() => toggle(c.crop_id)}
          />
        ))}
        {!otherOpen ? (
          <Pressable
            onPress={() => setOtherOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Add another crop to ${lot.name}`}
            style={({ pressed }) => [styles.chip, styles.otherChip, pressed && styles.pressed]}
          >
            <Icon name="plus" size={18} />
            <Text style={text.bodyStrong}>Other</Text>
          </Pressable>
        ) : null}
      </View>

      {otherOpen ? (
        <View style={styles.otherRow}>
          <TextInput
            value={otherText}
            onChangeText={setOtherText}
            onSubmitEditing={addOther}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            placeholder="Crop name, e.g. Cassava"
            placeholderTextColor={colors.muted}
            accessibilityLabel={`Other crop on ${lot.name}`}
            style={styles.input}
          />
          <Button label="Add" onPress={addOther} disabled={!otherCropId(otherText)} />
          <Button
            label="Cancel"
            variant="quiet"
            onPress={() => {
              setOtherText("");
              setOtherOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function CropChip({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      // React Native Web drops accessibilityState.checked; aria-checked reaches the DOM.
      aria-checked={selected}
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text style={text.bodyStrong} numberOfLines={2}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[text.caption, selected && { color: colors.ink }]} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={18} color={colors.green} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.lg },
  // Two lots side by side on a laptop.
  lotGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: space.lg },
  cell: { flexBasis: "45%", flexGrow: 1, minWidth: 0 },
  empty: { gap: space.md, paddingVertical: space.lg },
  section: {
    gap: space.sm,
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.greenTint },
  otherChip: { borderStyle: "dashed", borderColor: colors.dashed, justifyContent: "center" },
  pressed: { backgroundColor: colors.pressed },
  otherRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    ...text.body,
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
});
