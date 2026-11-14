import { StyleSheet, Text, View } from "react-native";

import type { HarvestLeg } from "../engine/analyze";
import { formatMinutes, modeLabel, sourceLabel, typeLabel } from "../places/places-core";
import type { Destination, Lot } from "../types";
import { Button } from "./Button";
import { CropImage } from "./CropImage";
import { InfoCard } from "./InfoCard";
import { colors, space, text } from "./theme";

// "Getting your harvest out" (S3, #29/#30): the places the farmer added, the travel time from this
// lot to each (with how it was found), and the buttons to add or change places. Optional: with no
// place the card says what is left out and the dashboard still works.

type Props = {
  lot: Pick<Lot, "id" | "name" | "travel">;
  destinations: readonly Destination[];
  harvest: readonly HarvestLeg[];
  cropName: (id: string) => string;
  period: string;
};

export function HarvestCard({ lot, destinations, harvest, cropName, period }: Props) {
  return (
    <InfoCard
      title="Getting your harvest out"
      explainer="harvest-out"
      period={period}
      subtitle={destinations.length === 0 ? undefined : `From ${lot.name}`}
    >
      {destinations.length === 0 ? (
        <Text style={text.body}>Add a place to include travel to market. Until then, travel is left out of the scores.</Text>
      ) : (
        <View style={styles.list}>
          {destinations.map((d) => {
            const t = lot.travel.find((x) => x.destination_id === d.id);
            const legs = harvest.filter((h) => h.destination_id === d.id && h.hours !== null);
            return (
              <View key={d.id} style={styles.place}>
                <Text style={text.bodyStrong}>
                  {d.name} · {typeLabel(d.type)}
                </Text>
                <Text style={text.small}>
                  {modeLabel(d.mode)} ·{" "}
                  {t && t.minutes !== null
                    ? `about ${formatMinutes(t.minutes)} one way (${sourceLabel(t.source)})`
                    : "working out the travel time…"}
                </Text>
                {legs.map((h) => (
                  <View key={h.crop_id} style={styles.leg}>
                    <CropImage cropId={h.crop_id} size={24} />
                    <Text style={[text.caption, styles.legText]}>
                      {cropName(h.crop_id)}: {h.trips.trips} {h.trips.trips === 1 ? "trip" : "trips"} of{" "}
                      {Math.round(h.trips.load_kg ?? 0)} kg ({h.trips.load_source === "farmer" ? "your load" : "assumed load"}), about{" "}
                      {formatMinutes((h.hours ?? 0) * 60)} on the road
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
      <Button
        label={destinations.length === 0 ? "Add a place" : "Add or change places"}
        variant={destinations.length === 0 ? "primary" : "secondary"}
        href="/places"
      />
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  leg: { flexDirection: "row", alignItems: "center", gap: space.sm },
  legText: { flex: 1 },
  place: { gap: 2, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
