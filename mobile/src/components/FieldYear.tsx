import { type ReactNode, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import type { OptionKey, RotationOption } from "../engine/rotations";
import { useT } from "../i18n/lang-store";
import { cropLabel } from "../i18n/strings";
import type { Crop, LotMonthly } from "../types";
import { axisTicks, bandPieces, bareText, dayX, familiesIn, familyStyle, inFieldMonths, monthX, occupiedMonths, PLAN_COLOR, planName } from "./field-year-core";
import { colors, radius, space, text } from "./theme";

// The field year: one January to December axis shared by the climate and by every plan.
// On top, rain in a normal year (bars, with the dry-year to wet-year range) against the water
// the sun and wind take (line): where the line clears the bars the month is dry. Below, one
// row per plan: crop bands colored by plant family, empty field hatched, and a strip that marks
// the months a crop is short of water, too hot or too wet. Reading across is time; reading
// down compares the plans.

import { type InfoRef, useExplainer } from "./InfoToggle";

type Props = {
  info?: InfoRef;
  options: readonly RotationOption[];
  selected: OptionKey;
  onSelect: (key: OptionKey) => void;
  monthly: Pick<LotMonthly, "precip_mm" | "et0_mm">;
  cropById: (id: string) => Crop | undefined;
};

const LANE_H = 28;
const LANE_GAP = 3;
const CLIMATE_H = 120;
const MARK_H = 5;
const MARK_GAP = 3;
// SVG text does not inherit the app font on web, so name the system stack.
const SVG_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SOIL = "#CFC6B4";
const SOIL_LINE = "#9C917B";
const RAIN = "#BFD4EA";

type RiskKind = "stress" | "heat" | "wet";
const RISK_COLOR: Record<RiskKind, string> = { stress: colors.amber, heat: colors.danger, wet: colors.blue };
// Marks only under months with a crop in the field (field-year-core `occupiedMonths`).
const riskMonths = (o: RotationOption, kind: RiskKind) =>
  inFieldMonths(kind === "stress" ? o.metrics.stress_months : kind === "heat" ? o.metrics.heat_months : o.metrics.waterlog_months, occupiedMonths(o.slots));

export function FieldYear({ options, selected, onSelect, monthly, cropById, info }: Props) {
  const { t, lang, months } = useT();
  const ex = useExplainer(info, t("year.title"));
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const precip = monthly.precip_mm;
  const rain = precip.p50.map((v) => v ?? 0);
  const et0 = monthly.et0_mm;
  const ticks = axisTicks(Math.max(...rain, ...precip.p80.map((v) => v ?? 0), ...et0.map((v) => v ?? 0)));
  const top = ticks[ticks.length - 1];
  const yOf = (mm: number) => CLIMATE_H - (mm / top) * CLIMATE_H;
  const monthW = (i: number) => (i === 11 ? width : monthX(i + 2) * width) - monthX(i + 1) * width;
  const midX = (i: number) => monthX(i + 1) * width + monthW(i) / 2;
  const et0Points = et0.map((v, i) => (v === null ? null : { x: midX(i), y: yOf(v) }));
  const et0Path = et0Points.reduce((d, p, i) => (p ? `${d}${i === 0 || !et0Points[i - 1] ? "M" : "L"}${p.x} ${p.y}` : d), "");

  const families = familiesIn(options, (id) => cropById(id)?.family);
  // Only the kinds of risk that some plan has get a lane, so every row lines up.
  const kinds = (["stress", "heat", "wet"] as const).filter((k) => options.some((o) => riskMonths(o, k).length > 0));
  const marksH = kinds.length * (MARK_H + MARK_GAP);

  return (
    <View style={styles.card}>
      {info ? (
        <View style={styles.titleRow}>
          <Text style={[text.heading, styles.titleText]} accessibilityRole="header">
            {t("year.title")}
          </Text>
          {ex.button}
        </View>
      ) : null}
      {ex.box}
      <View onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={CLIMATE_H + 22} accessibilityLabel={`${t("legend.rain")}. ${t("legend.et0")}.`}>
            {ticks.map((v) => (
              <G key={v}>
                <Line x1={0} x2={width} y1={yOf(v)} y2={yOf(v)} stroke={v === 0 ? colors.borderStrong : colors.border} strokeWidth={1} />
                {v > 0 ? (
                  <SvgText x={2} y={yOf(v) + 12} fontSize={11} fontFamily={SVG_FONT} fill={colors.muted}>
                    {v}
                  </SvgText>
                ) : null}
              </G>
            ))}
            {rain.map((mm, i) => {
              const x = monthX(i + 1) * width;
              const w = monthW(i);
              const lo = precip.p20[i] ?? mm;
              const hi = precip.p80[i] ?? mm;
              return (
                <G key={i}>
                  <Rect x={x + w * 0.22} y={yOf(mm)} width={Math.max(1, w * 0.56)} height={CLIMATE_H - yOf(mm)} rx={3} fill={RAIN} />
                  <Line x1={midX(i)} x2={midX(i)} y1={yOf(hi)} y2={yOf(lo)} stroke={colors.blue} strokeWidth={1.5} />
                  <SvgText x={midX(i)} y={CLIMATE_H + 16} fontSize={12} fontFamily={SVG_FONT} fill={colors.muted} textAnchor="middle">
                    {width < 520 ? months[i].charAt(0) : months[i]}
                  </SvgText>
                </G>
              );
            })}
            <Path d={et0Path} stroke={colors.amber} strokeWidth={2} fill="none" />
            {et0Points.map((p, i) => (p ? <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.surface} stroke={colors.amber} strokeWidth={2} /> : null))}
          </Svg>
        ) : null}
      </View>
      <View style={styles.legend}>
        <Key swatch={<View style={[styles.swatch, { backgroundColor: RAIN }]} />} label={t("legend.rain")} />
        <Key swatch={<View style={styles.whisker} />} label={t("legend.range")} />
        <Key swatch={<View style={styles.lineKey} />} label={t("legend.et0")} />
      </View>
      <Text style={text.caption}>{t("year.dry")}</Text>

      <View style={styles.rows}>
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
                <View style={[styles.key, { backgroundColor: PLAN_COLOR[o.key] ?? colors.ink }]}>
                  <Text style={styles.keyText}>{o.key}</Text>
                </View>
                <Text style={styles.planName} numberOfLines={2}>
                  {planName(o.kind, t)}
                </Text>
                {o.top_total ? <Text style={styles.best}>{t("plan.best")}</Text> : null}
              </View>

              {width > 0 ? (
                <Svg width={width} height={h + (marksH > 0 ? marksH + 2 : 0)}>
                  <Rect x={0} y={0} width={width} height={h} rx={5} fill={colors.bg} />
                  {o.metrics.bare_months.map((m) => (
                    <BareSoil key={m} x={monthX(m) * width} w={monthW(m - 1)} h={h} />
                  ))}
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
                  {kinds.map((kind, lane) =>
                    riskMonths(o, kind).map((m) => (
                      <Rect
                        key={`${kind}${m}`}
                        x={monthX(m) * width + 2}
                        y={h + MARK_GAP + lane * (MARK_H + MARK_GAP)}
                        width={Math.max(2, monthW(m - 1) - 4)}
                        height={MARK_H}
                        rx={MARK_H / 2}
                        fill={RISK_COLOR[kind]}
                      />
                    )),
                  )}
                </Svg>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.legend, styles.legendRule]}>
        {families.map((f) => (
          <Key key={f.key} swatch={<View style={[styles.swatch, { backgroundColor: f.fill }]} />} label={t(f.key)} />
        ))}
        <Key
          swatch={
            <Svg width={18} height={12}>
              <BareSoil x={0} w={18} h={12} />
            </Svg>
          }
          label={t("legend.bare")}
        />
        {kinds.includes("stress") ? <Key swatch={<View style={[styles.mark, { backgroundColor: RISK_COLOR.stress }]} />} label={t("legend.stress")} /> : null}
        {kinds.includes("heat") ? <Key swatch={<View style={[styles.mark, { backgroundColor: RISK_COLOR.heat }]} />} label={t("legend.heat")} /> : null}
        {kinds.includes("wet") ? <Key swatch={<View style={[styles.mark, { backgroundColor: RISK_COLOR.wet }]} />} label={t("legend.wet")} /> : null}
      </View>
    </View>
  );
}

function Key({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <View style={styles.legendItem}>
      {swatch}
      <Text style={[text.caption, styles.legendText]}>{label}</Text>
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  titleText: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  rows: { gap: 2, marginTop: space.sm },
  row: { borderRadius: radius.md, paddingVertical: space.sm, gap: 6, borderWidth: 2, borderColor: "transparent", marginHorizontal: -space.sm, paddingHorizontal: space.sm - 2 },
  rowSelected: { borderColor: colors.green, backgroundColor: "#F7FAF6" },
  rowPressed: { backgroundColor: colors.pressed },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  key: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 14, fontWeight: "700", color: colors.white },
  planName: { ...text.bodyStrong, flexShrink: 1 },
  best: { ...text.caption, color: colors.green, fontWeight: "700", backgroundColor: colors.greenTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden", flexShrink: 0 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: 6 },
  legendRule: { paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  legendText: { flexShrink: 1 },
  swatch: { width: 18, height: 12, borderRadius: 3 },
  mark: { width: 16, height: MARK_H, borderRadius: MARK_H / 2 },
  whisker: { width: 2, height: 12, backgroundColor: colors.blue },
  lineKey: { width: 18, height: 2, backgroundColor: colors.amber },
});
