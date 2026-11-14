import * as Location from "expo-location";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../src/components/Button";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { LotRow } from "../src/components/LotRow";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import type { MapLot, MapMode, MapPlace, MapToApp } from "../src/map/bridge";
import { MapView, type MapViewHandle } from "../src/map/MapView";
import { parseHectares, useDraftLots } from "../src/mock/draft-lots";

// S1 Plot your lots (#21, docs/11-user-flow.md) with the real map (#19) and
// sketch → clean plot (#20). Lots persist once the farm store (#18) is in.

const MODE_HINT: Partial<Record<MapMode, (lot: string) => string>> = {
  sketch: (lot) => `Trace around ${lot} with one finger. Two fingers move and zoom the map.`,
  corners: (lot) => `Tap each corner of ${lot}, then tap the first corner again to finish.`,
  pin: (lot) => `Tap the map where ${lot} is.`,
};

export default function LotsScreen() {
  const { lots, addLot, renameLot, removeLot, setShape, placePin, undo } = useDraftLots();
  const mapRef = useRef<MapViewHandle>(null);
  const [mode, setMode] = useState<MapMode>("select");
  const [activeLotId, setActiveLotId] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ id: string; ha: number } | null>(null);
  const [status, setStatus] = useState("Move the map to your farm, then tap Draw and trace around Lot 1.");
  const [pinOpen, setPinOpen] = useState(false);
  const [areaText, setAreaText] = useState("");

  const nameOf = (id?: string) => lots.find((l) => l.id === id)?.name ?? "the lot";
  const nextUnplotted = lots.find((l) => !l.method);
  const plottedCount = lots.filter((l) => l.method).length;
  const typedArea = parseHectares(areaText);

  const mapLots = useMemo<MapLot[]>(
    () => lots.flatMap((l) => (l.geometry ? [{ id: l.id, name: l.name, geometry: l.geometry }] : [])),
    [lots],
  );
  const mapPlaces = useMemo<MapPlace[]>(
    () => lots.flatMap((l) => (l.method === "pin" && l.centroid ? [{ id: l.id, name: l.name, point: l.centroid }] : [])),
    [lots],
  );

  /** Starts drawing a lot: the one given, or the next one not plotted yet. */
  const start = (next: "sketch" | "corners" | "pin", lotId = nextUnplotted?.id) => {
    if (!lotId) {
      setStatus("Every lot is plotted. Tap + Add lot for another one, or Redraw a lot.");
      return;
    }
    setActiveLotId(lotId);
    setMode(next);
    setEditing(null);
    setStatus(MODE_HINT[next]?.(nameOf(lotId)) ?? "");
  };

  const stopDrawing = () => {
    setMode("select");
    setStatus("Drawing stopped. Tap a lot on the map to adjust its corners.");
  };

  const onMapMessage = (msg: MapToApp) => {
    switch (msg.type) {
      case "lotChanged": {
        const lot = lots.find((l) => l.id === msg.id);
        if (!lot) return;
        const drawn = mode === "sketch" || mode === "corners";
        const method = mode === "corners" ? "corners" : mode === "sketch" ? "sketch" : lot.method === "corners" ? "corners" : "sketch";
        setShape(msg.id, method, { geometry: msg.geojson, area_ha: msg.area_ha, centroid: msg.centroid });
        setEditing(null);
        const ha = `${msg.area_ha.toFixed(2)} ha`;
        if (!drawn) setStatus(`${lot.name}: ${ha}. Saved.`);
        else if (msg.fix === "unkinked")
          setStatus(`${lot.name}: ${ha}. Your lines crossed, so we kept the biggest part. Check the corners.`);
        else if (msg.fix === "hull")
          setStatus(`${lot.name}: ${ha}. We made a simple outline from your sketch. Drag the corners to match your lot.`);
        else
          setStatus(
            `${lot.name}: ${ha}. Drag a white dot to move a corner, tap a yellow dot to add one, press and hold a corner to remove it.`,
          );
        break;
      }
      case "lotEditing":
        setEditing({ id: msg.id, ha: msg.area_ha });
        setStatus(`${nameOf(msg.id)}: ${msg.area_ha.toFixed(2)} ha`);
        break;
      case "sketchRejected":
        setStatus(
          msg.reason === "too_small"
            ? "That shape is very small. Try drawing around the whole lot."
            : "Try drawing around the whole lot in one go.",
        );
        break;
      case "modeChanged":
        setMode(msg.mode);
        break;
      case "pinPlaced": {
        if (mode !== "pin" || !activeLotId || typedArea === null) return;
        placePin(activeLotId, msg.point, typedArea);
        setStatus(`${nameOf(activeLotId)}: pin placed, ${typedArea} ha (your number).`);
        setAreaText("");
        setPinOpen(false);
        setMode("select");
        break;
      }
      case "error":
        console.warn("[map]", msg.message);
        break;
    }
  };

  const findMe = async () => {
    setStatus("Finding where you are...");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("Location is off for this app. You can still move the map with your fingers.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.send({
        type: "gps",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? undefined,
      });
      setStatus("Map moved to where you are.");
    } catch {
      setStatus("Couldn't find your location. Move the map with your fingers.");
    }
  };

  const drawing = mode === "sketch" || mode === "corners" || mode === "pin";

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

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          lots={mapLots}
          places={mapPlaces}
          mode={mode}
          activeLotId={activeLotId}
          onMessage={onMapMessage}
          accessibilityLabel="Satellite map of your farm"
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          onPress={findMe}
          accessibilityRole="button"
          accessibilityLabel="Find me"
          style={({ pressed }) => [styles.findMe, pressed && { backgroundColor: colors.pressed }]}
        >
          <Icon name="locate" color={colors.blue} />
        </Pressable>
        {drawing ? (
          <View style={styles.drawBar}>
            <Text style={styles.drawBarText}>Drawing {nameOf(activeLotId)}</Text>
            <Pressable
              onPress={stopDrawing}
              accessibilityRole="button"
              accessibilityLabel="Stop drawing"
              style={({ pressed }) => [styles.drawBarButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.drawBarButtonText}>Stop</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={[text.body, styles.status]} accessibilityLiveRegion="polite">
        {status}
      </Text>

      <View style={styles.tools}>
        <Button label="Draw" icon="draw" onPress={() => start("sketch")} style={styles.flex} />
        <Button
          label="Corners"
          icon="corners"
          variant="secondary"
          accessibilityLabel="Tap the corners"
          onPress={() => start("corners")}
          style={styles.flex}
        />
        <Button
          label="Undo"
          icon="undo"
          variant="quiet"
          onPress={() => {
            setEditing(null);
            setStatus(undo() ? "Undid the last change." : "Nothing to undo.");
          }}
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
            label={nextUnplotted ? `Drop a pin for ${nextUnplotted.name}` : "Drop a pin"}
            icon="pin"
            variant="secondary"
            disabled={typedArea === null}
            onPress={() => start("pin")}
          />
        </View>
      ) : null}

      <View style={styles.list}>
        {lots.length === 0 ? <Text style={[text.body, { color: colors.muted }]}>No lots yet.</Text> : null}
        {lots.map((lot) => (
          <LotRow
            key={lot.id}
            lot={lot}
            editingAreaHa={editing?.id === lot.id ? editing.ha : undefined}
            onPlot={() => start("sketch", lot.id)}
            onRename={(name) => {
              renameLot(lot.id, name);
              setStatus(`Renamed to ${name.trim()}.`);
            }}
            onDelete={() => {
              removeLot(lot.id);
              if (activeLotId === lot.id) setMode("select");
              setStatus(`${lot.name} deleted. Tap Undo to bring it back.`);
            }}
          />
        ))}
        <Button
          label="Add lot"
          icon="plus"
          variant="dashed"
          onPress={() => {
            const lot = addLot();
            setStatus(`${lot.name} added. Tap Draw to trace it.`);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 340,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.mapBg,
  },
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
  drawBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingLeft: space.md,
    paddingRight: 4,
  },
  drawBarText: { ...text.small, color: colors.white, flex: 1 },
  drawBarButton: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  drawBarButtonText: { ...text.bodyStrong },
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
