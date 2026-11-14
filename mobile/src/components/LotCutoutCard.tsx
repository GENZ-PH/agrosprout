import { useMemo, useState } from "react";
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import type { LotAnalysis } from "../engine/analyze";
import type { CropLibrary, Lot } from "../types";
import { InfoCard } from "./InfoCard";
import {
  CUTOUT_LAYERS,
  cutoutLegend,
  cutoutModel,
  cutoutShade,
  cutoutShape,
  cutoutSummary,
  type CutoutLayer,
  type CutoutPanel,
} from "./lot-cutout-core";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// Lot cutout card (#134): the selected lot's own outline, with no map under it, drawn twice:
// "Now" (your crops) and the best other option. Each panel is filled by one data layer and
// labeled with its value, like a two-panel choropleth. One solid color per panel: nothing we
// have varies inside a lot. The values come from lot-cutout-core.ts.

type Props = {
  lot: Pick<Lot, "name" | "geometry" | "details">;
  analysis: Pick<LotAnalysis, "rotations" | "soil_health" | "crop_fits" | "monthly">;
  library: Pick<CropLibrary, "crops" | "rice_extra_detail">;
  cropName: (id: string) => string;
  /** The years of the lot's data, e.g. "2001-2025", for the ⓘ text. */
  period: string;
};

/** SVG text is a serif font on web unless told otherwise; match the app's system font. */
const FONT = Platform.OS === "web" ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" : undefined;
/** Panel drawing height and padding in dp. Layout choices, not data. */
const PANEL_HEIGHT = 170;
const PANEL_PAD = 16;
/** Below this card width the two panels stack instead of sitting side by side. */
const SIDE_BY_SIDE_MIN = 420;

export function LotCutoutCard({ lot, analysis, library, cropName, period }: Props) {
  const [layer, setLayer] = useState<CutoutLayer>("soil");
  const [width, setWidth] = useState(0);
  const model = useMemo(
    () => cutoutModel(layer, analysis, { lot, library }, cropName),
    [layer, analysis, lot, library, cropName],
  );
  const legend = cutoutLegend(layer);
  const shade = cutoutShade(layer);
  const sideBySide = width >= SIDE_BY_SIDE_MIN;
  const panelW = sideBySide ? Math.floor((width - space.md) / 2) : width;
  const shape = useMemo(
    () => (panelW > 0 ? cutoutShape(lot.geometry.coordinates[0] ?? [], panelW, PANEL_HEIGHT, PANEL_PAD) : null),
    [lot.geometry, panelW],
  );
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <InfoCard
      title={`${lot.name}: now vs best option`}
      explainer="lot-cutout"
      period={period}
      subtitle="Your lot's shape, colored by one kind of data. Left: your crops now. Right: the best other option."
    >
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Color the lot by">
        {CUTOUT_LAYERS.map((l) => {
          const on = l.key === layer;
          return (
            <Pressable
              key={l.key}
              onPress={() => setLayer(l.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.chipPressed]}
            >
              <Text style={[text.small, on && styles.chipTextOn]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        onLayout={onLayout}
        style={[styles.panels, sideBySide && styles.panelsRow]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={cutoutSummary(lot.name, layer, model)}
      >
        {width > 0
          ? model.panels.map((p, i) => (
              <Panel key={p.key} panel={p} width={panelW} shape={shape} north={i === model.panels.length - 1} />
            ))
          : null}
      </View>

      {model.panels.length < 2 ? (
        <Text style={text.caption}>No other option has a score for this lot yet, so only your crops are shown.</Text>
      ) : model.same ? (
        <Text style={text.caption}>
          Both are the same for this kind of data: the option keeps a crop in the field in the same months.
        </Text>
      ) : null}

      {shade ? (
        <View style={styles.shade} accessibilityLabel={`Lighter means ${shade.lowLabel}, darker means ${shade.highLabel}`}>
          <Text style={text.small}>{shade.lowLabel}</Text>
          <Svg width={120} height={14} style={styles.shadeBar}>
            <Defs>
              <LinearGradient id="cutout-shade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={shade.low} />
                <Stop offset="1" stopColor={shade.high} />
              </LinearGradient>
            </Defs>
            <Rect x={0.5} y={0.5} width={119} height={13} rx={3} fill="url(#cutout-shade)" stroke={colors.ink} strokeWidth={1} />
          </Svg>
          <Text style={text.small}>{shade.highLabel}</Text>
        </View>
      ) : null}
      <View style={styles.legend} accessibilityRole="list" accessibilityLabel="Colors">
        {legend.map((row) => (
          <View key={row.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: row.color }]} />
            <Text style={text.small}>{row.label}</Text>
          </View>
        ))}
      </View>
      {layer === "soil" ? (
        <Text style={text.caption}>A relative indicator from this model, not a soil test. Compare the two with each other.</Text>
      ) : null}
    </InfoCard>
  );
}

function Panel({
  panel,
  width,
  shape,
  north,
}: {
  panel: CutoutPanel;
  width: number;
  shape: ReturnType<typeof cutoutShape>;
  north: boolean;
}) {
  const v = panel.value;
  // Pill behind the value so it reads on any fill.
  const pillW = Math.max(44, v.value.length * 9 + 18);
  return (
    <View style={[styles.panel, { width }]}>
      <Text style={text.bodyStrong}>{panel.title}</Text>
      <Text style={text.caption}>{panel.crops}</Text>
      <View style={styles.canvas}>
      <Svg width={width} height={PANEL_HEIGHT} fontFamily={FONT}>
        {shape ? (
          <>
            <Path d={shape.path} fill={v.color} stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" />
            <Rect
              x={shape.labelX - pillW / 2}
              y={shape.labelY - 13}
              width={pillW}
              height={26}
              rx={13}
              fill={colors.surface}
              stroke={colors.ink}
              strokeWidth={1}
            />
            <SvgText x={shape.labelX} y={shape.labelY + 5} fontSize={15} fontWeight="700" fill={colors.ink} textAnchor="middle">
              {v.value}
            </SvgText>
          </>
        ) : (
          <SvgText x={width / 2} y={PANEL_HEIGHT / 2} fontSize={13} fill={colors.muted} textAnchor="middle">
            Lot outline not available
          </SvgText>
        )}
        {north ? (
          <>
            <Path d={`M${width - 14} 8 L${width - 20} 22 L${width - 14} 18 L${width - 8} 22 Z`} fill={colors.ink} />
            <SvgText x={width - 14} y={36} fontSize={12} fontWeight="700" fill={colors.ink} textAnchor="middle">
              N
            </SvgText>
          </>
        ) : null}
      </Svg>
      </View>
      <Text style={text.small}>{v.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipPressed: { backgroundColor: colors.pressed },
  chipTextOn: { color: colors.white, fontWeight: "600" },
  panels: { gap: space.lg },
  panelsRow: { flexDirection: "row", gap: space.md },
  panel: { gap: 2 },
  canvas: { backgroundColor: colors.bg, borderRadius: radius.sm, overflow: "hidden", marginVertical: space.xs },
  shade: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  shadeBar: { marginHorizontal: space.xs },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.ink },
});
