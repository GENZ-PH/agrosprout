import { StyleSheet, Text, View } from "react-native";

import { SATELLITE } from "../data/satellite";
import { type InfoRef, useExplainer } from "./InfoToggle";
import { MonthChart } from "./MonthChart";
import { SourceChip } from "./SourceChip";
import { colors, radius, space, text } from "./theme";

// "Satellite checks" (sample farm): NASA satellite products set beside the NASA POWER numbers the
// results use, so a judge or technician can see where two NASA sources agree. Nothing here feeds
// the scores. Every number comes from the bundled files the pipeline wrote (pipeline/fetch_*.py).

const POWER = "#8A6A2F";
const SAT = "#2F6FB0";
const SAT2 = "#6FA3D6";
const GREEN = "#3F7D4E";

export function SatelliteCard({ farmId, lotName, info }: { farmId: string; lotName: string; info?: InfoRef }) {
  const title = "Satellite checks";
  const ex = useExplainer(info, title);
  const sat = SATELLITE[farmId];
  if (!sat || (!sat.imerg && !sat.smap && !sat.ndvi)) return null;
  const { imerg, smap, ndvi } = sat;
  const ndviSeries = ndvi ? (ndvi.monthly[lotKey(Object.keys(ndvi.monthly), lotName)] ?? Object.values(ndvi.monthly)[0]) : null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[text.heading, styles.flex]} accessibilityRole="header">
          {title}
        </Text>
        {ex.button}
      </View>
      {ex.box}
      <Text style={[text.small, styles.muted]}>
        A check on the NASA POWER numbers. Not used in the scores.
      </Text>

      {imerg ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.flex]}>Rain in a typical year</Text>
            <SourceChip k="imerg" />
            <SourceChip k="power-daily" />
          </View>
          <MonthChart
            unit="mm per month"
            series={[
              { label: "NASA POWER (used)", color: POWER, kind: "bar", values: imerg.power_compare.monthly.map((m) => m.power_p50_mm), lo: imerg.power_compare.monthly.map((m) => m.power_p20_mm), hi: imerg.power_compare.monthly.map((m) => m.power_p80_mm) },
              { label: "GPM IMERG (satellite)", color: SAT, kind: "bar", values: imerg.monthly.map((m) => m.p50_mm), lo: imerg.monthly.map((m) => m.p20_mm), hi: imerg.monthly.map((m) => m.p80_mm) },
            ]}
          />
          <Text style={[text.caption, styles.muted]}>{rainLine(imerg)}</Text>
        </View>
      ) : null}

      {smap ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.flex]}>Soil moisture</Text>
            <SourceChip k="smap" />
          </View>
          <MonthChart
            unit="m³ water per m³ soil"
            decimals={2}
            series={[
              { label: "Root zone, 0-100 cm", color: SAT, kind: "line", values: smap.monthly.map((m) => m.rootzone_m3m3.mean), lo: smap.monthly.map((m) => m.rootzone_m3m3.p20), hi: smap.monthly.map((m) => m.rootzone_m3m3.p80) },
              { label: "Surface, 0-5 cm", color: SAT2, kind: "line", values: smap.monthly.map((m) => m.surface_m3m3.mean) },
            ]}
          />
          <Text style={[text.caption, styles.muted]}>
            {`${smap.period}. Band: dry to wet year.`}
          </Text>
        </View>
      ) : null}

      {ndviSeries ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.flex]}>How green the ground is</Text>
            <SourceChip k="modis" />
          </View>
          <MonthChart
            unit="NDVI, 0 to 1"
            decimals={1}
            series={[{ label: "MODIS NDVI, middle year", color: GREEN, kind: "line", values: ndviSeries.map((m) => m.median), lo: ndviSeries.map((m) => m.p20), hi: ndviSeries.map((m) => m.p80) }]}
          />
          <Text style={[text.caption, styles.muted]}>
            {`Around ${lotName}. Higher means greener.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The NDVI series key for a lot, by name ("Paddy lot" -> "paddy"); first one otherwise. */
function lotKey(keys: string[], lotName: string): string {
  const n = lotName.toLowerCase();
  return keys.find((k) => n.includes(k.toLowerCase())) ?? keys[0];
}

function rainLine(imerg: NonNullable<(typeof SATELLITE)[string]["imerg"]>): string {
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
  const p = Math.round(sum(imerg.power_compare.monthly.map((m) => m.power_p50_mm)));
  const i = Math.round(sum(imerg.monthly.map((m) => m.p50_mm)));
  return `About ${p} mm a year (NASA POWER) and ${i} mm (IMERG). Whiskers: dry to wet year.`;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: colors.muted },
  block: { gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  blockHead: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
});
