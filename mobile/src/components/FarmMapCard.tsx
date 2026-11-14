import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MapInset, MapToApp } from "../map/bridge";
import { MapView } from "../map/MapView";
import type { MapViewHandle } from "../map/useMapBridge";
import type { Lot } from "../types";
import { FARM_MAP_LEGEND, farmMapLots, farmMapPeriod, farmMapSummary, type MapLayer, type MapLotView, ramp } from "./farm-map-core";
import { InfoCard } from "./InfoCard";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

const LAYERS: { key: MapLayer; label: string; subtitle: string; low: string; high: string }[] = [
  { key: "fit", label: "Crop fit", subtitle: "Each lot colored by how well it suits its crops. Tap a lot to see its results.", low: "", high: "" },
  { key: "water", label: "Water stress", subtitle: "Each lot colored by how many months its current crops are short of water (NASA POWER rain vs crop water need).", low: "0 months", high: "12 months" },
  { key: "washout", label: "Washout risk", subtitle: "Each lot colored by how well its current crops protect the soil from heavy rain (score E, with NASA SRTM slope where known).", low: "Well protected", high: "Poorly protected" },
];

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
  const [layer, setLayer] = useState<MapLayer>("fit");
  const current = LAYERS.find((l) => l.key === layer) ?? LAYERS[0];
  // `views` is memoized by useFarmLotViews, so the map page gets new lots only when something changed.
  const mapLots = useMemo(() => farmMapLots(lots, views, layer), [lots, views, layer]);
  // Zoom to the lots once the map page is ready and whenever the set of lots changes (the
  // page's own fit on init can run before the lots arrive, leaving the default view).
  const mapRef = useRef<MapViewHandle>(null);
  const lotKey = lots.map((l) => `${l.id}:${l.centroid.join(",")}`).join(";");
  const fit = useCallback(() => setTimeout(() => mapRef.current?.send({ type: "fitLots" }), 60), []);
  useEffect(() => {
    const t = fit();
    return () => clearTimeout(t);
  }, [lotKey, fit]);
  const onMessage = useCallback(
    (msg: MapToApp) => {
      if (msg.type === "ready") fit();
      if (msg.type === "lotTapped") onSelect(msg.id);
    },
    [onSelect, fit],
  );
  const period = farmMapPeriod(views) ?? "the years of your lots' NASA data, once it has downloaded";

  return (
    <InfoCard
      title="Your lots on the map"
      explainer="farm-map"
      period={period}
      subtitle={current.subtitle}
    >
      <View style={styles.layers} accessibilityRole="tablist">
        {LAYERS.map((l) => {
          const on = l.key === layer;
          return (
            <Pressable
              key={l.key}
              onPress={() => setLayer(l.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.layer, on && styles.layerOn]}
            >
              <Text style={[text.small, on && styles.layerOnText]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.map, { height }]}>
        <MapView
          ref={mapRef}
          lots={mapLots}
          mode="view"
          activeLotId={selectedId}
          inset={wide ? MAP_INSET.wide : MAP_INSET.phone}
          onMessage={onMessage}
          accessibilityLabel={farmMapSummary(lots, views, layer)}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {layer === "fit" ? (
        <View style={styles.legend} accessibilityRole="list" accessibilityLabel="Map colors">
          {FARM_MAP_LEGEND.map((row) => (
            <View key={row.label} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: row.color }]} />
              <Text style={text.small}>{row.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.legendRow} accessibilityLabel={`Map colors from ${current.low} (green) to ${current.high} (red)`}>
          <Text style={text.small}>{current.low}</Text>
          <View style={styles.rampBar}>
            {Array.from({ length: 12 }, (_, i) => (
              <View key={i} style={[styles.rampStep, { backgroundColor: ramp(i / 11) }]} />
            ))}
          </View>
          <Text style={text.small}>{current.high}</Text>
        </View>
      )}
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.mapBg },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  // A dark edge so the light gray swatch still shows on the white card.
  layers: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  layer: { minHeight: MIN_TOUCH, paddingHorizontal: space.md, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  layerOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  layerOnText: { color: colors.white, fontWeight: "700" },
  rampBar: { flexDirection: "row", height: 12, width: 120, borderRadius: 6, overflow: "hidden" },
  rampStep: { flex: 1 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.ink },
});
