import { StyleSheet, Text, View } from "react-native";

import type { LotData } from "../types";
import { hasDays, monthsLine, trendPeriod, trendSentences } from "./climate-extremes-core";
import { type InfoRef, useExplainer } from "./InfoToggle";
import { MonthChart, type MonthSeries } from "./MonthChart";
import { colors, radius, space, text } from "./theme";

// Heat-stress, heavy-rain and frost days per month and the long-term trends, from NASA POWER
// daily data (demo farms: pipeline; live lots: src/data/power-daily.ts). Nothing is computed
// here: every number is read from the lot's data file.

export function ClimateExtremesCard({ data, info }: { data: LotData; info?: InfoRef }) {
  const title = "Heat, heavy rain, frost and long-term trends";
  const ex = useExplainer(info, title);
  const m = data.monthly;
  const missing = data.kind === "live" ? "Not loaded yet. It loads with a signal." : "Not available for this farm.";
  const rows = [
    { name: "Very hot days (above 35 °C)", series: m.heat_days_gt35 },
    { name: "Very heavy rain days (above 50 mm in a day)", series: m.heavy_rain_days_gt50mm },
    { name: "Frost days (below 0 °C)", series: m.frost_days_lt0 },
  ];
  const chart: MonthSeries[] = [];
  if (hasDays(m.heat_days_gt35)) chart.push({ label: "Above 35 °C", color: colors.amber, kind: "bar", values: m.heat_days_gt35 ?? [] });
  if (hasDays(m.heavy_rain_days_gt50mm)) chart.push({ label: "Above 50 mm rain", color: colors.blue, kind: "bar", values: m.heavy_rain_days_gt50mm ?? [] });
  if (hasDays(m.frost_days_lt0)) chart.push({ label: "Below 0 °C", color: colors.ink, kind: "bar", values: m.frost_days_lt0 ?? [] });
  const trends = trendSentences(data);
  const period = data.trends ? trendPeriod(data) : data.period;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[text.heading, styles.flex]} accessibilityRole="header">
          {title}
        </Text>
        {ex.button}
      </View>
      {ex.box}
      {ex.chips}
      <Text style={[text.small, styles.muted]}>{`Average days per month, NASA POWER daily data, ${period}.`}</Text>
      {rows.map((r) => {
        const line = monthsLine(r.series);
        return (
          <View key={r.name} style={styles.row}>
            <Text style={text.bodyStrong}>{r.name}</Text>
            <Text style={[text.body, line ? null : styles.muted]}>{line ?? missing}</Text>
          </View>
        );
      })}
      {chart.length > 0 ? <MonthChart series={chart} unit="days per month" decimals={2} /> : null}
      <View style={styles.row}>
        <Text style={text.bodyStrong}>Long-term trends</Text>
        {trends ? (
          trends.map((s) => (
            <Text key={s} style={text.small}>
              {`• ${s}`}
            </Text>
          ))
        ) : (
          <Text style={[text.body, styles.muted]}>{missing}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  row: { gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm },
  muted: { color: colors.muted },
});
