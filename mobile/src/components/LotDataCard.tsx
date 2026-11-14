import { StyleSheet, Text, View } from "react-native";

import context from "../../assets/data/context.json";
import type { LotData } from "../types";
import { type InfoRef, useExplainer } from "./InfoToggle";
import { colors, radius, space, text } from "./theme";

// "NASA data behind this lot": every dataset that feeds this lot's results, with the value it
// gives here, its resolution and years, so a judge or technician can trace each number (#112,
// Part 4 and A8). Values come from the lot's own data file; nothing here is computed.

type Row = { name: string; value: string; detail: string };

const round = (v: number) => Math.round(v);

export function lotDataRows(data: LotData): Row[] {
  const live = data.kind === "live";
  const rows: Row[] = [
    {
      name: "NASA POWER",
      value: `Rain, temperature, humidity, wind, sunshine and soil wetness, ${data.period}`,
      detail:
        "Monthly values for a grid cell about 50 km across (0.5° × 0.625°; sunshine 1° × 1°), so nearby lots share them." +
        (typeof data.cell_elevation_m === "number" ? ` The cell averages about ${round(data.cell_elevation_m)} m above sea level.` : ""),
    },
  ];
  if (data.elevation_m !== null) {
    rows.push({
      name: "NASA SRTM",
      value: `Field elevation about ${round(data.elevation_m)} m${data.slope_pct !== null ? `, slope about ${data.slope_pct}%` : ""}`,
      detail: live
        ? "30 m elevation from the Shuttle Radar Topography Mission (February 2000), for the lot centre rounded to about 110 m. It sets the air pressure in the evaporation sum."
        : "30 m elevation from the Shuttle Radar Topography Mission (February 2000). It sets the air pressure in the evaporation sum.",
    });
  } else {
    rows.push({
      name: "NASA SRTM",
      value: live ? "Field elevation not loaded yet" : "Not available",
      detail: live ? "It loads with a signal. Until then evaporation is worked out at sea level." : "",
    });
  }
  return rows;
}

/** One line of El Niño context from the bundled file (NOAA ONI and the PAGASA advisory). */
export function ensoLine(): { text: string; source: string } | null {
  const oni = context.oni;
  const adv = context.advisory;
  if (!oni || !adv) return null;
  return {
    text: `${adv.issuer} (${adv.issued}): "${adv.title}". It expects below normal to way below normal rain over most of the country in November 2026. The Oceanic Niño Index for ${oni.season} ${oni.year} is +${oni.anomaly_c} °C.`,
    source: `Sources: ${adv.issuer} press release, ${oni.source}. The results use 25 years of records, not a forecast for this season. PAGASA says El Niño makes rain shortfalls more likely, so the dry-year (lower) rain is the one to look at now.`,
  };
}

export function LotDataCard({ data, extra = [], info }: { data: LotData; extra?: Row[]; info?: InfoRef }) {
  const title = "NASA data behind this lot";
  const ex = useExplainer(info, title);
  const rows = [...lotDataRows(data), ...extra];
  const enso = ensoLine();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[text.heading, styles.flex]} accessibilityRole="header">
          {title}
        </Text>
        {ex.button}
      </View>
      {ex.box}
      {ex.box && data.caveats.length > 0 ? (
        <View style={styles.row}>
          <Text style={text.bodyStrong}>Keep in mind for this lot</Text>
          {data.caveats.map((c) => (
            <Text key={c} style={[text.small, styles.muted]}>
              {`• ${c}`}
            </Text>
          ))}
        </View>
      ) : null}
      {ex.chips}
      {rows.map((r) => (
        <View key={r.name} style={styles.row}>
          <Text style={text.bodyStrong}>{r.name}</Text>
          <Text style={text.body}>{r.value}</Text>
        </View>
      ))}
      {enso ? (
        <View style={styles.enso}>
          <Text style={text.bodyStrong}>This season: El Niño</Text>
          <Text style={text.small}>{enso.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

export type { Row as LotDataRow };

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  row: { gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm },
  muted: { color: colors.muted },
  enso: { gap: 4, backgroundColor: colors.amberTint, borderRadius: radius.md, padding: space.md },
});
