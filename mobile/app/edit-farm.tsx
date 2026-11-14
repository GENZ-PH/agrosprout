import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../src/components/Button";
import { CropChips } from "../src/components/CropChips";
import { Disclaimer } from "../src/components/Disclaimer";
import { Header } from "../src/components/Header";
import { LotDetailsForm } from "../src/components/LotDetailsForm";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { cropById } from "../src/data/crops";
import { isOtherCrop, otherCropName } from "../src/lots/crop-picks";
import { modeLabel, typeLabel } from "../src/places/places-core";
import { useFarm, useFarmStore } from "../src/state/farm-store";
import type { Lot } from "../src/types";

// Edit farm (#35, docs/11 "Always available"): change anything entered earlier. Each lot can be
// renamed, adjusted or redrawn on the map, given other crops, months or details, or deleted (after a confirm). Places open S6.
// A hub: the screens that do the work already exist, this page only links to them.

export default function EditFarmScreen() {
  const farm = useFarm();
  return (
    <Screen footer={<Disclaimer />}>
      <Header title="Edit your farm" fallbackHref="/dashboard" />
      <Text style={text.body}>Change anything you entered. Your results update by themselves.</Text>

      <Text style={text.heading} accessibilityRole="header">
        Lots
      </Text>
      {farm.lots.length === 0 ? <Notice>You have no lots yet.</Notice> : null}
      {farm.lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} />
      ))}
      <Button label="Add a lot" icon="plus" variant="secondary" href={{ pathname: "/lots", params: { new: "1" } }} />

      <Text style={text.heading} accessibilityRole="header">
        Places where your harvest goes
      </Text>
      {farm.destinations.length === 0 ? (
        <Text style={text.small}>No places yet. Travel to market is left out of the scores.</Text>
      ) : (
        farm.destinations.map((d) => (
          <Text key={d.id} style={text.body}>
            {d.name} · {typeLabel(d.type)} · {modeLabel(d.mode)}
          </Text>
        ))
      )}
      <Button label={farm.destinations.length === 0 ? "Add a place" : "Add or change places"} variant="secondary" href="/places" />
    </Screen>
  );
}

function LotCard({ lot }: { lot: Lot }) {
  const updateLot = useFarmStore((s) => s.updateLot);
  const deleteLot = useFarmStore((s) => s.deleteLot);
  const [name, setName] = useState(lot.name);
  const [details, setDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trimmed = name.trim();
  const changed = trimmed !== "" && trimmed !== lot.name;
  const cropName = (id: string) => (isOtherCrop(id) ? otherCropName(id) : (cropById(id)?.name ?? id));
  const crops = lot.crops.map((c) => cropName(c.crop_id));

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          accessibilityLabel={`Name of ${lot.name}`}
          style={[styles.input, styles.grow]}
        />
        <Button label="Save name" variant="secondary" disabled={!changed} onPress={() => updateLot(lot.id, { name: trimmed })} />
      </View>
      <Text style={text.caption}>
        {lot.area_ha.toFixed(2)} ha · {crops.length > 0 ? crops.join(", ") : "no crops yet"}
      </Text>
      <CropChips cropIds={lot.crops.map((c) => c.crop_id)} cropName={cropName} />

      <View style={styles.row}>
        <Button
          label="Adjust or redraw"
          variant="secondary"
          href={{ pathname: "/lots", params: { lot: lot.id } }}
          style={styles.grow}
        />
        <Button label="Crops" variant="secondary" href={{ pathname: "/crops", params: { lot: lot.id } }} style={styles.grow} />
        <Button label="Months" variant="secondary" href={{ pathname: "/months", params: { lot: lot.id } }} style={styles.grow} />
      </View>

      <Button
        label={details ? "Hide land, water and soil" : "Land, water and soil (optional)"}
        variant="link"
        onPress={() => setDetails((v) => !v)}
      />
      {details ? <LotDetailsForm value={lot.details} onChange={(next) => updateLot(lot.id, { details: next })} /> : null}

      {confirmDelete ? (
        <View style={styles.row}>
          <Button label={`Yes, delete ${lot.name}`} variant="danger" onPress={() => deleteLot(lot.id)} style={styles.grow} />
          <Button label="Keep it" variant="quiet" onPress={() => setConfirmDelete(false)} style={styles.grow} />
        </View>
      ) : (
        <Button label="Delete this lot" variant="link" onPress={() => setConfirmDelete(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  grow: { flexGrow: 1 },
  input: {
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.ink,
  },
});
