import { useMemo, useState } from "react";
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { CUTOUT_LAYER_ABOUT } from "../content/explainers";
import type { LotAnalysis } from "../engine/analyze";
import type { CropLibrary, Lot } from "../types";
import { InfoCard } from "./InfoCard";
import {
  CUTOUT_LAYERS,
  cutoutComparison,
  cutoutLegend,
  cutoutModel,
  cutoutShade,
  cutoutShape,
  cutoutSummary,
  SOURCE_TAGS,
  type CutoutComparison,
  type CutoutLayer,
  type CutoutPanel,
} from "./lot-cutout-core";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// Lot comparison card (#134, redesigned in #171): the selected lot's own outline, with no map under
// it, drawn twice: your current crops and the best other option. Each shape is filled by one data
// layer and labeled with its value. One solid color per shape: nothing we have varies inside a lot.
// Both shapes use the same colors, and a row under them gives both values and the difference.
// Every value comes from lot-cutout-core.ts.

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
/** Panel drawing heights and padding in dp: shorter when stacked, so the card stays short. Layout choices, not data. */
const PANEL_HEIGHT = 200;
const PANEL_HEIGHT_STACKED = 140;
const PANEL_PAD = 16;
/** Below this card width the two panels stack instead of sitting side by side. */
const SIDE_BY_SIDE_MIN = 420;
/** Below this width the layer switch is 2 x 2 so the labels never scroll sideways. */
const SEGMENTS_ONE_ROW_MIN = 520;

export function LotCutoutCard({ lot, analysis, library, cropName, period }: Props) {
  const [layer, setLayer] = useState<CutoutLayer>("soil");
  const [width, setWidth] = useState(0);
  const model = useMemo(
    () => cutoutModel(layer, analysis, { lot, library }, cropName),
    [layer, analysis, lot, library, cropName],
  );
  const comparison = cutoutComparison(layer, model);
  const legend = cutoutLegend(layer);
  const shade = cutoutShade(layer);
  const layerInfo = CUTOUT_LAYERS.find((l) => l.key === layer)!;
  const sideBySide = width >= SIDE_BY_SIDE_MIN;
  const panelW = sideBySide ? Math.floor((width - space.md) / 2) : width;
  const panelH = sideBySide ? PANEL_HEIGHT : PANEL_HEIGHT_STACKED;
  const shape = useMemo(
    () => (panelW > 0 ? cutoutShape(lot.geometry.coordinates[0] ?? [], panelW, panelH, PANEL_PAD) : null),
    [lot.geometry, panelW, panelH],
  );
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <InfoCard
      title="Lot comparison"
      explainer="lot-cutout"
      period={period}
      subtitle="Compare your current crops with the best other option for this lot."
    >
      <View style={styles.body} onLayout={onLayout}>
        <View style={styles.meta}>
          <Text style={[text.small, styles.lotName]}>{lot.name}</Text>
          <View style={styles.tag}>
            <View style={[styles.tagDot, layerInfo.source === "power" ? styles.tagDotPower : styles.tagDotModel]} />
            <Text style={text.caption}>This view: {SOURCE_TAGS[layerInfo.source]}</Text>
          </View>
        </View>

        <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel="Compare by">
          {CUTOUT_LAYERS.map((l) => {
            const on = l.key === layer;
            return (
              <Pressable
                key={l.key}
                onPress={() => setLayer(l.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, selected: on }}
                style={({ pressed }) => [
                  styles.segment,
                  width > 0 && width < SEGMENTS_ONE_ROW_MIN && styles.segmentHalf,
                  on && styles.segmentOn,
                  pressed && !on && styles.segmentPressed,
                ]}
              >
                <Text style={[text.small, styles.segmentText, on && styles.segmentTextOn]} numberOfLines={2}>
                  {l.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={text.caption}>{CUTOUT_LAYER_ABOUT[layer]}</Text>

        <View
          style={[styles.panels, sideBySide && styles.panelsRow]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={cutoutSummary(lot.name, layer, model)}
        >
          {width > 0
            ? model.panels.map((p) => <Panel key={p.key} panel={p} width={panelW} height={panelH} shape={shape} />)
            : null}
        </View>

        {model.panels.length < 2 ? (
          <Text style={text.caption}>No other option has a score for this lot yet, so only your crops are shown.</Text>
        ) : comparison ? (
          <CompareRow panels={model.panels} comparison={comparison} />
        ) : null}
        {model.same && (layer === "wetness" || layer === "rain") ? (
          <Text style={text.caption}>Both keep a crop in the field in the same months, so this data is the same.</Text>
        ) : null}

        <View style={styles.key}>
          {shade ? (
            <View style={styles.shade} accessibilityLabel={`Lighter means ${shade.lowLabel}, darker means ${shade.highLabel}`}>
              <Text style={text.caption}>{shade.lowLabel}</Text>
              <Svg width={96} height={12}>
                <Defs>
                  <LinearGradient id="cutout-shade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={shade.low} />
                    <Stop offset="1" stopColor={shade.high} />
                  </LinearGradient>
                </Defs>
                <Rect x={0.5} y={0.5} width={95} height={11} rx={3} fill="url(#cutout-shade)" stroke={colors.ink} strokeWidth={1} />
              </Svg>
              <Text style={text.caption}>{shade.highLabel}</Text>
            </View>
          ) : null}
          <View style={styles.legend} accessibilityRole="list" accessibilityLabel="Colors">
            {legend.map((row) => (
              <View key={row.label} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: row.color }, row.missing && styles.swatchMissing]} />
                <Text style={text.caption}>{row.label}</Text>
              </View>
            ))}
          </View>
          <Text style={text.caption}>Same colors on both shapes. One value per lot, so the whole shape has one color.</Text>
        </View>
      </View>
    </InfoCard>
  );
}

function Panel({
  panel,
  width,
  height,
  shape,
}: {
  panel: CutoutPanel;
  width: number;
  height: number;
  shape: ReturnType<typeof cutoutShape>;
}) {
  const v = panel.value;
  // Pill behind the value so it reads on any fill.
  const pillW = Math.max(48, v.value.length * 9.5 + 22);
  return (
    <View style={[styles.panel, { width }]}>
      <Text style={text.bodyStrong}>{panel.title}</Text>
      <Text style={text.caption}>{panel.option}</Text>
      <View style={styles.canvas}>
        <Svg width={width} height={height} fontFamily={FONT}>
          {shape ? (
            <>
              <Path
                d={shape.path}
                fill={v.color}
                stroke={colors.ink}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeDasharray={v.missing ? "6 4" : undefined}
              />
              <Rect
                x={shape.labelX - pillW / 2}
                y={shape.labelY - 14}
                width={pillW}
                height={28}
                rx={14}
                fill={colors.surface}
                stroke={colors.ink}
                strokeWidth={1}
              />
              <SvgText x={shape.labelX} y={shape.labelY + 5.5} fontSize={16} fontWeight="700" fill={colors.ink} textAnchor="middle">
                {v.value}
              </SvgText>
            </>
          ) : (
            <SvgText x={width / 2} y={height / 2} fontSize={13} fill={colors.muted} textAnchor="middle">
              Lot outline not available
            </SvgText>
          )}
          <Path d={`M${width - 14} 8 L${width - 20} 22 L${width - 14} 18 L${width - 8} 22 Z`} fill={colors.ink} />
          <SvgText x={width - 14} y={36} fontSize={12} fontWeight="700" fill={colors.ink} textAnchor="middle">
            N
          </SvgText>
        </Svg>
      </View>
      <Text style={text.small}>{panel.crops}</Text>
      <Text style={text.caption}>{v.detail}</Text>
    </View>
  );
}

/** Both values, the difference between them, and one sentence on which does better (#171). */
function CompareRow({ panels, comparison }: { panels: CutoutPanel[]; comparison: CutoutComparison }) {
  const [cur, oth] = panels;
  const marks = comparison.better === "current" || comparison.better === "other";
  const tone =
    comparison.better === "other"
      ? styles.pillGood
      : comparison.better === "current"
        ? styles.pillLow
        : styles.pillNeutral;
  const toneText =
    comparison.better === "other" ? styles.pillGoodText : comparison.better === "current" ? styles.pillLowText : null;
  return (
    <View style={styles.compare}>
      <View style={styles.compareRow}>
        <Side label="Your crops" value={cur.value.value} best={comparison.better === "current"} marks={marks} />
        <View style={[styles.pill, tone]}>
          <Text style={[text.small, styles.pillText, toneText]}>{comparison.diff ?? "Can't compare"}</Text>
        </View>
        <Side
          label={`Option ${oth.key}`}
          value={oth.value.value}
          best={comparison.better === "other"}
          marks={marks}
          alignEnd
        />
      </View>
      <Text style={text.small}>{comparison.sentence}</Text>
    </View>
  );
}

/** One side of the comparison. `marks`: this layer has a "better", so both sides keep a line for it. */
function Side({
  label,
  value,
  best,
  marks,
  alignEnd,
}: {
  label: string;
  value: string;
  best: boolean;
  marks: boolean;
  alignEnd?: boolean;
}) {
  return (
    <View style={[styles.side, alignEnd && styles.sideEnd]}>
      <Text style={text.caption}>{label}</Text>
      {/* Words (a crop-fit level) get a smaller size than numbers so they fit on one line. */}
      <Text style={[/\d/.test(value) ? text.heading : text.bodyStrong, best && styles.sideBest]}>{value}</Text>
      {marks ? <Text style={[text.caption, styles.sideBest]}>{best ? "Better" : " "}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  lotName: { fontWeight: "600" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagDotModel: { backgroundColor: colors.amber },
  tagDotPower: { backgroundColor: colors.blue },
  segments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.pressed,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentHalf: { flexBasis: "45%" },
  segmentOn: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  segmentPressed: { backgroundColor: colors.border },
  segmentText: { color: colors.muted, textAlign: "center" },
  segmentTextOn: { color: colors.ink, fontWeight: "700" },
  panels: { gap: space.lg },
  panelsRow: { flexDirection: "row", gap: space.md },
  panel: { gap: 2 },
  canvas: { backgroundColor: colors.bg, borderRadius: radius.sm, overflow: "hidden", marginVertical: space.xs },
  compare: {
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  compareRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  side: { flex: 1 },
  sideEnd: { alignItems: "flex-end" },
  sideBest: { color: colors.green },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  pillText: { fontWeight: "700", textAlign: "center" },
  pillGood: { backgroundColor: colors.greenTint },
  pillGoodText: { color: colors.green },
  pillLow: { backgroundColor: colors.amberTint },
  pillLowText: { color: colors.amber },
  pillNeutral: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  key: { gap: space.xs },
  shade: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.ink },
  swatchMissing: { borderStyle: "dashed" },
});
