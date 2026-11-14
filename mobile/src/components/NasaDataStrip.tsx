import { Pressable, StyleSheet, Text, View } from "react-native";

import { SOURCES, type SourceKey } from "../content/sources";
import { SATELLITE } from "../data/satellite";
import type { LotData } from "../types";
import { Icon } from "./Icon";
import { type InfoRef, useExplainer } from "./InfoToggle";
import { openInspector } from "./inspector-store";
import { ensoLine } from "./LotDataCard";
import { colors, radius, space, text } from "./theme";

// The top of the NASA data view: one tile per NASA dataset behind this lot, with the value it
// gives here. Clicking a tile opens the inspector (what the app takes from it, how, formulas).
// Values come from the lot's data file and the bundled satellite files; nothing is computed here
// except the yearly rain sum of the typical-year months.

type Tile = { key: SourceKey; value: string; detail: string };

export function nasaTiles(data: LotData, lotName: string): Tile[] {
  const tiles: Tile[] = [];
  const p50 = data.monthly.precip_mm?.p50;
  const rain = p50 && p50.every((v) => typeof v === "number") ? Math.round((p50 as number[]).reduce((a, b) => a + b, 0)) : null;
  const daily = data.kind === "demo" || data.trends !== null;
  tiles.push({
    key: daily && data.kind === "demo" ? "power-daily" : "power",
    value: rain !== null ? `About ${rain} mm of rain in a typical year` : "Rain, temperature, humidity, wind, sunshine",
    detail: `Climate, ${data.period}, about 50 km cell`,
  });
  if (data.kind === "live" && data.trends !== null) {
    tiles.push({ key: "power-daily", value: "Hot days, heavy rain days, trends", detail: `Daily values, ${data.period}` });
  }
  tiles.push({
    key: "srtm",
    value: data.elevation_m !== null ? `${Math.round(data.elevation_m)} m high${data.slope_pct !== null ? `, slope ${data.slope_pct}%` : ""}` : "Not loaded yet",
    detail: "Elevation and slope, about 30 m",
  });
  const sat = data.kind === "demo" ? SATELLITE[data.id] : undefined;
  if (sat?.imerg) tiles.push({ key: "imerg", value: "Satellite rain, to check NASA POWER", detail: `${sat.imerg.period}, about 11 km` });
  if (sat?.smap) tiles.push({ key: "smap", value: "Soil moisture, surface and root zone", detail: `${sat.smap.period}, 9 km` });
  if (sat?.ndvi) tiles.push({ key: "modis", value: `How green the ground is around ${lotName}`, detail: `${sat.ndvi.period}, about 250 m` });
  return tiles;
}

export function NasaDataStrip({ data, lotName, info, wide }: { data: LotData; lotName: string; info: InfoRef; wide: boolean }) {
  const title = `NASA data for ${lotName}`;
  const ex = useExplainer(info, title);
  const tiles = nasaTiles(data, lotName);
  const enso = ensoLine();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={text.heading} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[text.small, styles.muted]}>Open a dataset to see what the app takes from it and the formulas.</Text>
        </View>
        {ex.button}
      </View>
      {ex.box}
      {ex.box && data.caveats.length > 0 ? (
        <View style={styles.caveats}>
          {data.caveats.map((c) => (
            <Text key={c} style={[text.small, styles.muted]}>
              {`• ${c}`}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.grid}>
        {tiles.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => openInspector(t.key, info.period)}
            accessibilityRole="button"
            accessibilityLabel={`${SOURCES[t.key].name}: ${t.value}. Open the details.`}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.tile, wide ? styles.tileWide : styles.tileNarrow, (pressed || hovered) && styles.tileActive]}
          >
            <View style={styles.tileHead}>
              <Text style={[text.small, styles.name]} numberOfLines={1}>
                {SOURCES[t.key].name}
              </Text>
              <Icon name="chevron" size={16} color={colors.green} />
            </View>
            <Text style={text.bodyStrong}>{t.value}</Text>
            <Text style={[text.caption, styles.muted]}>{t.detail}</Text>
          </Pressable>
        ))}
      </View>
      {enso ? <Text style={[text.small, styles.enso]}>{`El Niño this season: ${enso.text.split(". ")[0]}.`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  muted: { color: colors.muted },
  caveats: { gap: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { gap: 4, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.greenTint },
  tileWide: { flexBasis: "31%", flexGrow: 1, maxWidth: "33%" },
  tileNarrow: { flexBasis: "100%" },
  tileActive: { borderColor: colors.ink },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flex: 1, fontWeight: "700", color: colors.green },
  enso: { backgroundColor: colors.amberTint, borderRadius: radius.md, padding: space.sm },
});
