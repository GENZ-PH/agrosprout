import { useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import type { OptionKey, RotationOption } from "../engine/rotations";
import { useT } from "../i18n/lang-store";
import { cropLabel } from "../i18n/strings";
import type { Crop, PrecipPercentiles } from "../types";
import {
  bandPieces,
  bareText,
  dayX,
  familiesIn,
  familyStyle,
  monthX,
  planName,
} from "./field-year-core";
import { colors, radius, space, text } from "./theme";

// The field year: one Jan-Dec ruler shared by every plan. Typical rain sits behind the
// ruler, each plan is a row of crop bands, bare soil is hatched, and months of dry stress
// carry a mark under the row. Reading across is time; reading down compares the plans.

type Props = {
  options: readonly RotationOption[];
  selected: OptionKey;
  onSelect: (key: OptionKey) => void;
  precip: PrecipPercentiles;
  cropById: (id: string) => Crop | undefined;
};

const LANE_H = 26;
const LANE_GAP = 3;
const RAIN_H = 64;
// Narrower than this (a phone), the score meter gives its room to the plan name.
const METER_MIN = 420;
// SVG text does not inherit the app font on web, so name the system stack.
const SVG_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SOIL = "#CFC6B4";
const SOIL_LINE = "#9C917B";

export function FieldYear({ options, selected, onSelect, precip, cropById }: Props) {
  const { t, lang, months } = useT();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const median = precip.p50.map((v) => v ?? 0);
  const maxRain = Math.max(1, ...precip.p80.map((v) => v ?? 0), ...median);
  const wettest = median.indexOf(Math.max(...median));
  const driest = median.indexOf(Math.min(...median));
  const families = familiesIn(options, (id) => cropById(id)?.family);

  return (
    <View style={styles.card}>
      <View onLayout={onLayout} style={styles.plot}>
        {width > 0 ? (
          <>
            <Text style={styles.axisNote}>
              {t("year.rain", { wet: months[wettest], wetMm: Math.round(median[wettest]), dry: months[driest], dryMm: Math.round(median[driest]) })}
            </Text>
            <Svg width={width} height={RAIN_H + 20} accessibilityLabel={t("legend.range")}>
              {median.map((mm, i) => {
                const x = monthX(i + 1) * width;
                const mw = (i === 11 ? width : monthX(i + 2) * width) - x;
                const h = (mm / maxRain) * RAIN_H;
                const lo = ((precip.p20[i] ?? mm) / maxRain) * RAIN_H;
                const hi = ((precip.p80[i] ?? mm) / maxRain) * RAIN_H;
                return (
                  <G key={i}>
                    <Rect x={x + 2} y={RAIN_H - h} width={Math.max(1, mw - 4)} height={h} rx={3} fill="#BFD4EA" />
                    {/* dry year to wet year */}
                    <Line x1={x + mw / 2} x2={x + mw / 2} y1={RAIN_H - hi} y2={RAIN_H - lo} stroke={colors.blue} strokeWidth={1.5} />
                    <SvgText x={x + mw / 2} y={RAIN_H + 15} fontSize={12} fontFamily={SVG_FONT} fill={colors.muted} textAnchor="middle">
                      {months[i].charAt(0)}
                    </SvgText>
                  </G>
                );
              })}
              <Line x1={0} x2={width} y1={RAIN_H} y2={RAIN_H} stroke={colors.borderStrong} strokeWidth={1} />
            </Svg>
          </>
        ) : null}
      </View>

      {options.map((o) => {
        const { pieces, lanes } = bandPieces(o.slots);
        const h = lanes * LANE_H + (lanes - 1) * LANE_GAP;
        const isSelected = o.key === selected;
        return (
          <Pressable
            key={o.key}
            onPress={() => onSelect(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${t("plan.label", { key: o.key })}, ${planName(o.kind, t)}. ${o.slots.map((s) => cropLabel(lang, cropById(s.crop_id), s.crop_id)).join(", ")}. ${bareText(o.metrics, t, months)}.`}
            style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && !isSelected && styles.rowPressed]}
          >
            <View style={styles.rowHead}>
              <View style={[styles.key, isSelected && styles.keySelected]}>
                <Text style={[styles.keyText, isSelected && styles.keyTextSelected]}>{o.key}</Text>
              </View>
              <Text style={styles.planName} numberOfLines={2}>
                {planName(o.kind, t)}
              </Text>
              {o.top_total ? <Text style={styles.best}>{t("plan.best")}</Text> : null}
              {width >= METER_MIN ? (
                <View style={styles.meter}>
                  <View style={[styles.meterFill, isSelected && styles.meterFillSelected, { width: `${Math.max(0, Math.min(100, o.total ?? 0))}%` }]} />
                </View>
              ) : null}
              <Text style={[styles.score, width < METER_MIN && styles.scoreEnd]}>{o.total === null ? t("year.noScore") : Math.round(o.total)}</Text>
            </View>

            {width > 0 ? (
              <Svg width={width} height={h + 12}>
                <Rect x={0} y={0} width={width} height={h} rx={5} fill={colors.bg} />
                {o.metrics.bare_months.map((m) => {
                  const x = monthX(m) * width;
                  const w = (m === 12 ? width : monthX(m + 1) * width) - x;
                  return <BareSoil key={m} x={x} w={w} h={h} />;
                })}
                {pieces.map((p, i) => {
                  const crop = cropById(p.crop_id);
                  const st = familyStyle(crop?.family);
                  const x = dayX(p.start) * width;
                  const w = Math.max(2, dayX(p.end) * width - x);
                  const y = p.lane * (LANE_H + LANE_GAP);
                  const label = cropLabel(lang, crop, p.crop_id);
                  const fits = p.labeled && w > label.length * 7 + 12;
                  return (
                    <G key={i}>
                      <Rect x={x + 1} y={y} width={Math.max(1, w - 2)} height={LANE_H} rx={5} fill={st.fill} />
                      {fits ? (
                        <SvgText x={x + 8} y={y + LANE_H / 2 + 4.5} fontSize={13} fontWeight="600" fontFamily={SVG_FONT} fill={st.ink}>
                          {label}
                        </SvgText>
                      ) : null}
                    </G>
                  );
                })}
                {o.metrics.stress_months.map((m) => {
                  const x = monthX(m) * width;
                  const w = (m === 12 ? width : monthX(m + 1) * width) - x;
                  return <Rect key={m} x={x + w / 2 - 6} y={h + 5} width={12} height={3} rx={1.5} fill={colors.amber} />;
                })}
              </Svg>
            ) : null}

            <Text style={styles.rowFoot}>
              {bareText(o.metrics, t, months)}
              {o.assumed_calendar ? `. ${t("year.assumed")}` : "."}
            </Text>
          </Pressable>
        );
      })}

      <View style={styles.legend}>
        {families.map((f) => (
          <View key={f.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: f.fill }]} />
            <Text style={text.caption}>{t(f.key)}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <Svg width={18} height={12}>
            <BareSoil x={0} w={18} h={12} />
          </Svg>
          <Text style={text.caption}>{t("legend.bare")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.stressMark} />
          <Text style={text.caption}>{t("legend.stress")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.whisker} />
          <Text style={text.caption}>{t("legend.range")}</Text>
        </View>
      </View>
    </View>
  );
}

/** Hatched earth for a stretch with nothing growing. */
function BareSoil({ x, w, h }: { x: number; w: number; h: number }) {
  const lines: string[] = [];
  for (let d = -h; d < w; d += 7) {
    const x1 = Math.max(0, d);
    const y1 = d < 0 ? -d : 0;
    const x2 = Math.min(w, d + h);
    const y2 = d + h > w ? w - d : h;
    lines.push(`M${x + x1} ${h - y1}L${x + x2} ${h - y2}`);
  }
  return (
    <G>
      <Rect x={x} y={0} width={w} height={h} fill={SOIL} opacity={0.55} />
      <Path d={lines.join("")} stroke={SOIL_LINE} strokeWidth={1} />
    </G>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  plot: { gap: space.sm },
  axisNote: { ...text.caption },
  row: { borderRadius: radius.md, paddingVertical: space.sm, gap: 6, borderWidth: 2, borderColor: "transparent", marginHorizontal: -space.sm, paddingHorizontal: space.sm - 2 },
  rowSelected: { borderColor: colors.green, backgroundColor: "#F7FAF6" },
  rowPressed: { backgroundColor: colors.pressed },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  key: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  keySelected: { backgroundColor: colors.green, borderColor: colors.green },
  keyText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  keyTextSelected: { color: colors.white },
  planName: { ...text.bodyStrong, flexShrink: 1 },
  best: { ...text.caption, color: colors.green, fontWeight: "700", backgroundColor: colors.greenTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden", flexShrink: 0 },
  meter: { marginLeft: "auto", width: 72, height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: "hidden" },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  meterFillSelected: { backgroundColor: colors.green },
  score: { ...text.heading, minWidth: 30, textAlign: "right", fontVariant: ["tabular-nums"] },
  scoreEnd: { marginLeft: "auto" },
  rowFoot: { ...text.caption },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: 6, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 18, height: 12, borderRadius: 3 },
  stressMark: { width: 12, height: 3, borderRadius: 1.5, backgroundColor: colors.amber },
  whisker: { width: 2, height: 12, backgroundColor: colors.blue },
});
