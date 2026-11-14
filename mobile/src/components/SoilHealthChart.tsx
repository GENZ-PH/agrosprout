import { useMemo, useState } from "react";
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import type { OptionKey, RotationOption, SoilHealthResult } from "../engine";
import { Icon } from "./Icon";
import { ExplainerBox } from "./InfoCard";
import {
  chartSummary,
  monthCells,
  movesText,
  shiAxis,
  soilHealthRows,
  spreadLabels,
  xForYear,
  yForValue,
  type PlotBox,
} from "./soil-health-chart-core";
import { colors, MIN_TOUCH, optionColors, radius, space, text } from "./theme";

// 3-year Soil Health Index card (#43, docs/07 §4): one line per rotation option
// from the start to the end of Year 3, and under it each option's calendar for Year 1-3
// with the bare months marked, because bare months in the rain pull the line down.
// The index is a relative indicator from this model, never a % or a nutrient claim.

type Props = {
  /** `soilHealth(options)` from the engine. */
  result: SoilHealthResult;
  /** The same options, for their crops and bare months. */
  options: readonly Pick<RotationOption, "key" | "slots" | "metrics">[];
  /** Crop name for an id, e.g. from crops.json. Defaults to the id. */
  cropName?: (id: string) => string;
  /** Open the dashboard's shared ⓘ sheet instead of the inline text. */
  onInfoPress?: () => void;
  /** The years of the lot's data, for the shared explainer. */
  period?: string;
};

/** Each option has its own line style as well as its color, so color is never the only cue. */
const LINE: Record<OptionKey, { color: string; width: number; dash?: string }> = {
  A: { color: optionColors.A, width: 3 },
  B: { color: optionColors.B, width: 2.5, dash: "7 5" },
  C: { color: optionColors.C, width: 2.5 },
  D: { color: optionColors.D, width: 2.5, dash: "2 4" },
};

/** SVG text is a serif font on web unless told otherwise; match the app's system font. */
const FONT = Platform.OS === "web" ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" : undefined;
const PLOT_HEIGHT = 150;
const PAD = { left: 30, right: 58, top: 10 };
const AXIS_LABEL_GAP = 18;
const STRIP_TOP_GAP = 30;
const STRIP_ROW = 12;
const STRIP_GAP = 6;
const LABEL_GAP = 15;

export function SoilHealthChart({ result, options, cropName, onInfoPress, period = "" }: Props) {
  const [width, setWidth] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const rows = useMemo(() => soilHealthRows(result, options, cropName), [result, options, cropName]);
  const axis = useMemo(() => shiAxis(rows), [rows]);
  const cells = useMemo(
    () => new Map(options.map((o) => [o.key, monthCells(o)] as const)),
    [options],
  );

  const box: PlotBox = { left: PAD.left, right: Math.max(PAD.left + 1, width - PAD.right), top: PAD.top, bottom: PAD.top + PLOT_HEIGHT };
  const stripTop = box.bottom + STRIP_TOP_GAP;
  const height = stripTop + rows.length * (STRIP_ROW + STRIP_GAP);
  const ticks = Array.from({ length: axis.years + 1 }, (_, y) => y);
  const lined = rows.filter((r) => r.line);
  const labelYs = spreadLabels(
    lined.map((r) => yForValue((r.line as number[])[axis.years], box, axis)),
    LABEL_GAP,
    box.top + 4,
    box.bottom,
  );
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const toggleInfo = onInfoPress ?? (() => setInfoOpen((v) => !v));
  const cellW = (box.right - box.left) / (axis.years * 12);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={[text.heading, styles.flex]} accessibilityRole="header">
          {result.label.text}
        </Text>
        <Pressable
          onPress={toggleInfo}
          accessibilityRole="button"
          accessibilityLabel="About the soil health chart"
          accessibilityState={onInfoPress ? undefined : { expanded: infoOpen }}
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <Icon name="info" size={22} color={colors.green} />
        </Pressable>
      </View>
      <Text style={text.caption}>Not a soil test. Compare the options on this lot with each other.</Text>

      <View
        onLayout={onLayout}
        style={{ height }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={chartSummary(result, rows)}
      >
        {width > 0 ? (
          <Svg width={width} height={height} fontFamily={FONT}>
            {[axis.min, axis.start, axis.max].map((v) => (
              <G key={v}>
                <Line
                  x1={box.left}
                  x2={box.right}
                  y1={yForValue(v, box, axis)}
                  y2={yForValue(v, box, axis)}
                  stroke={v === axis.start ? colors.dashed : colors.border}
                  strokeWidth={1}
                  strokeDasharray={v === axis.start ? "4 4" : undefined}
                />
                <SvgText x={box.left - 6} y={yForValue(v, box, axis) + 4} fontSize={12} fill={colors.muted} textAnchor="end">
                  {v}
                </SvgText>
              </G>
            ))}
            {ticks.slice(1, -1).map((y) => (
              <Line
                key={y}
                x1={xForYear(y, box)}
                x2={xForYear(y, box)}
                y1={box.top}
                y2={height}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {ticks.slice(1).map((y) => (
              <SvgText
                key={y}
                x={(xForYear(y - 1, box) + xForYear(y, box)) / 2}
                y={box.bottom + AXIS_LABEL_GAP}
                fontSize={12}
                fill={colors.muted}
                textAnchor="middle"
              >
                {`Year ${y}`}
              </SvgText>
            ))}

            {lined.map((r) => {
              const s = LINE[r.key];
              const pts = (r.line as number[]).map((v, y) => [xForYear(y, box), yForValue(v, box, axis)] as const);
              return (
                <G key={r.key}>
                  <Path
                    d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeDasharray={s.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {pts.slice(1).map(([x, y], i) => (
                    <Circle key={i} cx={x} cy={y} r={3.5} fill={colors.surface} stroke={s.color} strokeWidth={2} />
                  ))}
                </G>
              );
            })}
            {lined.map((r, i) => (
              <SvgText
                key={r.key}
                x={box.right + 8}
                y={labelYs[i] + 4}
                fontSize={13}
                fontWeight="700"
                fill={LINE[r.key].color}
              >
                {`${r.key} ${r.end}`}
              </SvgText>
            ))}

            {rows.map((r, row) => {
              const top = stripTop + row * (STRIP_ROW + STRIP_GAP);
              const year = cells.get(r.key) ?? [];
              return (
                <G key={r.key}>
                  <SvgText x={box.left - 8} y={top + STRIP_ROW - 2} fontSize={12} fontWeight="700" fill={LINE[r.key].color} textAnchor="end">
                    {r.key}
                  </SvgText>
                  {ticks.slice(1).flatMap((y) =>
                    year.map((c) => (
                      <Rect
                        key={`${y}-${c.month}`}
                        x={xForYear(y - 1, box) + (c.month - 1) * cellW + 0.5}
                        y={top}
                        width={Math.max(1, cellW - 1)}
                        height={STRIP_ROW}
                        rx={1.5}
                        fill={c.kind === "bare" ? colors.amberTint : LINE[r.key].color}
                        stroke={c.kind === "bare" ? colors.amber : "none"}
                        strokeWidth={c.kind === "bare" ? 0.75 : 0}
                      />
                    )),
                  )}
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.ink }]} />
          <Text style={text.caption}>Crop in the field (line color)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.bareSwatch]} />
          <Text style={text.caption}>Bare soil (same months every year)</Text>
        </View>
      </View>

      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.key} style={styles.row}>
            <View style={[styles.key, { borderColor: LINE[r.key].color }]}>
              <Text style={[styles.keyText, { color: LINE[r.key].color }]}>{r.key}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>
                {r.title} <Text style={[text.small, { color: colors.muted }]}>· {r.crops}</Text>
              </Text>
              <Text style={text.small}>
                {r.summary}
                {r.vs_text ? ` · ${r.vs_text}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {!onInfoPress && infoOpen ? (
        <View style={styles.infoBox}>
          <ExplainerBox id="soil-health" period={period} />
          {result.info.map((l) => (
            <Text key={l.code} style={text.small}>
              {l.text}
            </Text>
          ))}
          <Text style={text.bodyStrong}>What moves each line every year</Text>
          {rows.map((r) => {
            const m = movesText(r);
            return m ? (
              <Text key={r.key} style={text.small}>
                {r.key} {r.title}: {m}
              </Text>
            ) : null;
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  info: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    marginRight: -space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  pressed: { backgroundColor: colors.pressed },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 12, borderRadius: 2 },
  bareSwatch: { backgroundColor: colors.amberTint, borderWidth: 1, borderColor: colors.amber },
  rows: { gap: space.sm, marginTop: space.xs },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  key: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  keyText: { fontSize: 14, fontWeight: "700" },
  infoBox: {
    backgroundColor: colors.greenTint,
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
});
