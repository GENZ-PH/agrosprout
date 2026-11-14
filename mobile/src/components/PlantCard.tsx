import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";

import type { RotationOption } from "../engine/rotations";
import { useT } from "../i18n/lang-store";
import { cropLabel, type T } from "../i18n/strings";
import type { Crop } from "../types";
import { bandPieces, dayX, familyStyle, monthX, PLAN_COLOR, planName } from "./field-year-core";
import { Icon } from "./Icon";
import { planReasons, type Reason } from "./plan-facts";
import { colors, radius, space, text } from "./theme";

// The farmer's answer for one lot: which crops to plant, in order, with the planting and
// harvest month of each, a one-line picture of the year, and plain reasons against the crops
// grown now. What to ask the technician comes last. No scores up front: one small line only.

type Props = {
  option: RotationOption;
  baseline: RotationOption;
  lotName: string;
  cropById: (id: string) => Crop | undefined;
};

const STRIP_H = 30;
const SVG_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function PlantCard({ option, baseline, lotName, cropById }: Props) {
  const { t, lang, months } = useT();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const isBaseline = option.key === baseline.key;
  const name = (id: string) => cropLabel(lang, cropById(id), id);
  const title = isBaseline
    ? t("plant.yours", { lot: lotName })
    : option.top_total
      ? t("plant.best", { lot: lotName })
      : t("plant.other", { lot: lotName });
  const { gains, watch } = planReasons(option, baseline, (id) => cropById(id)?.n_fixing === true);
  const { pieces } = bandPieces(option.slots);
  const monthW = (m: number) => (m === 12 ? width : monthX(m + 1) * width) - monthX(m) * width;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={[styles.key, { backgroundColor: PLAN_COLOR[option.key] ?? colors.ink }]}>
          <Text style={styles.keyText}>{option.key}</Text>
        </View>
        <View style={styles.titleText}>
          <Text style={text.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={text.small}>{planName(option.kind, t)}</Text>
        </View>
      </View>

      <View style={styles.steps}>
        {option.slots.map((s, i) => {
          const st = familyStyle(cropById(s.crop_id)?.family);
          return (
            <View key={i} style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: st.fill }]}>
                <Text style={[styles.stepNumText, { color: st.ink }]}>{i + 1}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.cropName}>{name(s.crop_id)}</Text>
                <Text style={text.body}>{t("plant.step", { plant: months[s.plant_month - 1], harvest: months[s.harvest_month - 1] })}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View onLayout={onLayout} accessible accessibilityLabel={option.slots.map((s) => name(s.crop_id)).join(", ")}>
        {width > 0 ? (
          <Svg width={width} height={STRIP_H + 18}>
            <Rect x={0} y={0} width={width} height={STRIP_H} rx={6} fill={colors.bg} />
            {option.metrics.bare_months.map((m) => (
              <Hatch key={m} x={monthX(m) * width} w={monthW(m)} h={STRIP_H} />
            ))}
            {pieces
              .filter((p) => p.lane === 0)
              .map((p, i) => {
                const st = familyStyle(cropById(p.crop_id)?.family);
                const x = dayX(p.start) * width;
                const w = Math.max(2, dayX(p.end) * width - x);
                return <Rect key={i} x={x + 1} y={0} width={Math.max(1, w - 2)} height={STRIP_H} rx={6} fill={st.fill} />;
              })}
            {months.map((mn, i) => (
              <SvgText key={i} x={monthX(i + 1) * width + monthW(i + 1) / 2} y={STRIP_H + 14} fontSize={11} fontFamily={SVG_FONT} fill={colors.muted} textAnchor="middle">
                {mn.charAt(0)}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>

      {isBaseline && option.top_total ? <Text style={text.body}>{t("plant.yoursBest")}</Text> : null}
      {!isBaseline ? (
        <View style={styles.reasons}>
          <Text style={text.bodyStrong}>{t("plant.why")}</Text>
          {gains.length === 0 ? <Text style={text.body}>{t("plant.none")}</Text> : null}
          {gains.map((r, i) => (
            <Line key={i} icon="check" color={colors.green} text={reasonText(r, t, name)} />
          ))}
          {watch.length > 0 ? <Text style={[text.bodyStrong, styles.watchTitle]}>{t("plant.watch")}</Text> : null}
          {watch.map((r, i) => (
            <Line key={i} icon="alert" color={colors.amber} text={reasonText(r, t, name)} />
          ))}
        </View>
      ) : null}

      <View style={styles.ask}>
        <Text style={text.bodyStrong}>{t("detail.ask")}</Text>
        {option.new_crop_ids.map((id) => (
          <Text key={id} style={text.body}>
            {t("detail.askNew", { crop: name(id) })}
          </Text>
        ))}
        <Text style={text.small}>{t("detail.askConfirm")}</Text>
      </View>

      {option.total !== null && baseline.total !== null ? (
        <Text style={text.caption}>{t("plant.score", { score: Math.round(option.total), base: Math.round(baseline.total) })}</Text>
      ) : null}
    </View>
  );
}

function reasonText(r: Reason, t: T, name: (id: string) => string): string {
  switch (r.key) {
    case "reason.legume":
      return t(r.key, { crop: name(r.crop_id) });
    case "reason.families":
      return t(r.key, { n: r.n, base: r.base });
    default:
      return t(r.key, { n: r.n });
  }
}

function Line({ icon, color, text: body }: { icon: "check" | "alert"; color: string; text: string }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size={20} color={color} />
      <Text style={[text.body, styles.lineText]}>{body}</Text>
    </View>
  );
}

function Hatch({ x, w, h }: { x: number; w: number; h: number }) {
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
      <Rect x={x} y={0} width={w} height={h} fill="#CFC6B4" opacity={0.55} />
      <Path d={lines.join("")} stroke="#9C917B" strokeWidth={1} />
    </G>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  titleText: { flex: 1, gap: 2 },
  key: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 16, fontWeight: "700", color: colors.white },
  steps: { gap: space.md },
  step: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepNum: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 18, fontWeight: "700" },
  stepText: { flex: 1, gap: 2 },
  cropName: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  reasons: { gap: space.sm },
  watchTitle: { marginTop: space.xs },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  lineText: { flex: 1 },
  ask: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.amberTint },
});
