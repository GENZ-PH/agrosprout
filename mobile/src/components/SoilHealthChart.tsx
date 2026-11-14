import { useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit/v2";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";

import type { OptionKey, RotationOption, SoilHealthResult } from "../engine";
import { CHART_FONT, chartTheme } from "./chartTheme";
import { Icon } from "./Icon";
import { chartSummary, monthCells, movesText, shiAxis, soilHealthRows } from "./soil-health-chart-core";
import { colors, MIN_TOUCH, optionColors, radius, space, text } from "./theme";

// 3-year Soil Health Index card (#43, docs/07 §4): one line per rotation option
// from the start to the end of Year 3, and under it each option's calendar for Year 1-3
// with the bare months marked, because bare months in the rain pull the line down.
// The index is a relative indicator from this model, never a % or a nutrient claim.
//
// The lines are a Chart Kit LineChart (react-native-chart-kit/v2, MIT core, #114, D30); tap a
// year to see every option's value there. Chart Kit has no month-strip chart, so the calendar
// strips under it stay plain react-native-svg.

type Props = {
  /** `soilHealth(options)` from the engine. */
  result: SoilHealthResult;
  /** The same options, for their crops and bare months. */
  options: readonly Pick<RotationOption, "key" | "slots" | "metrics">[];
  /** Crop name for an id, e.g. from crops.json. Defaults to the id. */
  cropName?: (id: string) => string;
  /** Open the dashboard's shared ⓘ sheet instead of the inline text. */
  onInfoPress?: () => void;
};

/** Each option has its own line style as well as its color, so color is never the only cue. */
const LINE: Record<OptionKey, { color: string; width: number; dash?: readonly number[] }> = {
  A: { color: optionColors.A, width: 3 },
  B: { color: optionColors.B, width: 2.5, dash: [7, 5] },
  C: { color: optionColors.C, width: 2.5 },
  D: { color: optionColors.D, width: 2.5, dash: [2, 4] },
};

/** The legend sits inside the chart's height: on a phone it wraps to more lines, so the plot gets more room. */
const plotHeight = (width: number) => (width < 500 ? 290 : 240);
/** Calendar strips: option letter column, year labels, one row per option. */
const STRIP_LEFT = 24;
const STRIP_RIGHT = 4;
const STRIP_LABEL_H = 18;
const STRIP_ROW = 12;
const STRIP_GAP = 6;

type Point = { x: string } & Partial<Record<OptionKey, number>>;

export function SoilHealthChart({ result, options, cropName, onInfoPress }: Props) {
  const [width, setWidth] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const rows = useMemo(() => soilHealthRows(result, options, cropName), [result, options, cropName]);
  const axis = useMemo(() => shiAxis(rows), [rows]);
  const cells = useMemo(() => new Map(options.map((o) => [o.key, monthCells(o)] as const)), [options]);

  const lined = rows.filter((r) => r.line);
  // One data row per year boundary: "Now" is the start, "Year N" the value at the end of year N.
  const data = useMemo<Point[]>(
    () =>
      Array.from({ length: axis.years + 1 }, (_, y) => {
        const p: Point = { x: y === 0 ? "Now" : `Year ${y}` };
        for (const r of lined) p[r.key] = (r.line as number[])[y];
        return p;
      }),
    [axis.years, lined],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const toggleInfo = onInfoPress ?? (() => setInfoOpen((v) => !v));

  const stripW = Math.max(1, width - STRIP_LEFT - STRIP_RIGHT);
  const yearW = stripW / axis.years;
  const cellW = yearW / 12;
  const stripH = STRIP_LABEL_H + rows.length * (STRIP_ROW + STRIP_GAP);

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

      <View onLayout={onLayout} style={{ minHeight: plotHeight(width) + stripH }}>
        {width > 0 ? (
          <>
            <LineChart
              data={data}
              xKey="x"
              series={lined.map((r) => ({
                yKey: r.key,
                label: `${r.key} ${r.title}`,
                color: LINE[r.key].color,
                strokeWidth: LINE[r.key].width,
                strokeDasharray: LINE[r.key].dash,
                curve: "linear" as const,
                dot: { radius: 3.5, fill: "background", stroke: "series" },
              }))}
              yDomain={[axis.min, axis.max]}
              formatYLabel={(v) => String(Math.round(v))}
              referenceLines={[{ y: axis.start, color: colors.dashed, strokeDasharray: [4, 4], strokeWidth: 1 }]}
              showVerticalGridLines={false}
              legend={{ position: "bottom", wrap: true }}
              interaction={{ mode: "tap", selectionPersistence: "persist" }}
              tooltip={{ shared: true, placement: "auto" }}
              crosshair
              theme={chartTheme}
              width={width}
              height={plotHeight(width)}
              accessibilityLabel={chartSummary(result, rows)}
            />

            {/* Each option's calendar, Year 1-3: crop months in the option's color, bare months light. */}
            <Svg width={width} height={stripH} fontFamily={CHART_FONT} aria-hidden>
              {Array.from({ length: axis.years }, (_, y) => (
                <G key={y}>
                  <SvgText
                    x={STRIP_LEFT + (y + 0.5) * yearW}
                    y={STRIP_LABEL_H - 6}
                    fontSize={12}
                    fill={colors.muted}
                    textAnchor="middle"
                  >
                    {`Year ${y + 1}`}
                  </SvgText>
                  {y > 0 ? (
                    <Line
                      x1={STRIP_LEFT + y * yearW}
                      x2={STRIP_LEFT + y * yearW}
                      y1={0}
                      y2={stripH}
                      stroke={colors.border}
                      strokeWidth={1}
                    />
                  ) : null}
                </G>
              ))}
              {rows.map((r, row) => {
                const top = STRIP_LABEL_H + row * (STRIP_ROW + STRIP_GAP);
                const year = cells.get(r.key) ?? [];
                return (
                  <G key={r.key}>
                    <SvgText x={STRIP_LEFT - 8} y={top + STRIP_ROW - 2} fontSize={12} fontWeight="700" fill={LINE[r.key].color} textAnchor="end">
                      {r.key}
                    </SvgText>
                    {Array.from({ length: axis.years }, (_, y) =>
                      year.map((c) => (
                        <Rect
                          key={`${y}-${c.month}`}
                          x={STRIP_LEFT + y * yearW + (c.month - 1) * cellW + 0.5}
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
          </>
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
