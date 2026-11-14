import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../src/components/Button";
import { ChoiceGroup } from "../src/components/ChoiceGroup";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { ROUTING_ATTRIBUTION } from "../src/data/routing";
import { isPinLot } from "../src/lots/lot-editor";
import type { MapLot, MapMode, MapPlace, MapToApp } from "../src/map/bridge";
import { MapView } from "../src/map/MapView";
import {
  changeTravel,
  confirmTravel,
  defaultPlaceName,
  formatMinutes,
  MAX_MINUTES,
  MODE_OPTIONS,
  modeLabel,
  mapPlaces,
  parseMinutes,
  PLACE_TYPE_OPTIONS,
  placeFromDraft,
  sourceLabel,
  travelRows,
  typeLabel,
  type PlaceDraft,
  type TravelRow,
} from "../src/places/places-core";
import { useFarmStore } from "../src/state/farm-store";
import type { Destination } from "../src/types";

// S6 "Where does your harvest go?" (#30, docs/11-user-flow.md). Opened from the dashboard or
// Edit farm, never forced: a farmer can skip it forever. Pin a place, say how you get there, and
// check the travel time from each lot. The times themselves are filled by the travel sync
// (src/state/travel-sync-core.ts), a road route when online and a labelled rough estimate
// otherwise. The farmer's own time always wins (CLAUDE.md rule 9).

const EMPTY_DRAFT: PlaceDraft = { point: null, name: "", type: "market", mode: "motorcycle", loadText: "", fareText: "" };

const PROBLEM: Record<string, string> = {
  "no-point": "Tap the map to drop a pin where this place is.",
  "no-name": "Give this place a name.",
  "bad-load": "Type the load in kg, like 80, or leave it empty if you don't know.",
  "bad-fare": "Type the fare in pesos, like 35, or leave it empty if you don't know.",
};

export default function PlacesScreen() {
  const lots = useFarmStore((s) => s.lots);
  const destinations = useFarmStore((s) => s.destinations);
  const addDestination = useFarmStore((s) => s.addDestination);
  const updateDestination = useFarmStore((s) => s.updateDestination);
  const deleteDestination = useFarmStore((s) => s.deleteDestination);
  const setTravel = useFarmStore((s) => s.setTravel);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PlaceDraft>(EMPTY_DRAFT);
  const [problem, setProblem] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("view");

  const mapLots = useMemo<MapLot[]>(
    () => lots.filter((l) => !isPinLot(l)).map((l) => ({ id: l.id, name: l.name, geometry: l.geometry })),
    [lots],
  );
  const places = useMemo<MapPlace[]>(() => {
    const pinLots = lots.filter(isPinLot).map((l) => ({ id: l.id, name: l.name, point: l.centroid }));
    const draftPin = adding && draft.point ? [{ id: "draft", name: "New place", point: draft.point }] : [];
    return [...pinLots, ...mapPlaces(destinations), ...draftPin];
  }, [lots, destinations, adding, draft.point]);

  const onMapMessage = (msg: MapToApp) => {
    if (msg.type === "pinPlaced" && adding) {
      setDraft((d) => ({ ...d, point: msg.point }));
      setProblem(null);
      setMapMode("view");
    } else if (msg.type === "error") {
      console.warn("[map]", msg.message);
    }
  };

  const startAdding = () => {
    setDraft(EMPTY_DRAFT);
    setProblem(null);
    setAdding(true);
    setMapMode("pin");
  };
  const stopAdding = () => {
    setAdding(false);
    setProblem(null);
    setMapMode("view");
  };
  const savePlace = () => {
    const name = draft.name.trim() || defaultPlaceName(draft.type, destinations);
    const result = placeFromDraft({ ...draft, name });
    if (!result.ok) {
      setProblem(PROBLEM[result.problem]);
      return;
    }
    addDestination(result.destination);
    stopAdding();
  };

  const done = () => (router.canGoBack() ? router.back() : router.replace("/dashboard"));
  const anyRoute = lots.some((l) => l.travel.some((t) => t.source === "route"));
  const hint = adding
    ? draft.point
      ? "Pin placed. Fill in the details below, or tap Move the pin."
      : "Tap the map where the place is."
    : destinations.length === 0
      ? "You can skip this. Without a place, the app leaves travel to market out of the results."
      : "Pins show your lots and places.";

  return (
    <Screen footer={<Button label="Done" size="lg" onPress={done} />}>
      <View style={styles.page}>
        <Header title="Where does your harvest go?" fallbackHref="/dashboard" />
        <Text style={text.body}>
          Add the market, storage, buyer or cooperative you use. The app then shows how long the trip takes from each lot. This is optional, and you can add places any time.
        </Text>

        <View style={styles.mapBox}>
          <MapView
            lots={mapLots}
            places={places}
            mode={mapMode}
            center={lots[0]?.centroid}
            onMessage={onMapMessage}
            accessibilityLabel="Satellite map of your lots and places"
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Text style={text.caption} accessibilityLiveRegion="polite">
          {hint}
        </Text>

        {adding ? (
          <View style={styles.card}>
            <Text style={text.heading} accessibilityRole="header">
              New place
            </Text>
            {draft.point ? (
              <Button label="Move the pin" variant="link" onPress={() => setMapMode("pin")} />
            ) : null}
            <ChoiceGroup
              title="What kind of place is it?"
              options={PLACE_TYPE_OPTIONS}
              value={draft.type}
              onChange={(type) => setDraft((d) => ({ ...d, type }))}
            />
            <View style={styles.field}>
              <Text style={text.bodyStrong}>Name</Text>
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
                placeholder={defaultPlaceName(draft.type, destinations)}
                placeholderTextColor={colors.muted}
                accessibilityLabel="Name of the place"
                style={styles.input}
              />
            </View>
            <ChoiceGroup
              title="How do you usually get there?"
              options={MODE_OPTIONS}
              value={draft.mode}
              onChange={(mode) => setDraft((d) => ({ ...d, mode }))}
            />
            <View style={styles.field}>
              <Text style={text.bodyStrong}>Usual load per trip, in kg (optional)</Text>
              <Text style={text.caption}>Leave it empty if you do not know. The app then uses an assumed load for your way of travelling.</Text>
              <TextInput
                value={draft.loadText}
                onChangeText={(loadText) => setDraft((d) => ({ ...d, loadText }))}
                keyboardType="numeric"
                placeholder="I don't know"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Usual load per trip in kilograms"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={text.bodyStrong}>One-way fare, in pesos (optional)</Text>
              <Text style={text.caption}>Only if you pay for the ride. The app never guesses a fare.</Text>
              <TextInput
                value={draft.fareText}
                onChangeText={(fareText) => setDraft((d) => ({ ...d, fareText }))}
                keyboardType="numeric"
                placeholder="I don't know"
                placeholderTextColor={colors.muted}
                accessibilityLabel="One-way fare in pesos"
                style={styles.input}
              />
            </View>
            {problem ? (
              <Text style={styles.problem} accessibilityRole="alert">
                {problem}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button label="Save place" onPress={savePlace} disabled={!draft.point} style={styles.grow} />
              <Button label="Cancel" variant="quiet" onPress={stopAdding} style={styles.grow} />
            </View>
          </View>
        ) : (
          <Button label="Add a place" variant="dashed" icon="plus" onPress={startAdding} />
        )}

        {destinations.map((d) => (
          <PlaceCard
            key={d.id}
            destination={d}
            rows={travelRows(lots, d.id)}
            onChangeMode={(mode) => updateDestination(d.id, { mode })}
            onRemove={() => deleteDestination(d.id)}
            onSaveTravel={(lotId, travel) => setTravel(lotId, travel)}
          />
        ))}

        {destinations.length > 0 ? (
          <Notice tone="warn">
            Travel times use average speeds and waiting times for each way of travelling, and a rough estimate when there is no signal. These are assumptions, so please check them. Your own time always wins.
          </Notice>
        ) : null}
        {anyRoute ? <Text style={text.caption}>{ROUTING_ATTRIBUTION}</Text> : null}
        <Disclaimer />
      </View>
    </Screen>
  );
}

function PlaceCard({
  destination: d,
  rows,
  onChangeMode,
  onRemove,
  onSaveTravel,
}: {
  destination: Destination;
  rows: TravelRow[];
  onChangeMode: (mode: Destination["mode"]) => void;
  onRemove: () => void;
  onSaveTravel: (lotId: string, travel: ReturnType<typeof confirmTravel>) => void;
}) {
  const [changingMode, setChangingMode] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <View style={styles.card}>
      <Text style={text.heading} accessibilityRole="header">
        {d.name}
      </Text>
      <Text style={text.small}>
        {typeLabel(d.type)} · {modeLabel(d.mode)}
        {d.load_kg_per_trip !== null ? ` · ${d.load_kg_per_trip} kg per trip` : ""}
        {d.fare_one_way !== null ? ` · fare ${d.fare_one_way} pesos one way` : ""}
      </Text>

      {changingMode ? (
        <ChoiceGroup
          title="How do you usually get there?"
          hint="If you change this, check the times below again."
          options={MODE_OPTIONS}
          value={d.mode}
          onChange={(mode) => {
            onChangeMode(mode);
            setChangingMode(false);
          }}
        />
      ) : (
        <Button label="Change how you get there" variant="link" onPress={() => setChangingMode(true)} />
      )}

      {rows.length === 0 ? <Text style={text.small}>Draw a lot first to see travel times.</Text> : null}
      {rows.map((r) => (
        <TravelRowView key={r.lotId} row={r} place={d} onSave={(t) => onSaveTravel(r.lotId, t)} />
      ))}

      {confirmRemove ? (
        <View style={styles.actions}>
          <Button label="Yes, remove this place" variant="danger" onPress={onRemove} style={styles.grow} />
          <Button label="Keep it" variant="quiet" onPress={() => setConfirmRemove(false)} style={styles.grow} />
        </View>
      ) : (
        <Button label="Remove this place" variant="link" onPress={() => setConfirmRemove(true)} />
      )}
    </View>
  );
}

function TravelRowView({
  row,
  place,
  onSave,
}: {
  row: TravelRow;
  place: Destination;
  onSave: (t: ReturnType<typeof confirmTravel>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [minutesText, setMinutesText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = row.travel;

  if (!t) {
    return (
      <View style={styles.row}>
        <Text style={text.bodyStrong}>
          {row.lotName} → {place.name}
        </Text>
        <Text style={text.small}>Working out the travel time…</Text>
      </View>
    );
  }

  const saveTyped = () => {
    const minutes = parseMinutes(minutesText);
    if (minutes === null) {
      setError(`Type the minutes of one trip, from 1 to ${MAX_MINUTES}.`);
      return;
    }
    onSave(changeTravel(place.id, minutes, t));
    setEditing(false);
    setError(null);
  };

  return (
    <View style={styles.row}>
      <Text style={text.bodyStrong}>
        {row.lotName} → {place.name}
      </Text>
      <Text style={text.small}>
        {modeLabel(place.mode)} · about {formatMinutes(t.minutes)} one way ({sourceLabel(t.source)})
        {t.distance_km !== null ? ` · ${t.distance_km.toFixed(1)} km` : ""}
      </Text>
      {t.source === "estimate" ? <Text style={styles.warn}>This is a rough estimate. Please check it.</Text> : null}

      {editing ? (
        <View style={styles.field}>
          <TextInput
            value={minutesText}
            onChangeText={setMinutesText}
            keyboardType="numeric"
            autoFocus
            placeholder="Minutes one way"
            placeholderTextColor={colors.muted}
            accessibilityLabel={`Your travel time from ${row.lotName} to ${place.name}, in minutes, one way`}
            style={styles.input}
          />
          {error ? (
            <Text style={styles.problem} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button label="Save my time" onPress={saveTyped} style={styles.grow} />
            <Button
              label="Cancel"
              variant="quiet"
              onPress={() => {
                setEditing(false);
                setError(null);
              }}
              style={styles.grow}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {t.source !== "farmer" ? (
            <Button label="Looks right ✓" variant="secondary" onPress={() => onSave(confirmTravel(t))} style={styles.grow} />
          ) : null}
          <Button
            label="Change: __ min"
            variant="quiet"
            onPress={() => {
              setMinutesText(String(Math.round(t.minutes)));
              setEditing(true);
            }}
            style={styles.grow}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg, paddingBottom: space.xl },
  mapBox: { height: 300, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.mapBg },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { gap: space.xs, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  field: { gap: space.xs },
  input: {
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...text.body,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  grow: { flexGrow: 1, flexBasis: 140 },
  problem: { ...text.small, color: colors.danger },
  warn: { ...text.small, color: colors.amber },
});
