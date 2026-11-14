import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MapInset, MapToApp } from "../map/bridge";
import { MapView } from "../map/MapView";
import type { Lot } from "../types";
import { FARM_MAP_LEGEND, farmMapLots, farmMapPeriod, farmMapSummary, type MapLotView } from "./farm-map-core";
import { InfoCard } from "./InfoCard";
import { colors, radius, space, text } from "./theme";

// "Your lots on the map" (#124): the dashboard's overview of the whole farm. Every lot is filled
// with its crop-fit color (farm-map-core.ts) and labeled with its name, area and result in words.
// Read-only: the map moves and zooms, and a tap on a lot selects it like the lot tabs do. Drawing
// and moving points stay on S1 (/lots).

type Props = {
  lots: readonly Lot[];
  /** Each lot's dashboard state by id (`useFarmLotViews`). */
  views: Readonly<Record<string, MapLotView>>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Laptop-size window (#114): a taller map with room kept for the zoom buttons. */
  wide: boolean;
};

/** Map height in dp. A layout choice, not data: phones keep it short so the page scrolls past it. */
const MAP_HEIGHT = { phone: 280, wide: 420 } as const;

/**
 * Keeps the fitted lots clear of the tile credits (bottom) and, on a wide map, the zoom buttons
 * (right). A phone map is too narrow to give up that width; the farmer pinches to zoom there. Pixels.
 */
const MAP_INSET: Record<"phone" | "wide", MapInset> = {
  phone: { top: 0, right: 0, bottom: 24, left: 0 },
  wide: { top: 0, right: 64, bottom: 24, left: 0 },
};

export function FarmMapCard({ lots, views, selectedId, onSelect, wide }: Props) {
  const height = wide ? MAP_HEIGHT.wide : MAP_HEIGHT.phone;
  // `views` is memoized by useFarmLotViews, so the map page gets new lots only when something changed.
  const mapLots = useMemo(() => farmMapLots(lots, views), [lots, views]);
  const onMessage = useCallback(
    (msg: MapToApp) => {
      if (msg.type === "lotTapped") onSelect(msg.id);
    },
    [onSelect],
  );
  const period = farmMapPeriod(views) ?? "the years of your lots' NASA data, once it has downloaded";

  return (
    <InfoCard
      title="Your lots on the map"
      explainer="farm-map"
      period={period}
      subtitle="Each lot colored by how well it suits its crops. Tap a lot to see its results."
    >
      <View style={[styles.map, { height }]}>
        <MapView
          lots={mapLots}
          mode="view"
          inPage
          activeLotId={selectedId}
          inset={wide ? MAP_INSET.wide : MAP_INSET.phone}
          onMessage={onMessage}
          accessibilityLabel={farmMapSummary(lots, views)}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.legend} accessibilityRole="list" accessibilityLabel="Map colors">
        {FARM_MAP_LEGEND.map((row) => (
          <View key={row.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: row.color }]} />
            <Text style={text.small}>{row.label}</Text>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.mapBg },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  // A dark edge so the light gray swatch still shows on the white card.
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.ink },
});
