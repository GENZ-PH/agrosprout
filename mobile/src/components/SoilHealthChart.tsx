import { useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit/v2";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";

import type { OptionKey, RotationOption, SoilHealthResult } from "../engine";
import { CHART_FONT, chartTheme } from "./chartTheme";
import { Icon } from "./Icon";
import {
  chartSummary,
  monthCells,
  movesText,
  optionNames,
  shiAxis,
  signed,
  soilHealthRows,
  soilHealthSummary,
  stepLabel,
} from "./soil-health-chart-core";
import { colors, MIN_TOUCH, optionColors, radius, space, text } from "./theme";

// Soil health card (#43, docs/07 §4, redesign #164): a summary row, one line per rotation
// option from the start to the end of Year 3, a compact comparison list, and a collapsible
// "How is this calculated?" with what moves each line and each option's months (bare months
// in the rain pull the line down). The index is a relative indicator from this model, never a
// % or a nutrient claim. Every number comes from `soilHealth()`; nothing is sample data.
//
// The lines are a Chart Kit LineChart (react-native-chart-kit/v2, MIT core, #114, D30); tap a
// year to see every option's value there. Chart Kit has no month-strip chart, so the calendar
// strips stay plain react-native-svg.

type Props = {
  /** `soilHealth(options)` from the engine. */
  result: SoilHealthResult;
  /** The same options, for their crops and bare months. */
  options: readonly Pick<RotationOption, "key" | "slots" | "metrics">[];
  /** Crop name for an id, e.g. from crops.json. Defaults to the id. */
  cropName?: (id: string) => string;
  /** Open the dashboard's shared ⓘ sheet instead of the card's own "How is this calculated?". */
  onInfoPress?: () => void;
};

/** Each option has its own line style as well as its color, so color is never the only cue. Your crops (A) is the thickest. */
const LINE: Record<OptionKey, { color: string; width: number; dash?: readonly number[] }> = {
  A: { color: optionColors.A, width: 3.5 },
  B: { color: optionColors.B, width: 2.5, dash: [7, 5] },
  C: { color: optionColors.C, width: 2.5 },
  D: { color: optionColors.D, width: 2.5, dash: [2, 4] },
};

/** The legend sits inside the chart's height: on a phone it wraps to more lines, so the plot gets more room. */
const plotHeight = (width: number) => (width < 500 ? 280 : 240);
/** Calendar strip (one year, repeated by the model): option letter column, month initials, one row per option. */
const STRIP_LEFT = 24;
const STRIP_RIGHT = 4;
const STRIP_LABEL_H = 18;
const STRIP_ROW = 14;
const STRIP_GAP = 6;
const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

type Point = { x: string } & Partial<Record<OptionKey, number>>;

export function SoilHealthChart({ result, options, cropName, onInfoPress }: Props) {
  const [width, setWidth] = useState(0);
  const [howOpen, setHowOpen] = useState(false);
  const rows = useMemo(() => soilHealthRows(result, options, cropName), [result, options, cropName]);
  const axis = useMemo(() => shiAxis(rows), [rows]);
  const summary = useMemo(() => soilHealthSummary(result, rows), [result, rows]);
  const cells = useMemo(() => new Map(options.map((o) => [o.key, monthCells(o)] as const)), [options]);
  const top = new Set(summary.best_keys);
  // "Highest" only means something when the options differ.
  const showTop = summary.best !== null && summary.best_keys.length < rows.filter((r) => r.end !== null).length;

  const lined = rows.filter((r) => r.line);
  // One data row per step: "Start", then the value at the end of Year N.
  const data = useMemo<Point[]>(
    () =>
      Array.from({ length: axis.years + 1 }, (_, y) => {
        const p: Point = { x: stepLabel(y) };
        for (const r of lined) p[r.key] = (r.line as number[])[y];
        return p;
      }),
    [axis.years, lined],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const onInfo = onInfoPress ?? (() => setHowOpen(true));

  // The strip sits inside the "How" box, whose padding is space.md on each side.
  const howW = Math.max(1, width - 2 * space.md);
  const cellW = Math.max(1, howW - STRIP_LEFT - STRIP_RIGHT) / 12;
  const stripH = STRIP_LABEL_H + rows.length * (STRIP_ROW + STRIP_GAP);

  return (
    <View style={styles.card}>
      {/* A. Header */}
      <View style={styles.head}>
        <Text style={[text.heading, styles.flex]} accessibilityRole="header">
          Relative soil health indicator
        </Text>
        <Pressable
          onPress={onInfo}
          accessibilityRole="button"
          accessibilityLabel="About this indicator: how it is calculated, and why it is not a soil test"
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <Icon name="info" size={22} color={colors.green} />
        </Pressable>
      </View>
      <Text style={text.caption}>
        Model-based projection for comparing the cropping options on this lot. Not a lab soil test.
      </Text>

      {/* B. Summary row */}
      {summary.best !== null ? (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Start</Text>
            <Text style={styles.statValue}>{summary.start}</Text>
            <Text style={styles.statNote}>every option</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Highest</Text>
            <Text style={styles.statValue}>{summary.best}</Text>
            <Text style={styles.statNote}>
              Year {result.years}: {optionNames(summary.best_keys)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Change</Text>
            <Text style={styles.statValue}>{signed(summary.change as number)}</Text>
            <Text style={styles.statNote}>from the start</Text>
          </View>
        </View>
      ) : null}

      {/* C. Line chart */}
      <View onLayout={onLayout} style={{ minHeight: plotHeight(width) }}>
        {width > 0 && lined.length ? (
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
              dot: { radius: r.key === "A" ? 4.5 : 4, fill: "background", stroke: "series" },
            }))}
            yDomain={[axis.min, axis.max]}
            formatYLabel={(v) => String(Math.round(v))}
            referenceLines={[{ y: axis.start, color: colors.dashed, strokeDasharray: [4, 4], strokeWidth: 1 }]}
            showVerticalGridLines={false}
            legend={{ position: "bottom", wrap: true, marker: "line" }}
            interaction={{ mode: "tap", selectionPersistence: "persist" }}
            tooltip={{ shared: true, placement: "auto" }}
            crosshair
            theme={chartTheme}
            width={width}
            height={plotHeight(width)}
            accessibilityLabel={chartSummary(result, rows)}
          />
        ) : null}
      </View>
      <Text style={text.caption}>
        {`The index runs from 0 to 100; this view shows ${axis.min} to ${axis.max}, and the dashed line is the start (${result.start}). `}
        It assumes this lot&apos;s 12-month plan repeats every year. Tap a year to see exact values.
      </Text>

      {/* D. Option comparison */}
      <View style={styles.list}>
        {rows.map((r, i) => {
          const isTop = showTop && top.has(r.key);
          return (
            <View
              key={r.key}
              style={[styles.option, i > 0 && styles.optionDivider, r.key === "A" && styles.optionYours]}
              accessibilityLabel={
                r.end === null
                  ? `${r.title}: ${r.summary}`
                  : `${r.title}${isTop ? ", highest" : ""}: ${r.crops}. Year ${result.years}: ${r.end}, ` +
                    `${signed(r.end - result.start)} from the start${r.vs_text ? `, ${r.vs_text.toLowerCase()}` : ""}.`
              }
            >
              <View style={[styles.key, { borderColor: LINE[r.key].color }]}>
                <Text style={[styles.keyText, { color: LINE[r.key].color }]}>{r.key}</Text>
              </View>
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <Text style={text.bodyStrong}>{r.title}</Text>
                  {r.key === "A" ? <Text style={[styles.chip, styles.chipYours]}>Current</Text> : null}
                  {isTop ? <Text style={[styles.chip, styles.chipTop]}>Highest</Text> : null}
                </View>
                <Text style={[text.small, { color: colors.muted }]}>{r.crops}</Text>
                {r.end === null ? (
                  <Text style={text.small}>{r.summary}</Text>
                ) : r.vs_text && r.key !== "A" ? (
                  <Text style={text.caption}>{r.vs_text}</Text>
                ) : null}
              </View>
              {r.end !== null ? (
                <View style={styles.score}>
                  <Text style={styles.scoreValue}>{r.end}</Text>
                  <Text style={styles.scoreChange}>{signed(r.end - result.start)}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* E. How is this calculated? */}
      <Pressable
        onPress={() => setHowOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: howOpen }}
        style={({ pressed }) => [styles.howHead, pressed && styles.pressed]}
      >
        <Text style={[text.bodyStrong, styles.flex, { color: colors.green }]}>How is this calculated?</Text>
        <View style={howOpen ? styles.chevronOpen : undefined}>
          <Icon name="chevron" size={20} color={colors.green} />
        </View>
      </Pressable>

      {howOpen ? (
        <View style={styles.howBox}>
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

          <Text style={text.bodyStrong}>Months with a crop and bare months</Text>
          <Text style={text.caption}>The same months every year. Bare months in the rainy season lower the line.</Text>
          {width > 0 ? (
            <Svg width={howW} height={stripH} fontFamily={CHART_FONT} aria-hidden>
              {MONTH_INITIALS.map((m, i) => (
                <SvgText
                  key={i}
                  x={STRIP_LEFT + (i + 0.5) * cellW}
                  y={STRIP_LABEL_H - 6}
                  fontSize={12}
                  fill={colors.muted}
                  textAnchor="middle"
                >
                  {m}
                </SvgText>
              ))}
              {rows.map((r, row) => {
                const y = STRIP_LABEL_H + row * (STRIP_ROW + STRIP_GAP);
                return (
                  <G key={r.key}>
                    <SvgText x={STRIP_LEFT - 8} y={y + STRIP_ROW - 2} fontSize={12} fontWeight="700" fill={LINE[r.key].color} textAnchor="end">
                      {r.key}
                    </SvgText>
                    {(cells.get(r.key) ?? []).map((c) => (
                      <Rect
                        key={c.month}
                        x={STRIP_LEFT + (c.month - 1) * cellW + 1}
                        y={y}
                        width={Math.max(1, cellW - 2)}
                        height={STRIP_ROW}
                        rx={2}
                        fill={c.kind === "bare" ? colors.amberTint : LINE[r.key].color}
                        stroke={c.kind === "bare" ? colors.amber : "none"}
                        strokeWidth={c.kind === "bare" ? 0.75 : 0}
                      />
                    ))}
                  </G>
                );
              })}
            </Svg>
          ) : null}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: colors.ink }]} />
              <Text style={text.caption}>Crop in the field (option color)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, styles.bareSwatch]} />
              <Text style={text.caption}>Bare soil</Text>
            </View>
          </View>
          <Text style={text.caption}>
            This supports, and does not replace, your own judgment and your agricultural technician.
          </Text>
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
  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: space.xs,
  },
  stat: { flex: 1, paddingVertical: space.sm, paddingHorizontal: space.sm, gap: 2 },
  statLabel: { fontSize: 12, lineHeight: 16, color: colors.muted, fontWeight: "600" },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: colors.ink },
  statNote: { fontSize: 12, lineHeight: 16, color: colors.muted },
  list: { marginTop: space.xs },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: radius.sm,
  },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  optionYours: { backgroundColor: colors.bg },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.sm, rowGap: 2 },
  chip: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  chipYours: { color: colors.ink, borderWidth: 1, borderColor: colors.borderStrong },
  chipTop: { color: colors.green, backgroundColor: colors.greenTint },
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
  score: { alignItems: "flex-end", minWidth: 44 },
  scoreValue: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  scoreChange: { fontSize: 13, lineHeight: 18, color: colors.muted, fontWeight: "600" },
  howHead: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: radius.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  chevronOpen: { transform: [{ rotate: "90deg" }] },
  howBox: {
    backgroundColor: colors.greenTint,
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 12, borderRadius: 2 },
  bareSwatch: { backgroundColor: colors.amberTint, borderWidth: 1, borderColor: colors.amber },
});
