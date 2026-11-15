import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { MONTH_LONG } from "../lots/months-core";
import type { LiveSatellite } from "../data/live-satellite";
import { type ImergFile, type MonthPct, SATELLITE, type SatelliteFiles } from "../data/satellite";
import { type InfoRef, useExplainer } from "./InfoToggle";
import { MonthChart } from "./MonthChart";
import { SourceChip } from "./SourceChip";
import { colors, radius, space, text } from "./theme";

// "Satellite checks" (sample farm): NASA satellite products set beside the NASA POWER numbers the
// results use, so a judge or technician can see where two NASA sources agree, plus NASA vegetation,
// plant water stress and land-model water balance for the same point. Nothing here feeds the scores. Every number comes from the bundled files the pipeline wrote (pipeline/fetch_*.py).

const POWER = "#8A6A2F";
const SAT = "#2F6FB0";
const SAT2 = "#6FA3D6";
const GREEN = "#3F7D4E";
const GREEN2 = "#8DBF6A";
const RUNOFF = "#8A6A2F";

export function SatelliteCard({
  farmId,
  lotName,
  info,
  files,
  live,
}: {
  farmId: string;
  lotName: string;
  info?: InfoRef;
  /** Live lots (2026-11-15): the files fetched through our API Worker instead of the bundled ones. */
  files?: SatelliteFiles;
  live?: LiveSatellite;
}) {
  const title = "Satellite checks";
  const ex = useExplainer(info, title);
  const sat = files ?? SATELLITE[farmId];
  const any = sat && (sat.imerg || sat.smap || sat.ndvi || sat.hls || sat.ecostress || sat.fldas);
  if (!sat || (!any && !live)) return null;
  const { imerg, smap, ndvi, hls, ecostress, fldas } = sat;

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
      {live ? (
        <View style={styles.block}>
          {live.srtm?.elevation_m != null ? (
            <Text style={text.small}>
              {`Elevation (NASA SRTM): about ${Math.round(live.srtm.elevation_m)} m${live.srtm.slope_deg != null ? `, slope about ${live.srtm.slope_deg.toFixed(1)} degrees` : ""}.`}
            </Text>
          ) : null}
          {live.waiting.length > 0 ? (
            <View style={styles.wait}>
              <ActivityIndicator size="small" color={colors.green} />
              <Text style={[text.caption, styles.flex]}>{`Getting from NASA for ${lotName}: ${live.waiting.join(", ")}.`}</Text>
            </View>
          ) : null}
          {live.failed.length > 0 ? (
            <Text style={[text.caption, styles.muted]}>{`Could not get now: ${live.failed.join(", ")}. The results still use NASA POWER.`}</Text>
          ) : null}
        </View>
      ) : null}

      {imerg ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.fullLine]}>Rain in a typical year</Text>
            <SourceChip k="imerg" />
            <SourceChip k={live ? "power" : "power-daily"} />
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

      {ndvi || hls ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.fullLine]}>How green the ground is</Text>
            {ndvi ? <SourceChip k="modis" /> : null}
            {hls ? <SourceChip k="hls" /> : null}
          </View>
          <MonthChart
            unit="NDVI, 0 to 1"
            decimals={2}
            series={[
              ...(ndvi ? [{ label: "MODIS NDVI (250 m)", color: GREEN, kind: "line" as const, values: p50(ndvi.monthly), lo: p20(ndvi.monthly), hi: p80(ndvi.monthly) }] : []),
              ...(hls ? [{ label: "HLS NDVI (30 m)", color: GREEN2, kind: "line" as const, values: p50(hls.monthly) }] : []),
            ]}
          />
          <Text style={[text.caption, styles.muted]}>
            {[ndvi ? rangeLine("MODIS", ndvi.period, ndvi.monthly, 2) : null, hls ? rangeLine("HLS", hls.period, hls.monthly, 2) : null]
              .filter(Boolean)
              .join(" ")}
            {` At the sample farm point, not the outline of ${lotName}. Higher means greener. Clear days only. Line: middle year; band: low to high year (MODIS).`}
          </Text>
        </View>
      ) : null}

      {ecostress ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.fullLine]}>Plant water stress</Text>
            <SourceChip k="ecostress" />
          </View>
          <MonthChart
            unit="ESI, 0 high stress to 1 no stress"
            decimals={2}
            series={[{ label: "ECOSTRESS ESI, middle year", color: SAT, kind: "line", values: p50(ecostress.esi.monthly), lo: p20(ecostress.esi.monthly), hi: p80(ecostress.esi.monthly) }]}
          />
          <Text style={[text.caption, styles.muted]}>
            {`${rangeLine("ESI", ecostress.esi.period, ecostress.esi.monthly, 2)} Daily evapotranspiration on the same overpasses: ${rangeText(ecostress.et_daily.monthly, 1)} mm/day. ${ecostress.esi.valid_samples} clear-sky samples in all; a blank month had none, and cloudy (often rainy) days are missing.`}
          </Text>
        </View>
      ) : null}

      {fldas ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[text.bodyStrong, styles.fullLine]}>Water in and out (land model)</Text>
            <SourceChip k="fldas" />
          </View>
          <MonthChart
            unit="mm per month"
            series={[
              { label: "Rain (CHIRPS, in the model)", color: SAT, kind: "line", values: p50(fldas.monthly.rainfall_mm), lo: p20(fldas.monthly.rainfall_mm), hi: p80(fldas.monthly.rainfall_mm) },
              { label: "Evapotranspiration", color: GREEN, kind: "line", values: p50(fldas.monthly.evapotranspiration_mm) },
              { label: "Runoff", color: RUNOFF, kind: "line", values: p50(fldas.monthly.total_runoff_mm) },
            ]}
          />
          <Text style={[text.caption, styles.muted]}>
            {`${fldas.period}. A model run (FLDAS Noah), not a measurement. Top 10 cm soil water, middle year: ${rangeText(fldas.monthly.soil_moisture_0_10cm_m3m3, 2)} m³/m³. Lines: middle year; band: dry to wet year (rain).`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const p20 = (m: readonly MonthPct[]) => m.map((x) => x.p20);
const p50 = (m: readonly MonthPct[]) => m.map((x) => x.p50);
const p80 = (m: readonly MonthPct[]) => m.map((x) => x.p80);

/** "0.75 (April) to 0.82 (August)": the lowest and highest middle-year month, straight from the file. */
function rangeText(m: readonly MonthPct[], decimals: number): string {
  const ok = m.filter((x): x is MonthPct & { p50: number } => x.p50 !== null);
  if (ok.length === 0) return "no data";
  const lo = ok.reduce((a, b) => (b.p50 < a.p50 ? b : a));
  const hi = ok.reduce((a, b) => (b.p50 > a.p50 ? b : a));
  return `${lo.p50.toFixed(decimals)} (${MONTH_LONG[lo.month - 1]}) to ${hi.p50.toFixed(decimals)} (${MONTH_LONG[hi.month - 1]})`;
}

function rangeLine(name: string, period: string, m: readonly MonthPct[], decimals: number): string {
  return `${name} ${period}, middle year: ${rangeText(m, decimals)}.`;
}

function rainLine(imerg: ImergFile): string {
  const sum = (xs: (number | null)[]) => (xs.some((x) => x === null) ? null : xs.reduce<number>((a, b) => a + (b ?? 0), 0));
  const ps = sum(imerg.power_compare.monthly.map((m) => m.power_p50_mm));
  const is = sum(imerg.monthly.map((m) => m.p50_mm));
  // A missing month would make the sum too small, so say nothing rather than a wrong total.
  if (ps === null || is === null) return "Bars: middle year per month; whiskers: dry to wet year.";
  const p = Math.round(ps);
  const i = Math.round(is);
  return `Monthly middle values add up to about ${p} mm (NASA POWER) and ${i} mm (IMERG). Bars: middle year per month; whiskers: dry to wet year.`;
}

const styles = StyleSheet.create({
  wait: { flexDirection: "row", alignItems: "center", gap: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  fullLine: { width: "100%" },
  muted: { color: colors.muted },
  block: { gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  // Title on its own line, then the source chips (wrapping), so a narrow panel never squeezes the title.
  blockHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs },
});
