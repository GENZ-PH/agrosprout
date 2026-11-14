import * as Location from "expo-location";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Button } from "../src/components/Button";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { LotRow } from "../src/components/LotRow";
import { Screen, useWide } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import type { MapLot, MapMode, MapPlace, MapToApp } from "../src/map/bridge";
import { MapView, type MapViewHandle } from "../src/map/MapView";
import { isPinLot, parseHectares, pinShape } from "../src/lots/lot-editor";
import { useLotEditor } from "../src/lots/use-lot-editor";

// S1 Plot your lots (#21, docs/11-user-flow.md) with the real map (#19) and
// sketch → clean plot (#20). A drawn lot is saved in the farm store (#18) at once,
// and the lot sync starts fetching its NASA data in the background.
// Drawing opens the map full screen; the icon at the map's lower right opens or
// closes full screen any time. The map stays mounted, so it never reloads.

const MODE_HINT: Partial<Record<MapMode, (lot: string) => string>> = {
  sketch: (lot) => `Trace around ${lot} with one finger. Two fingers move and zoom the map.`,
  corners: (lot) => `Tap each corner of ${lot}, then tap the first corner again to finish.`,
  pin: (lot) => `Tap the map where ${lot} is.`,
};

export default function LotsScreen() {
  const { lots, rows, ensureStarted, addPlaceholder, rename, remove, setShape, undo } = useLotEditor();
  const mapRef = useRef<MapViewHandle>(null);
  const [mode, setMode] = useState<MapMode>("select");
  const [full, setFull] = useState(false);
  const [activeLotId, setActiveLotId] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ id: string; ha: number } | null>(null);
  const [status, setStatus] = useState(() =>
    lots.length > 0
      ? "Tap a lot on the map to adjust its corners, or tap + Add lot for another one."
      : "Move the map to your farm, then tap Draw and trace around Lot 1.",
  );
  const [pinOpen, setPinOpen] = useState(false);
  const [areaText, setAreaText] = useState("");

  // A new farm starts with an empty "Lot 1" to draw.
  useLayoutEffect(() => ensureStarted(), [ensureStarted]);

  const nameOf = (id?: string) => rows.find((r) => r.id === id)?.name ?? "the lot";
  const nextUnplotted = rows.find((r) => r.area_ha === null);
  const plottedCount = lots.length;
  const typedArea = parseHectares(areaText);

  // Drawn lots are outlines on the map; pin lots are pins.
  const mapLots = useMemo<MapLot[]>(
    () => lots.flatMap((l) => (isPinLot(l) ? [] : [{ id: l.id, name: l.name, geometry: l.geometry }])),
    [lots],
  );
  const mapPlaces = useMemo<MapPlace[]>(
    () => lots.flatMap((l) => (isPinLot(l) ? [{ id: l.id, name: l.name, point: l.centroid }] : [])),
    [lots],
  );

  /**
   * Starts drawing a lot full screen: the one given, else the next one not plotted
   * yet, else a new lot (Add lot is hidden in full screen; Undo removes it).
   */
  const start = (next: "sketch" | "corners" | "pin", lotId?: string) => {
    const lot = rows.find((r) => r.id === (lotId ?? nextUnplotted?.id)) ?? addPlaceholder();
    setActiveLotId(lot.id);
    setMode(next);
    setEditing(null);
    setFull(true);
    setStatus(MODE_HINT[next]?.(lot.name) ?? "");
  };

  /** Leaves full screen (Done, the corner icon, or Android Back) and stops any drawing. */
  const closeFull = () => {
    setFull(false);
    if (mode !== "select") {
      setMode("select");
      setStatus("Drawing stopped. Tap a lot on the map to adjust its corners.");
    }
  };

  // Android Back leaves full screen instead of leaving the screen.
  useEffect(() => {
    if (!full) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeFull();
      return true;
    });
    return () => sub.remove();
  });

  const onMapMessage = (msg: MapToApp) => {
    switch (msg.type) {
      case "lotChanged": {
        const lot = rows.find((r) => r.id === msg.id);
        if (!lot) return;
        const drawn = mode === "sketch" || mode === "corners";
        // A new lot is saved under the farm store's id; keep editing it under that id.
        const savedId = setShape(msg.id, { geometry: msg.geojson, area_ha: msg.area_ha, centroid: msg.centroid });
        if (savedId !== msg.id && activeLotId === msg.id) setActiveLotId(savedId);
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
        setShape(activeLotId, pinShape(msg.point, typedArea));
        setStatus(`${nameOf(activeLotId)}: pin placed, ${typedArea} ha (your number).`);
        setAreaText("");
        setPinOpen(false);
        setMode("select");
        setFull(false);
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

  const tools = (
    <View style={styles.tools}>
      <Button
        label="Draw"
        icon="draw"
        // While drawing, Draw and Corners switch method for the same lot.
        onPress={() => start("sketch", drawing ? activeLotId : undefined)}
        style={styles.flex}
      />
      <Button
        label="Corners"
        icon="corners"
        variant="secondary"
        accessibilityLabel="Tap the corners"
        onPress={() => start("corners", drawing ? activeLotId : undefined)}
        style={styles.flex}
      />
      <Button
        label="Undo"
        icon="undo"
        variant="quiet"
        onPress={() => {
          setEditing(null);
          // Undo can remove the lot being drawn, so drawing stops too.
          setMode("select");
          setStatus(undo() ? "Undid the last change." : "Nothing to undo.");
        }}
        style={styles.flex}
      />
    </View>
  );

  const statusLine = (
    <Text style={[text.body, full ? styles.statusFull : styles.status]} accessibilityLiveRegion="polite">
      {status}
    </Text>
  );

  // On a laptop the map sits beside the tools and the lot list, and fills the window height.
  const desk = useWide() && !full;
  const deskMapHeight = Math.max(420, useWindowDimensions().height - 190);

  return (
    <Screen
      wide
      footerEnd
      scrollEnabled={!full}
      edgeToEdge={full}
      footer={
        full ? (
          <>
            {statusLine}
            {tools}
          </>
        ) : (
          <>
            {plottedCount === 0 ? (
              <Text style={[text.small, { color: colors.amber }]}>Plot at least one lot to continue.</Text>
            ) : null}
            <Button label="Next: your crops" href="/crops" size="lg" disabled={plottedCount === 0} />
          </>
        )
      }
    >
      {full ? null : <Header title="Plot your lots" right="Step 1 of 2" />}

      <View style={full ? styles.fullBody : desk ? styles.deskRow : styles.stack}>
      <View style={full ? styles.mapFull : desk ? [styles.mapWrap, styles.deskMap, { height: deskMapHeight }] : styles.mapWrap}>
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
        {full ? (
          <View style={styles.topBar}>
            <Text style={styles.topBarText} numberOfLines={1}>
              {drawing ? `Drawing ${nameOf(activeLotId)}` : "Your lots"}
            </Text>
            <Pressable
              onPress={closeFull}
              accessibilityRole="button"
              accessibilityLabel="Done, close full screen"
              style={({ pressed }) => [styles.doneButton, pressed && { backgroundColor: colors.greenPressed }]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          onPress={full ? closeFull : () => setFull(true)}
          accessibilityRole="button"
          accessibilityLabel={full ? "Exit full screen" : "Full screen map"}
          style={({ pressed }) => [styles.fullButton, pressed && { backgroundColor: colors.pressed }]}
        >
          <Icon name={full ? "collapse" : "expand"} />
        </Pressable>
      </View>

      {full ? null : (
        <View style={desk ? styles.deskSide : styles.stack}>
          {statusLine}
          {tools}

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
            {rows.length === 0 ? <Text style={[text.body, { color: colors.muted }]}>No lots yet.</Text> : null}
            {rows.map((lot) => (
              <LotRow
                key={lot.id}
                lot={lot}
                editingAreaHa={editing?.id === lot.id ? editing.ha : undefined}
                onPlot={() => start("sketch", lot.id)}
                onRename={(name) => {
                  rename(lot.id, name);
                  setStatus(`Renamed to ${name.trim()}.`);
                }}
                onDelete={() => {
                  remove(lot.id);
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
                const lot = addPlaceholder();
                setStatus(`${lot.name} added. Tap Draw to trace it.`);
              }}
            />
          </View>
        </View>
      )}
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
  stack: { gap: space.lg },
  fullBody: { flex: 1 },
  deskRow: { flexDirection: "row", alignItems: "flex-start", gap: space.xl },
  deskMap: { flex: 1.5 },
  deskSide: { flex: 1, minWidth: 0, gap: space.lg },
  mapFull: { flex: 1, minHeight: 320, backgroundColor: colors.mapBg },
  // Top centre, between Leaflet's zoom buttons (left) and Find me (right).
  topBar: {
    position: "absolute",
    top: 10,
    left: 66,
    right: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 2,
    paddingLeft: space.md,
    paddingRight: 2,
  },
  topBarText: { ...text.small, color: colors.white, flex: 1 },
  doneButton: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { ...text.bodyStrong, color: colors.white },
  // Lower right, kept above the map credits (Leaflet attribution) so they stay readable.
  fullButton: {
    position: "absolute",
    right: 10,
    bottom: 44,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { minHeight: 46 },
  statusFull: { minHeight: 46, paddingTop: space.xs },
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
