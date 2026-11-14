import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../src/components/Button";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { LotRow } from "../src/components/LotRow";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { parseHectares, type PlotMethod, useDraftLots } from "../src/mock/draft-lots";

// S1 Plot your lots (#21, docs/11-user-flow.md). Shell: the map, sketching and
// GPS arrive with #19 and #20, and lots persist once the farm store (#18) is in.

const PLOTTED: Record<PlotMethod, (name: string) => string> = {
  sketch: (n) =>
    `${n}: your sketch is now a clean plot. Drag a white dot to move a corner, tap a small dot to add one, press and hold a corner to remove it.`,
  corners: (n) => `${n}: plot made from your corner taps. Drag a white dot to move a corner.`,
  pin: (n) => `${n}: pin placed with the area you typed.`,
};

export default function LotsScreen() {
  const { lots, addLot, renameLot, removeLot, plotLot, undo } = useDraftLots();
  const [status, setStatus] = useState("Move the map to your farm, then tap Draw and trace around Lot 1.");
  const [pinOpen, setPinOpen] = useState(false);
  const [areaText, setAreaText] = useState("");

  const nextUnplotted = lots.find((l) => !l.method);
  const plottedCount = lots.filter((l) => l.method).length;
  const typedArea = parseHectares(areaText);

  const plot = (id: string, method: PlotMethod, area?: number) => {
    const lot = lots.find((l) => l.id === id);
    if (!lot) return;
    plotLot(id, method, area);
    setStatus(PLOTTED[method](lot.name));
  };

  const plotNext = (method: PlotMethod, area?: number) => {
    if (!nextUnplotted) {
      setStatus("Every lot is plotted. Tap + Add lot for another one.");
      return false;
    }
    plot(nextUnplotted.id, method, area);
    return true;
  };

  return (
    <Screen
      footer={
        <>
          {plottedCount === 0 ? (
            <Text style={[text.small, { color: colors.amber }]}>Plot at least one lot to continue.</Text>
          ) : null}
          <Button label="Next: your crops" href="/crops" size="lg" disabled={plottedCount === 0} />
        </>
      }
    >
      <Header title="Plot your lots" right="Step 1 of 2" />

      <View
        style={styles.map}
        accessible
        accessibilityLabel="Map of your farm. The map arrives in the next update."
      >
        <Text style={styles.mapText}>Satellite map goes here (#19)</Text>
        <Pressable
          onPress={() => setStatus("Find me will move the map to where you are. GPS works without signal.")}
          accessibilityRole="button"
          accessibilityLabel="Find me"
          style={({ pressed }) => [styles.findMe, pressed && { backgroundColor: colors.pressed }]}
        >
          <Icon name="locate" color={colors.blue} />
        </Pressable>
        <View style={styles.mapHint}>
          <Text style={styles.mapHintText}>Drawing: one finger draws, two fingers move and zoom the map.</Text>
        </View>
      </View>

      <Text style={[text.body, styles.status]} accessibilityLiveRegion="polite">
        {status}
      </Text>

      <View style={styles.tools}>
        <Button label="Draw" icon="draw" onPress={() => plotNext("sketch")} style={styles.flex} />
        <Button
          label="Corners"
          icon="corners"
          variant="secondary"
          accessibilityLabel="Tap the corners"
          onPress={() => plotNext("corners")}
          style={styles.flex}
        />
        <Button
          label="Undo"
          icon="undo"
          variant="quiet"
          onPress={() => setStatus(undo() ? "Undid the last change." : "Nothing to undo.")}
          style={styles.flex}
        />
      </View>

      <Button
        label={pinOpen ? "Hide the pin option" : "Can't draw? Drop a pin and type the area"}
        variant="link"
        onPress={() => setPinOpen((o) => !o)}
      />
      {pinOpen ? (
        <View style={styles.pinPanel}>
          <View style={styles.pinRow}>
            <Text style={text.body}>Lot area</Text>
            <TextInput
              value={areaText}
              onChangeText={setAreaText}
              keyboardType="decimal-pad"
              placeholder="e.g. 1.5"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Lot area in hectares"
              style={styles.areaInput}
            />
            <Text style={[text.body, { color: colors.muted }]}>hectares</Text>
          </View>
          <Button
            label={nextUnplotted ? `Use this area for ${nextUnplotted.name}` : "Use this area"}
            icon="pin"
            variant="secondary"
            disabled={typedArea === null}
            onPress={() => {
              if (typedArea !== null && plotNext("pin", typedArea)) setAreaText("");
            }}
          />
        </View>
      ) : null}

      <View style={styles.list}>
        {lots.length === 0 ? <Text style={[text.body, { color: colors.muted }]}>No lots yet.</Text> : null}
        {lots.map((lot) => (
          <LotRow
            key={lot.id}
            lot={lot}
            onPlot={() => plot(lot.id, "sketch")}
            onRename={(name) => {
              renameLot(lot.id, name);
              setStatus(`Renamed to ${name.trim()}.`);
            }}
            onDelete={() => {
              removeLot(lot.id);
              setStatus(`${lot.name} deleted. Tap Undo to bring it back.`);
            }}
          />
        ))}
        <Button
          label="Add lot"
          icon="plus"
          variant="dashed"
          onPress={() => setStatus(`${addLot()} added. Tap Draw to trace it.`)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 300,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.mapBg,
    alignItems: "center",
    justifyContent: "center",
  },
  mapText: { ...text.bodyStrong, color: colors.white },
  findMe: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  mapHint: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    paddingHorizontal: 10,
  },
  mapHintText: { ...text.caption, color: colors.white },
  status: { minHeight: 46 },
  tools: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1, paddingHorizontal: space.sm },
  pinPanel: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  pinRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  areaInput: {
    ...text.body,
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
  list: { gap: space.sm },
});
