import { useCallback, useMemo, useState } from "react";
import { tr } from "../i18n/lang-store";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MapInset, MapToApp } from "../map/bridge";
import { GIBS_OVERLAYS, OVERLAY_IDS, type OverlayId } from "../map/gibs-layers";
import { MapView } from "../map/MapView";
import type { Lot } from "../types";
import { FARM_MAP_LEGEND, farmMapLots, farmMapPeriod, farmMapSummary, type MapLotView } from "./farm-map-core";
import { InfoCard } from "./InfoCard";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// "Your lots on the map" (#124): the dashboard's overview of the whole farm. Every lot is filled
// with its crop-fit color (farm-map-core.ts) and labeled with its name, area and result in words.
// Read-only: the map moves and zooms, and a tap on a lot selects it like the lot tabs do (the
// dashboard also opens the lot comparison dialog, #171). Drawing
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
  const [overlay, setOverlay] = useState<OverlayId | null>(null);
  const layer = overlay ? GIBS_OVERLAYS[overlay] : null;
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
      title={tr("Your lots on the map")}
      explainer="farm-map"
      period={period}
      subtitle="Each lot colored by how well it suits its crops. Tap a lot to compare its crops with the best other option."
    >
      <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="NASA layer on the map">
        {([null, ...OVERLAY_IDS] as const).map((id) => {
          const selected = id === overlay;
          return (
            <Pressable
              key={id ?? "off"}
              onPress={() => setOverlay(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={id ? `NASA layer: ${GIBS_OVERLAYS[id].tab}` : "No NASA layer"}
              style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && !selected && styles.tabPressed]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]} numberOfLines={2}>
                {id ? GIBS_OVERLAYS[id].tab : "Off"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.map, { height }]}>
        <MapView
          lots={mapLots}
          mode="view"
          inPage
          overlay={overlay}
          activeLotId={selectedId}
          inset={wide ? MAP_INSET.wide : MAP_INSET.phone}
          onMessage={onMessage}
          accessibilityLabel={farmMapSummary(lots, views)}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {layer ? (
        <View style={styles.layerLegend} accessibilityLabel={`${layer.product}, ${layer.dateLabel}, ${layer.units}. ${layer.meaning}`}>
          <Text style={text.bodyStrong}>{`${layer.tab}: ${layer.product}`}</Text>
          <Text style={text.caption}>{`${layer.dateLabel} · ${layer.units} · NASA GIBS`}</Text>
          <View style={styles.scaleRow}>
            <Text style={text.small}>{layer.low}</Text>
            <View style={styles.scale}>
              {layer.stops.map((c) => (
                <View key={c} style={[styles.scaleStep, { backgroundColor: c }]} />
              ))}
            </View>
            <Text style={text.small}>{layer.high}</Text>
          </View>
          <Text style={text.small}>{layer.meaning}</Text>
          <Text style={text.small}>{layer.helps}</Text>
          <Text style={text.caption}>
            Coarse satellite picture: one color can cover your whole lot and its neighbours. Needs internet. It supports,
            and does not replace, your agricultural technician.
          </Text>
        </View>
      ) : null}
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
  // Equal square-cornered tabs, same look as the lot chips: the chosen one solid green.
  tabs: { flexDirection: "row", gap: space.xs },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  tabSelected: { backgroundColor: colors.green, borderColor: colors.green },
  tabPressed: { backgroundColor: colors.pressed },
  tabText: { fontSize: 13, lineHeight: 16, fontWeight: "600", color: colors.ink, textAlign: "center" },
  tabTextSelected: { color: colors.white },
  layerLegend: { gap: 2 },
  scaleRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: space.xs },
  scale: { flex: 1, maxWidth: 240, flexDirection: "row", height: 12, borderRadius: 3, overflow: "hidden" },
  scaleStep: { flex: 1 },
  map: { borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.mapBg },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  // A dark edge so the light gray swatch still shows on the white card.
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.ink },
});
