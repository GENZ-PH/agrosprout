import * as Location from "expo-location";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../src/components/Button";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { Screen } from "../src/components/Screen";
import { colors, MIN_TOUCH, radius, space, text } from "../src/components/theme";
import { isPinLot, parseHectares, pinShape } from "../src/lots/lot-editor";
import { useLotEditor } from "../src/lots/use-lot-editor";
import type { MapLot, MapMode, MapPlace, MapToApp } from "../src/map/bridge";
import { MapView, type MapViewHandle } from "../src/map/MapView";

// S1 Draw your lot (#21, docs/11-user-flow.md): a full-screen map for ONE lot, with
// the actions as floating buttons. More lots are added later from the dashboard
// (D31, proposed). A drawn lot is saved in the farm store (#18) at once, and the
// lot sync starts fetching its NASA data in the background. Next → S2 crops.

const MODE_HINT: Partial<Record<MapMode, (lot: string) => string>> = {
  sketch: (lot) => `Trace around ${lot} with one finger. Two fingers move and zoom the map.`,
  corners: (lot) => `Tap each corner of ${lot}, then tap the first corner again to finish.`,
  pin: (lot) => `Tap the map where ${lot} is.`,
};

const ADJUST_HINT = "Drag a white dot to move a corner, tap a yellow dot to add one, press and hold a corner to remove it.";

export default function LotsScreen() {
  const { lots, rows, ensureStarted, rename, setShape, undo } = useLotEditor();
  const mapRef = useRef<MapViewHandle>(null);

  // A new farm starts with an empty "Lot 1" to draw.
  useLayoutEffect(() => ensureStarted(), [ensureStarted]);

  // The one lot on this screen: the saved lot, else the lot not drawn yet.
  const [savedId, setSavedId] = useState<string | undefined>(() => lots[0]?.id);
  const lot = rows.find((r) => r.id === savedId) ?? rows.find((r) => r.area_ha === null) ?? rows[0];
  const saved = lots.find((l) => l.id === lot?.id);
  const name = lot?.name ?? "your lot";

  const [mode, setMode] = useState<MapMode>("select");
  const [panel, setPanel] = useState<"pin" | "rename" | null>(null);
  const [areaText, setAreaText] = useState("");
  const [nameText, setNameText] = useState("");
  const [editingHa, setEditingHa] = useState<number | null>(null);
  const [status, setStatus] = useState(() =>
    lots.length > 0 ? ADJUST_HINT : "Move the map to your farm, then tap Draw and trace around your lot.",
  );

  const drawing = mode === "sketch" || mode === "corners" || mode === "pin";
  const typedArea = parseHectares(areaText);

  // Only this lot is on the map: an outline, or a pin for a pin lot.
  const mapLots = useMemo<MapLot[]>(
    () => (saved && !isPinLot(saved) ? [{ id: saved.id, name: saved.name, geometry: saved.geometry }] : []),
    [saved],
  );
  const mapPlaces = useMemo<MapPlace[]>(
    () => (saved && isPinLot(saved) ? [{ id: saved.id, name: saved.name, point: saved.centroid }] : []),
    [saved],
  );

  const start = (next: "sketch" | "corners" | "pin") => {
    setMode(next);
    setPanel(null);
    setEditingHa(null);
    setStatus(MODE_HINT[next]?.(name) ?? "");
  };

  const cancel = () => {
    setMode("select");
    setStatus(saved ? ADJUST_HINT : "Tap Draw to trace your lot, or Corners to tap its corners.");
  };

  // Android Back stops drawing instead of leaving the screen.
  useEffect(() => {
    if (!drawing) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      cancel();
      return true;
    });
    return () => sub.remove();
  });

  const onMapMessage = (msg: MapToApp) => {
    switch (msg.type) {
      case "lotChanged": {
        if (!lot || msg.id !== lot.id) return;
        // Tapping the lot also reports it; nothing to save when the outline didn't change.
        if (saved && JSON.stringify(saved.geometry) === JSON.stringify(msg.geojson)) return;
        const drawn = mode === "sketch" || mode === "corners";
        // A new lot is saved under the farm store's id.
        setSavedId(setShape(msg.id, { geometry: msg.geojson, area_ha: msg.area_ha, centroid: msg.centroid }));
        setEditingHa(null);
        // The area is on the lot chip above, so the hint doesn't repeat it.
        if (!drawn) setStatus("Saved.");
        else if (msg.fix === "unkinked") setStatus("Your lines crossed, so we kept the biggest part. Check the corners.");
        else if (msg.fix === "hull") setStatus("We made a simple outline from your sketch. Drag the corners to match your lot.");
        else setStatus(ADJUST_HINT);
        break;
      }
      case "lotEditing":
        setEditingHa(msg.area_ha);
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
        if (mode !== "pin" || !lot || typedArea === null) return;
        setSavedId(setShape(lot.id, pinShape(msg.point, typedArea)));
        setStatus(`Pin placed: ${typedArea} ha (your number). Tap Redraw if you can trace the lot later.`);
        setAreaText("");
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

  const area = editingHa ?? lot?.area_ha ?? null;
  const areaShown = area === null ? "" : lot?.pin && editingHa === null ? `${area} ha (your number)` : `${area.toFixed(2)} ha`;

  return (
    <Screen scrollEnabled={false} edgeToEdge>
      <View style={styles.map}>
        <MapView
          ref={mapRef}
          lots={mapLots}
          places={mapPlaces}
          mode={mode}
          activeLotId={lot?.id}
          onMessage={onMapMessage}
          accessibilityLabel="Satellite map of your farm"
          style={StyleSheet.absoluteFill}
        />

        {/* Top: back + title (left), Find me (right). The map's zoom buttons sit under Find me. */}
        <View style={[styles.float, styles.top]}>
          <Header title={saved ? name : "Draw your lot"} right="1 of 2" fallbackHref="/" />
        </View>
        <Pressable
          onPress={findMe}
          accessibilityRole="button"
          accessibilityLabel="Find me"
          style={({ pressed }) => [styles.float, styles.findMe, pressed && { backgroundColor: colors.pressed }]}
        >
          <Icon name="locate" color={colors.blue} />
        </Pressable>

        {/* Bottom: the hint and the actions for the current step, kept above the map credits. */}
        <View style={[styles.float, styles.bottom]}>
          {saved && !drawing && panel !== "rename" ? (
            <Pressable
              onPress={() => {
                setNameText(name);
                setPanel("rename");
              }}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${name}`}
              style={({ pressed }) => [styles.lotChip, pressed && { backgroundColor: colors.pressed }]}
            >
              <Text style={[text.bodyStrong, styles.flex]} numberOfLines={1}>
                {name} · {areaShown}
              </Text>
              <Icon name="pencil" size={18} />
            </Pressable>
          ) : null}

          <Text style={text.body} accessibilityLiveRegion="polite">
            {status}
          </Text>

          {panel === "rename" ? (
            <View style={styles.row}>
              <TextInput
                value={nameText}
                onChangeText={setNameText}
                onSubmitEditing={() => {
                  if (lot && nameText.trim()) rename(lot.id, nameText);
                  setPanel(null);
                }}
                autoFocus
                maxLength={40}
                returnKeyType="done"
                accessibilityLabel="Lot name"
                placeholder="e.g. Riverside paddy"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Button
                label="Save"
                disabled={!nameText.trim()}
                onPress={() => {
                  if (lot) rename(lot.id, nameText);
                  setPanel(null);
                }}
              />
              <Button label="Cancel" variant="quiet" onPress={() => setPanel(null)} />
            </View>
          ) : drawing ? (
            <View style={styles.row}>
              {mode !== "pin" ? (
                <Button
                  label={mode === "sketch" ? "Tap corners instead" : "Draw instead"}
                  icon={mode === "sketch" ? "corners" : "draw"}
                  variant="secondary"
                  onPress={() => start(mode === "sketch" ? "corners" : "sketch")}
                  style={styles.flex}
                />
              ) : null}
              <Button label="Cancel" variant="quiet" onPress={cancel} style={styles.flex} />
            </View>
          ) : panel === "pin" ? (
            <>
              <View style={styles.row}>
                <Text style={text.body}>Lot area</Text>
                <TextInput
                  value={areaText}
                  onChangeText={setAreaText}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1.5"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Lot area in hectares"
                  style={[styles.input, styles.areaInput]}
                />
                <Text style={[text.body, { color: colors.muted }]}>hectares</Text>
              </View>
              <View style={styles.row}>
                <Button
                  label="Drop the pin"
                  icon="pin"
                  disabled={typedArea === null}
                  onPress={() => start("pin")}
                  style={styles.flex}
                />
                <Button label="Cancel" variant="quiet" onPress={() => setPanel(null)} style={styles.flex} />
              </View>
            </>
          ) : saved ? (
            <>
              <View style={styles.row}>
                <Button
                  label="Undo"
                  icon="undo"
                  variant="quiet"
                  onPress={() => {
                    setEditingHa(null);
                    setMode("select");
                    setStatus(undo() ? "Undid the last change." : "Nothing to undo.");
                  }}
                  style={styles.flex}
                />
                <Button label="Redraw" icon="draw" variant="secondary" onPress={() => start("sketch")} style={styles.flex} />
              </View>
              <Button label="Next: your crops" href="/crops" size="lg" />
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Button label="Draw" icon="draw" onPress={() => start("sketch")} style={styles.flex} />
                <Button
                  label="Corners"
                  icon="corners"
                  variant="secondary"
                  accessibilityLabel="Tap the corners"
                  onPress={() => start("corners")}
                  style={styles.flex}
                />
              </View>
              <Button label="Can't draw? Drop a pin and type the area" variant="link" onPress={() => setPanel("pin")} />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const SHADOW = "0px 2px 8px rgba(0, 0, 0, 0.28)";

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { flex: 1, minHeight: 480, backgroundColor: colors.mapBg },
  float: { position: "absolute", backgroundColor: colors.surface, boxShadow: SHADOW },
  // Top left, leaving room for Find me (right).
  top: { top: 10, left: 10, right: 68, borderRadius: radius.lg, paddingHorizontal: 4 },
  findMe: {
    top: 10,
    right: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bottom, above the two-line map credits (Leaflet attribution) so they stay readable.
  bottom: { left: 10, right: 10, bottom: 44, gap: space.sm, padding: space.md, borderRadius: radius.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  lotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.greenTint,
  },
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
  areaInput: { flex: 0, width: 96 },
});
