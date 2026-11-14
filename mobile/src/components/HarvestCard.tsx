import { StyleSheet, Text, View } from "react-native";

import type { LotAnalysis } from "../engine";
import type { Destination, Lot } from "../types";
import { Button } from "./Button";
import { cropTrip, placeRows, TRIP_LABELS, tripsLine, type TripLevel } from "./harvest-card-core";
import { InfoCard } from "./InfoCard";
import { shortCropName } from "./recommendations-core";
import { colors, radius, space, text } from "./theme";

// "Getting your harvest out" (#29, docs/11-user-flow.md S3). Before the farmer adds a place:
// an invite that opens S6 (#30). After: the travel time from this lot to each place with how
// it was found, which of the lot's crops suit that trip, and the trips per harvest.

type Props = {
  lot: Lot;
  destinations: readonly Destination[];
  analysis: Pick<LotAnalysis, "access" | "harvest">;
  cropName: (id: string) => string;
  period: string;
};

/** Badge colors: tint + dark text, the same pairs as "Your crops here". The word is the cue. */
const BADGE: Record<TripLevel, { bg: string; fg: string; border: string }> = {
  good: { bg: colors.greenTint, fg: colors.green, border: colors.greenTint },
  watch: { bg: colors.amberTint, fg: colors.amber, border: colors.amberTint },
  far: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  unknown: { bg: colors.disabledBg, fg: colors.muted, border: colors.disabledBg },
};

export function HarvestCard({ lot, destinations, analysis, cropName, period }: Props) {
  if (destinations.length === 0) {
    return (
      <InfoCard title="Getting your harvest out" explainer="harvest-out" period={period}>
        <Text style={text.body}>
          Where do you sell or store your harvest? Add a place to see the travel time from {nbsp(lot.name)} and which of
          your crops suit the trip.
        </Text>
        <Text style={text.caption}>Until then, travel to market is left out of the scores.</Text>
        <Button label="Add a place" icon="plus" variant="secondary" href="/places" />
      </InfoCard>
    );
  }

  const places = placeRows(destinations, lot.travel);
  const placeName = (id: string) => destinations.find((d) => d.id === id)?.name ?? "the place";
  const toCheck = places.some((p) => p.check);
  const crops = lot.crops
    .map((c) => analysis.access.by_crop[c.crop_id])
    .filter((a) => a !== undefined)
    // A crop picked twice (two lot entries) shows once.
    .filter((a, i, all) => all.findIndex((b) => b.crop_id === a.crop_id) === i);

  return (
    <InfoCard
      title="Getting your harvest out"
      explainer="harvest-out"
      period={period}
      subtitle={`From ${nbsp(lot.name)} to the places you sell or store your harvest.`}
    >
      <View style={styles.list}>
        {places.map((p, i) => (
          <View key={p.id} style={[styles.item, i > 0 && styles.divider]}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{p.name}</Text>
                <Text style={text.caption}>{p.kind}</Text>
              </View>
              <View style={styles.time}>
                <Text style={[text.bodyStrong, styles.right]}>{p.time ?? "No time yet"}</Text>
                <Text style={[text.caption, styles.right]}>{p.source ?? "being worked out"}</Text>
              </View>
            </View>
            {p.check ? <Text style={[text.small, styles.check]}>Rough estimate: please check it.</Text> : null}
          </View>
        ))}
      </View>

      {crops.length > 0 ? (
        <View style={[styles.list, styles.section]}>
          <Text style={text.heading} accessibilityRole="header">
            Your crops and the trip
          </Text>
          {crops.map((a, i) => {
            const trip = cropTrip(a, placeName);
            const leg = analysis.harvest.find((l) => l.crop_id === a.crop_id && l.destination_id === a.destination_id);
            const trips = tripsLine(leg, a.minutes);
            const b = BADGE[trip.level];
            return (
              <View key={a.crop_id} style={[styles.item, i > 0 && styles.divider]}>
                <View style={styles.row}>
                  <Text style={[text.bodyStrong, styles.flex]}>{shortCropName(cropName(a.crop_id))}</Text>
                  <View style={[styles.badge, { backgroundColor: b.bg, borderColor: b.border }]}>
                    <Text style={[styles.badgeText, { color: b.fg }]}>{TRIP_LABELS[trip.level]}</Text>
                  </View>
                </View>
                <Text style={text.small}>{trip.line}</Text>
                {trips ? <Text style={text.caption}>{trips}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <Button
        label={toCheck ? "Check travel times" : "Places and travel times"}
        iconAfter="chevron"
        variant="secondary"
        href="/places"
      />
    </InfoCard>
  );
}

/** "Lot 1" stays on one line. */
const nbsp = (s: string) => s.replace(/ /g, "\u00a0");

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { gap: space.xs },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  section: { borderTopWidth: 1.5, borderTopColor: colors.borderStrong, paddingTop: space.lg, marginTop: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  time: { alignItems: "flex-end", flexShrink: 0, maxWidth: "50%" },
  right: { textAlign: "right" },
  check: { color: colors.amber, fontWeight: "600" },
  badge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: 3 },
  badgeText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
});
