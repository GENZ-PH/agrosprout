import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { colors, space, text } from "./theme";

// A small January-to-December chart for one or two series: bars or a line, each with an
// optional p20-p80 band, so two sources of the same quantity can sit side by side (#112 A3, A4).

export type MonthSeries = {
  label: string;
  color: string;
  kind: "bar" | "line";
  values: readonly (number | null)[];
  /** Optional range drawn behind (line) or as whiskers (bar): typically p20 and p80. */
  lo?: readonly (number | null)[];
  hi?: readonly (number | null)[];
};

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const SVG_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const H = 150;
const AXIS_W = 34;
const PAD_TOP = 8; // room for the top tick label

/** Round axis steps covering 0 (or `min`) to `max`. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(max - min, 1e-9);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= max + step * 0.999; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export function MonthChart({ series, min = 0, unit, decimals = 0 }: { series: MonthSeries[]; min?: number; unit: string; decimals?: number }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const all = series.flatMap((s) => [...s.values, ...(s.hi ?? [])]).filter((v): v is number => v !== null && Number.isFinite(v));
  const ticks = niceTicks(min, Math.max(min + 1e-6, ...all));
  const top = ticks[ticks.length - 1];
  const bottom = ticks[0];
  const plotW = Math.max(0, width - AXIS_W);
  const colW = plotW / 12;
  const y = (v: number) => PAD_TOP + H - ((v - bottom) / (top - bottom)) * H;
  const bars = series.filter((s) => s.kind === "bar");
  const barW = bars.length ? Math.min(18, (colW - 6) / bars.length) : 0;

  return (
    <View style={styles.wrap}>
      <View onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={PAD_TOP + H + 22} accessibilityLabel={series.map((s) => s.label).join(", ")}>
            {ticks.map((v) => (
              <G key={v}>
                <Line x1={AXIS_W} x2={width} y1={y(v)} y2={y(v)} stroke={v === bottom ? colors.borderStrong : colors.border} strokeWidth={1} />
                <SvgText x={AXIS_W - 4} y={y(v) + 4} fontSize={11} textAnchor="end" fontFamily={SVG_FONT} fill={colors.muted}>
                  {v.toFixed(decimals)}
                </SvgText>
              </G>
            ))}
            {series.map((s) => {
              if (s.kind === "bar") {
                const bi = bars.indexOf(s);
                return (
                  <G key={s.label}>
                    {s.values.map((v, i) => {
                      if (v === null) return null;
                      const x = AXIS_W + i * colW + (colW - barW * bars.length) / 2 + bi * barW;
                      const lo = s.lo?.[i];
                      const hi = s.hi?.[i];
                      return (
                        <G key={i}>
                          <Rect x={x + 1} y={y(v)} width={Math.max(1, barW - 2)} height={Math.max(0, y(bottom) - y(v))} fill={s.color} rx={2} />
                          {lo != null && hi != null ? (
                            <Line x1={x + barW / 2} x2={x + barW / 2} y1={y(hi)} y2={y(lo)} stroke={colors.ink} strokeWidth={1} />
                          ) : null}
                        </G>
                      );
                    })}
                  </G>
                );
              }
              const pts = s.values.map((v, i) => (v === null ? null : { x: AXIS_W + i * colW + colW / 2, y: y(v) }));
              const d = pts.reduce((acc, p, i) => (p ? `${acc}${i === 0 || !pts[i - 1] ? "M" : "L"}${p.x} ${p.y}` : acc), "");
              let band = "";
              if (s.lo && s.hi && s.lo.every((v) => v !== null) && s.hi.every((v) => v !== null)) {
                const up = s.hi.map((v, i) => `${i === 0 ? "M" : "L"}${AXIS_W + i * colW + colW / 2} ${y(v as number)}`).join("");
                const down = [...s.lo].reverse().map((v, j) => `L${AXIS_W + (11 - j) * colW + colW / 2} ${y(v as number)}`).join("");
                band = `${up}${down}Z`;
              }
              return (
                <G key={s.label}>
                  {band ? <Path d={band} fill={s.color} opacity={0.15} /> : null}
                  <Path d={d} stroke={s.color} strokeWidth={2.5} fill="none" />
                </G>
              );
            })}
            {MONTH_INITIALS.map((m, i) => (
              <SvgText key={i} x={AXIS_W + i * colW + colW / 2} y={PAD_TOP + H + 16} fontSize={11} textAnchor="middle" fontFamily={SVG_FONT} fill={colors.muted}>
                {m}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[s.kind === "bar" ? styles.swatchBar : styles.swatchLine, { backgroundColor: s.color }]} />
            <Text style={text.caption}>{s.label}</Text>
          </View>
        ))}
        <Text style={[text.caption, styles.unit]}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.md, rowGap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatchBar: { width: 12, height: 12, borderRadius: 2 },
  swatchLine: { width: 16, height: 3, borderRadius: 2 },
  unit: { color: colors.muted },
});
