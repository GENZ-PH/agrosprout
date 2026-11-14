import * as Location from "expo-location";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Button } from "../src/components/Button";
import { Icon, type IconName } from "../src/components/Icon";
import { LotDetailsForm } from "../src/components/LotDetailsForm";
import { Screen } from "../src/components/Screen";
import { colors, MIN_TOUCH, radius, space, text } from "../src/components/theme";
import { isPinLot, parseHectares, pinShape } from "../src/lots/lot-editor";
import { useLotEditor } from "../src/lots/use-lot-editor";
import type { MapInset, MapLot, MapMode, MapPlace, MapToApp } from "../src/map/bridge";
import { MapView, type MapViewHandle } from "../src/map/MapView";
import { useFarmStore } from "../src/state/farm-store";

// S1 Draw your lot (#21, docs/11-user-flow.md): a full-screen map for ONE lot. Only a
// back button floats at the top; the steps and actions sit in one panel at the bottom
// (lower right on a wide screen). More lots are added later from the dashboard
// (D32, proposed): "+ Add lot" opens this screen as /lots?new=1 for the next "Lot N",
// then S2 for that lot only. A drawn lot is saved in the farm store (#18) at once, and
// the lot sync starts fetching its NASA data in the background. Next → S2 crops.

const MODE_HINT: Partial<Record<MapMode, (lot: string) => string>> = {
  sketch: (lot) => `Trace around ${lot} with one finger. Two fingers move and zoom the map.`,
  corners: (lot) => `Tap each corner of ${lot}, then tap the first corner again to finish.`,
  pin: (lot) => `Tap the map where ${lot} is.`,
};

const START_HINT = "Move the map to your farm and zoom in until you can see the edges of your lot.";
const ADD_HINT = "Move the map to your new lot until you can see its edges. Your other lots show as named dots.";
const SAVED_HINT = "Your lot is saved. To fix its edges, tap Adjust.";
const ADJUST_HINT = "Drag the white dots to fit your lot. Tap a yellow dot to add a corner. Press and hold a dot to remove it.";

// Zoom check before drawing (UI choice, not a sourced number). Web Mercator ground
// resolution is 156,543 m × cos(latitude) / 2^zoom per pixel: at Iligan (8.2° N) about
// 19 m/px at zoom 13, 2.4 m/px at 16 and 1.2 m/px at 17. So a 100 m × 100 m (1 ha)
// lot is ~5 px wide at 13 (too small to trace), ~42 px at 16 and ~85 px at 17.
const MIN_DRAW_ZOOM = 16;
const DRAW_ZOOM = 17;

/** Wider than this, the panel becomes a card in the lower right corner. */
const WIDE = 768;
const SHEET_WIDE_WIDTH = 400;
/** The panel sits above the map credits (Leaflet attribution: two lines on a phone). */
const SHEET_PHONE_BOTTOM = 44;

export default function LotsScreen() {
  const { lots, rows, ensureStarted, startNewLot, clearHistory, rename, setShape, undo } = useLotEditor();
  /** Opened from "+ Add lot" on the dashboard: draw one more lot. */
  const adding = useLocalSearchParams<{ new?: string }>().new === "1";
  const mapRef = useRef<MapViewHandle>(null);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const wide = winWidth >= WIDE;
  const [sheetHeight, setSheetHeight] = useState(0);
  // Fitting the map to the lot keeps it clear of the round buttons (top) and the panel.
  const inset = useMemo<MapInset>(
    () =>
      wide
        ? { top: 58, right: 16 + SHEET_WIDE_WIDTH, bottom: 0, left: 0 }
        : { top: 58, right: 0, bottom: SHEET_PHONE_BOTTOM + sheetHeight, left: 0 },
    [wide, sheetHeight],
  );

  // The one lot on this screen: the saved lot, else the lot not drawn yet.
  const [savedId, setSavedId] = useState<string | undefined>(() => (adding ? undefined : lots[0]?.id));
  // Undo covers this visit only. A new farm starts with an empty "Lot 1" to draw;
  // "+ Add lot" starts the next "Lot N" (the lot not drawn yet, found below).
  useLayoutEffect(() => {
    clearHistory();
    if (adding) startNewLot();
    else ensureStarted();
  }, [adding, clearHistory, ensureStarted, startNewLot]);
  const lot =
    rows.find((r) => r.id === savedId) ?? rows.find((r) => r.area_ha === null) ?? (adding ? undefined : rows[0]);
  const saved = lots.find((l) => l.id === lot?.id);
  const updateLot = useFarmStore((s) => s.updateLot);
  const name = lot?.name ?? "your lot";

  const [mode, setMode] = useState<MapMode>("view");
  const zoom = useRef<number | null>(null);
  const [panel, setPanel] = useState<"pin" | "rename" | "details" | null>(null);
  const [areaText, setAreaText] = useState("");
  const [nameText, setNameText] = useState("");
  const [editingHa, setEditingHa] = useState<number | null>(null);
  const [status, setStatus] = useState(() => (adding ? ADD_HINT : lots.length > 0 ? SAVED_HINT : START_HINT));

  const drawing = mode === "sketch" || mode === "corners" || mode === "pin";
  /** The lot's points are showing (map "select" mode). */
  const adjusting = mode === "select";
  const typedArea = parseHectares(areaText);

  // Only this lot is on the map: an outline, or a pin for a pin lot. When adding a lot,
  // the farm's other lots show as named dots, and the map starts near them.
  const others = useMemo(() => (adding ? lots.filter((l) => l.id !== lot?.id) : []), [adding, lots, lot?.id]);
  const mapLots = useMemo<MapLot[]>(
    () => (saved && !isPinLot(saved) ? [{ id: saved.id, name: saved.name, geometry: saved.geometry }] : []),
    [saved],
  );
  const mapPlaces = useMemo<MapPlace[]>(
    () => [
      ...(saved && isPinLot(saved) ? [{ id: saved.id, name: saved.name, point: saved.centroid }] : []),
      ...others.map((l) => ({ id: l.id, name: l.name, point: l.centroid })),
    ],
    [saved, others],
  );
  const nextHref: Href = adding && lot ? { pathname: "/crops", params: { lot: lot.id } } : "/crops";

  const start = (next: "sketch" | "corners" | "pin") => {
    setPanel(null);
    setEditingHa(null);
    // Too far out to see the lot's edges: zoom in first, and let the farmer line the lot up.
    if (next !== "pin" && zoom.current !== null && zoom.current < MIN_DRAW_ZOOM) {
      setMode("view");
      mapRef.current?.send({ type: "zoomIn", zoom: DRAW_ZOOM });
      const button = next === "corners" ? "Tap corners" : saved ? "Redraw" : "Draw with your finger";
      setStatus(`We zoomed in so you can see the edges of your lot. Move the map so your lot is in the middle, then tap ${button} again.`);
      return;
    }
    setMode(next);
    setStatus(MODE_HINT[next]?.(name) ?? "");
  };

  const cancel = () => {
    setMode("view");
    setStatus(saved ? SAVED_HINT : adding ? ADD_HINT : START_HINT);
  };

  const adjust = () => {
    setMode("select");
    setStatus(ADJUST_HINT);
  };

  const done = () => {
    setMode("view");
    setEditingHa(null);
    setStatus(SAVED_HINT);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(adding ? "/dashboard" : "/"));

  // Android Back stops drawing or adjusting instead of leaving the screen.
  useEffect(() => {
    if (!drawing && !adjusting) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (adjusting) done();
      else cancel();
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
        // The area is shown big in the panel, so the hint doesn't repeat it.
        if (!drawn) setStatus("Saved.");
        else if (msg.fix === "unkinked") setStatus("Your lines crossed, so we kept the biggest part. Tap Adjust to check the corners.");
        else if (msg.fix === "hull") setStatus("We made a simple outline from your sketch. Tap Adjust to match the corners to your lot.");
        else setStatus(SAVED_HINT);
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
      case "zoomChanged":
        zoom.current = msg.zoom;
        break;
      case "pinPlaced": {
        if (mode !== "pin" || !lot || typedArea === null) return;
        setSavedId(setShape(lot.id, pinShape(msg.point, typedArea)));
        setStatus("Pin placed. Tap Redraw if you can trace the lot later.");
        setAreaText("");
        setMode("view");
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
  const typedPin = !!lot?.pin && editingHa === null;
  const areaShown = area === null ? "" : typedPin ? `${area} ha` : `${area.toFixed(2)} ha`;

  const undoLast = () => {
    setEditingHa(null);
    setStatus(undo() ? "Undid the last change." : "Nothing to undo.");
  };

  const saveName = () => {
    if (lot && nameText.trim()) rename(lot.id, nameText);
    setPanel(null);
  };

  const hint = (
    <Text style={styles.hint} accessibilityLiveRegion="polite">
      {status}
    </Text>
  );
  const step = <Text style={styles.step}>{adding ? "NEW LOT" : "STEP 1 OF 2"}</Text>;

  return (
    <Screen scrollEnabled={false} edgeToEdge>
      <View style={styles.map}>
        <MapView
          ref={mapRef}
          lots={mapLots}
          places={mapPlaces}
          center={others[0]?.centroid}
          zoom={others.length > 0 ? MIN_DRAW_ZOOM : undefined}
          mode={mode}
          activeLotId={lot?.id}
          inset={inset}
          onMessage={onMapMessage}
          accessibilityLabel="Satellite map of your farm"
          style={StyleSheet.absoluteFill}
        />

        {/* Top: back (left), Find me (right). The map's zoom buttons sit under Find me. */}
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.round, styles.back, pressed && styles.roundPressed]}
        >
          <Icon name="back" />
        </Pressable>
        <Pressable
          onPress={findMe}
          accessibilityRole="button"
          accessibilityLabel="Find me"
          style={({ pressed }) => [styles.round, styles.findMe, pressed && styles.roundPressed]}
        >
          <Icon name="locate" color={colors.blue} />
        </Pressable>

        {/* The panel: what to do now, and one main action. Kept above the map credits. */}
        <View
          onLayout={(e) => setSheetHeight(Math.round(e.nativeEvent.layout.height))}
          style={[styles.sheet, wide ? styles.sheetWide : styles.sheetPhone]}
        >
          {panel === "rename" ? (
            <>
              <Text style={text.title} accessibilityRole="header">
                Name your lot
              </Text>
              <TextInput
                value={nameText}
                onChangeText={setNameText}
                onSubmitEditing={saveName}
                autoFocus
                maxLength={40}
                returnKeyType="done"
                accessibilityLabel="Lot name"
                placeholder="e.g. Riverside paddy"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <View style={styles.row}>
                <Button label="Save" icon="check" disabled={!nameText.trim()} onPress={saveName} style={styles.flex} />
                <Button label="Cancel" variant="quiet" onPress={() => setPanel(null)} style={styles.flex} />
              </View>
            </>
          ) : panel === "details" && saved ? (
            <>
              <Text style={text.title} accessibilityRole="header">
                {`About ${name} (optional)`}
              </Text>
              {/* Three questions are taller than the panel on a phone: scroll them, keep Done in view. */}
              <ScrollView style={{ maxHeight: Math.max(160, winHeight - 260) }}>
                <LotDetailsForm value={saved.details} onChange={(details) => updateLot(saved.id, { details })} />
              </ScrollView>
              <Button label="Done" icon="check" onPress={() => setPanel(null)} />
            </>
          ) : drawing ? (
            <>
              <View style={styles.titleRow}>
                <View style={styles.dot} />
                <Text style={[text.heading, styles.flex]} accessibilityRole="header">
                  {mode === "pin" ? `Placing ${name}` : `Drawing ${name}`}
                </Text>
              </View>
              {hint}
              <View style={styles.row}>
                {mode !== "pin" ? (
                  <Button
                    label={mode === "sketch" ? "Tap corners" : "Draw instead"}
                    icon={mode === "sketch" ? "corners" : "draw"}
                    variant="secondary"
                    onPress={() => start(mode === "sketch" ? "corners" : "sketch")}
                    style={styles.flex}
                  />
                ) : null}
                <Button label="Cancel" icon="close" variant="quiet" onPress={cancel} style={styles.flex} />
              </View>
            </>
          ) : panel === "pin" ? (
            <>
              <Text style={text.title} accessibilityRole="header">
                Drop a pin
              </Text>
              <Text style={styles.hint}>How big is your lot? Then tap the map where it is.</Text>
              <View style={styles.row}>
                <TextInput
                  value={areaText}
                  onChangeText={setAreaText}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1.5"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Lot area in hectares"
                  style={[styles.input, styles.areaInput]}
                />
                <Text style={text.bodyStrong}>hectares</Text>
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
              {adjusting ? null : step}
              <View style={styles.titleRow}>
                <Pressable
                  onPress={() => {
                    setNameText(name);
                    setPanel("rename");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}. Tap to rename`}
                  style={({ pressed }) => [styles.nameButton, pressed && { backgroundColor: colors.pressed }]}
                >
                  <Text style={[text.title, styles.shrink]} numberOfLines={1} accessibilityRole="header">
                    {name}
                  </Text>
                  <Icon name="pencil" size={20} color={colors.muted} />
                </Pressable>
                <View style={styles.areaBox} accessibilityLabel={`Area ${areaShown}${typedPin ? ", your number" : ""}`}>
                  <Text style={styles.area}>{areaShown}</Text>
                  {typedPin ? <Text style={text.caption}>your number</Text> : null}
                </View>
              </View>
              {hint}
              {adjusting ? (
                <View style={styles.row}>
                  <Button label="Undo" icon="undo" variant="quiet" onPress={undoLast} style={styles.flex} />
                  <Button label="Done" icon="check" onPress={done} style={styles.flex} />
                </View>
              ) : (
                <>
                  <View style={styles.row}>
                    <Tool icon="undo" label="Undo" onPress={undoLast} />
                    {/* A pin lot has no corners to adjust. */}
                    {lot?.pin ? null : (
                      <Tool icon="shape" label="Adjust" accessibilityLabel="Adjust the corners" onPress={adjust} />
                    )}
                    <Tool icon="draw" label="Redraw" onPress={() => start("sketch")} />
                    <Tool icon="sprout" label="Details" accessibilityLabel="Optional lot details: land, water, soil" onPress={() => setPanel("details")} />
                  </View>
                  <Button
                    label={adding ? `Next: crops for ${name}` : "Next: your crops"}
                    iconAfter="chevron"
                    href={nextHref}
                    size="lg"
                  />
                </>
              )}
            </>
          ) : (
            <>
              {step}
              <Text style={text.title} accessibilityRole="header">
                {adding ? `Draw ${name}` : "Draw your lot"}
              </Text>
              {hint}
              <Button label="Draw with your finger" icon="draw" size="lg" onPress={() => start("sketch")} />
              <View style={styles.row}>
                <Button
                  label="Tap corners"
                  icon="corners"
                  variant="secondary"
                  onPress={() => start("corners")}
                  style={styles.flex}
                />
                <Button
                  label="Drop a pin"
                  icon="pin"
                  variant="secondary"
                  accessibilityHint="Type the area, then tap the map where your lot is"
                  onPress={() => setPanel("pin")}
                  style={styles.flex}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

/** A square-ish tool button: icon above a short label, for the lot's tools. */
function Tool({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.greenTint }]}
    >
      <Icon name={icon} color={colors.green} />
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

const ROUND_SHADOW = "0px 2px 8px rgba(0, 0, 0, 0.28)";
const SHEET_SHADOW = "0px 8px 28px rgba(0, 0, 0, 0.24), 0px 1px 4px rgba(0, 0, 0, 0.12)";

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  map: { flex: 1, minHeight: 480, backgroundColor: colors.mapBg },
  // Round map buttons, 10 px from the edges like the map's zoom buttons.
  round: {
    position: "absolute",
    top: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    boxShadow: ROUND_SHADOW,
  },
  roundPressed: { backgroundColor: colors.pressed },
  back: { left: 10 },
  findMe: { right: 10 },
  sheet: {
    position: "absolute",
    gap: space.md,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.surface,
    boxShadow: SHEET_SHADOW,
  },
  // Phone: across the bottom, above the two-line map credits (Leaflet attribution).
  sheetPhone: { left: 10, right: 10, bottom: SHEET_PHONE_BOTTOM },
  // Wide screen: a card in the lower right, above the one-line map credits.
  sheetWide: { right: 16, bottom: 36, width: SHEET_WIDE_WIDTH },
  step: { ...text.caption, fontWeight: "700", letterSpacing: 1, color: colors.green, marginBottom: -space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  nameButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TOUCH,
    marginLeft: -space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  areaBox: { alignItems: "flex-end" },
  area: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: colors.green },
  hint: text.body,
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.green },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    ...text.body,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
  },
  areaInput: { width: 120 },
  tool: {
    flex: 1,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  toolLabel: { ...text.small, fontWeight: "600" },
});
