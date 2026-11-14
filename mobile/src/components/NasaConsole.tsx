import { useSyncExternalStore } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SOURCES, type SourceKey } from "../content/sources";
import { effectiveRain } from "../engine/waterBalance";
import { SATELLITE } from "../data/satellite";
import { useT } from "../i18n/lang-store";
import { type CallRecord, getCalls, subscribeCalls } from "../net/call-log";
import { type ConsoleState, getConsole, setConsole, subscribeConsole } from "./console-store";
import { Icon } from "./Icon";
import { getInspector, openInspector, subscribeInspector } from "./inspector-store";
import { monthStates } from "./season-guide-core";
import { InspectorBody } from "./SourceInspector";
import { radius, space } from "./theme";

// The NASA data console beside the farmer's app (presenter layout): what NASA measured for the
// month and lot the farmer is looking at, every request the app makes to NASA as it happens, and
// the datasets behind the lot. Clicking a line opens that dataset's detail (variables, use,
// formulas) in the console. All values are read from the lot's data and the bundled satellite
// files; the only sum done here is effective rain, with the engine's own function.

const C = {
  bg: "#10241A",
  panel: "#163023",
  line: "#2A4A39",
  text: "#E7F0EA",
  muted: "#9CB8A6",
  accent: "#8FD6A6",
  warn: "#F0C46A",
  bad: "#F08A7A",
};
const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SFMono-Regular, Menlo, monospace" });

type Row = { label: string; value: string; key: SourceKey; code: string };

const f0 = (v: number | null | undefined) => (typeof v === "number" ? `${Math.round(v)}` : "n/a");
const f1 = (v: number | null | undefined) => (typeof v === "number" ? v.toFixed(1) : "n/a");
const f2 = (v: number | null | undefined) => (typeof v === "number" ? v.toFixed(2) : "n/a");

export function NasaConsole() {
  const st = useSyncExternalStore(subscribeConsole, getConsole, getConsole);
  const insp = useSyncExternalStore(subscribeInspector, getInspector, getInspector);
  const calls = useSyncExternalStore(subscribeCalls, getCalls, getCalls);
  const { months } = useT();
  const pending = calls.some((c) => c.status === "pending");

  return (
    <View style={styles.wrap} accessibilityLabel="NASA data console">
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: pending ? C.warn : C.accent }]} />
        <View style={styles.flex}>
          <Text style={styles.title}>NASA data console</Text>
          <Text style={styles.sub}>{pending ? "Receiving NASA data…" : "What NASA data sits behind the screen on the left"}</Text>
        </View>
        <Pressable onPress={() => setConsole({ open: false })} accessibilityRole="button" accessibilityLabel="Hide the NASA data console" style={styles.iconBtn}>
          <Icon name="close" size={20} color={C.text} />
        </Pressable>
      </View>

      {insp ? (
        <View style={styles.inspector}>
          <InspectorBody k={insp.key} period={insp.period} />
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
          <MonthBlock st={st} monthName={months[st.month - 1]} />
          <LogBlock st={st} calls={calls} />
          <DatasetBlock st={st} />
        </ScrollView>
      )}
    </View>
  );
}

/** The collapsed console: a slim bar to bring it back. */
export function ConsoleRail() {
  return (
    <Pressable onPress={() => setConsole({ open: true })} accessibilityRole="button" accessibilityLabel="Show the NASA data console" style={styles.rail}>
      <Text style={styles.railText}>NASA data</Text>
    </Pressable>
  );
}

function MonthBlock({ st, monthName }: { st: ConsoleState; monthName: string }) {
  const d = st.data;
  if (!d || !st.lotName) {
    return (
      <Block title="This month">
        <Text style={styles.sub}>Open a lot to see the NASA values behind it.</Text>
      </Block>
    );
  }
  const i = st.month - 1;
  const m = d.monthly;
  const rain = m.precip_mm.p50[i];
  const rows: Row[] = [
    { label: "Rain, typical year", value: `${f0(rain)} mm`, key: d.kind === "demo" ? "power-daily" : "power", code: "PRECTOTCORR" },
    { label: "Rain, dry to wet year", value: `${f0(m.precip_mm.p20[i])} to ${f0(m.precip_mm.p80[i])} mm`, key: d.kind === "demo" ? "power-daily" : "power", code: "p20 to p80" },
    { label: "Rain that reaches roots", value: typeof rain === "number" ? `${f0(effectiveRain(rain))} mm` : "n/a", key: d.kind === "demo" ? "power-daily" : "power", code: "Brouwer 1986" },
    { label: "Water sun and wind take", value: `${f0(m.et0_mm[i])} mm`, key: d.kind === "demo" ? "power-daily" : "power", code: "ET0 FAO-56" },
    { label: "Day high / night low", value: `${f1(m.tmax_c[i])} / ${f1(m.tmin_c[i])} °C`, key: d.kind === "demo" ? "power-daily" : "power", code: d.kind === "demo" ? "T2M_MAX/MIN" : "T2M ± RANGE/2" },
    { label: "Root-zone wetness", value: f2(m.rootzone_wetness[i]), key: d.kind === "demo" ? "power-daily" : "power", code: "GWETROOT" },
  ];
  if (m.heat_days_gt35) rows.push({ label: "Days above 35 °C", value: f2(m.heat_days_gt35[i]), key: "power-daily", code: "T2M_MAX" });
  if (m.heavy_rain_days_gt50mm) rows.push({ label: "Days above 50 mm rain", value: f2(m.heavy_rain_days_gt50mm[i]), key: "power-daily", code: "PRECTOTCORR" });
  const sat = d.kind === "demo" ? SATELLITE[d.id] : undefined;
  if (sat?.imerg) rows.push({ label: "Satellite rain, typical year", value: `${f0(sat.imerg.monthly[i]?.p50_mm)} mm`, key: "imerg", code: "IMERG V07" });
  if (sat?.smap) rows.push({ label: "Soil water, root zone", value: `${f2(sat.smap.monthly[i]?.rootzone_m3m3.mean)} m³/m³`, key: "smap", code: "SMAP L4" });
  if (d.elevation_m !== null) rows.push({ label: "Field height, slope", value: `${f0(d.elevation_m)} m, ${d.slope_pct ?? "n/a"}%`, key: "srtm", code: "SRTM 30 m" });

  const state = st.plan ? monthStates(st.plan)[i] : null;
  const name = st.cropName ?? ((id: string) => id);
  const field = state
    ? [
        state.plant.length ? `plant ${state.plant.map(name).join(", ")}` : "",
        state.harvest.length ? `harvest ${state.harvest.map(name).join(", ")}` : "",
        state.field.filter((c) => !state.plant.includes(c) && !state.harvest.includes(c)).length
          ? `growing ${state.field.filter((c) => !state.plant.includes(c) && !state.harvest.includes(c)).map(name).join(", ")}`
          : "",
      ].filter(Boolean)
    : [];

  return (
    <Block title={`${monthName} on ${st.lotName}`}>
      <Text style={styles.ctx}>
        {st.planLabel ? `Plan: ${st.planLabel}. ` : ""}
        {field.length ? `This month: ${field.join("; ")}.` : "Field empty this month."}
        {state?.risks.length ? ` Watch: ${state.risks.map((r) => (r === "dry" ? "short of water" : r === "hot" ? "too hot" : "too wet")).join(", ")}.` : ""}
      </Text>
      <Text style={styles.hint}>{"Tap a month in the farmer's year to change it."}</Text>
      {rows.map((r) => (
        <Pressable key={r.label} onPress={() => openInspector(r.key, d.period)} accessibilityRole="button" style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (pressed || hovered) && styles.rowOn]}>
          <View style={styles.flex}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.code}>{`${SOURCES[r.key].name} · ${r.code}`}</Text>
          </View>
          <Text style={styles.rowValue}>{r.value}</Text>
        </Pressable>
      ))}
      <Text style={styles.hint}>{d.kind === "demo" ? `Sample farm: NASA POWER daily ${d.period}, bundled with the app.` : `NASA POWER ${d.period}, fetched for this lot.`}</Text>
    </Block>
  );
}

function LogBlock({ st, calls }: { st: ConsoleState; calls: readonly CallRecord[] }) {
  const d = st.data;
  return (
    <Block title="Requests to NASA">
      {calls.length === 0 ? (
        <Text style={styles.sub}>
          {d?.kind === "demo" ? "None yet: the sample farm's NASA data is bundled. Add a lot to watch live requests." : "None since the app opened. Add a lot to watch live requests."}
        </Text>
      ) : (
        calls.slice(0, 8).map((c) => (
          <Pressable key={c.id} onPress={() => openInspector(c.source)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.log, hovered && styles.rowOn]}>
            <Text style={styles.logLine}>
              <Text style={{ color: C.muted }}>{clock(c.at)} </Text>
              <Text style={{ color: c.status === "ok" ? C.accent : c.status === "error" ? C.bad : C.warn }}>
                {c.status === "ok" ? `${c.http}` : c.status === "error" ? "ERR" : "..."}
              </Text>
              {` GET ${c.endpoint}`}
            </Text>
            {c.params.length ? <Text style={styles.logParams}>{c.params.map(([k, v]) => `${k}=${v.length > 40 ? `${v.slice(0, 40)}…` : v}`).join(" ")}</Text> : null}
            <Text style={styles.logParams}>{`${SOURCES[c.source].name}${c.ms !== undefined ? `, ${(c.ms / 1000).toFixed(1)} s` : ""}`}</Text>
          </Pressable>
        ))
      )}
    </Block>
  );
}

function DatasetBlock({ st }: { st: ConsoleState }) {
  const d = st.data;
  const sat = d?.kind === "demo" ? SATELLITE[d.id] : undefined;
  const keys: SourceKey[] = [d?.kind === "demo" ? "power-daily" : "power", "srtm"];
  if (d?.kind === "live") keys.push("power-daily");
  if (sat?.imerg) keys.push("imerg");
  if (sat?.smap) keys.push("smap");
  if (sat?.ndvi) keys.push("modis");
  return (
    <Block title="NASA datasets in this app">
      {keys.map((k) => (
        <Pressable key={k} onPress={() => openInspector(k, d?.period ?? "")} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (pressed || hovered) && styles.rowOn]}>
          <View style={styles.flex}>
            <Text style={styles.rowLabel}>{SOURCES[k].name}</Text>
            <Text style={styles.code}>{`${SOURCES[k].scale}, ${SOURCES[k].years.replace("{period}", d?.period ?? "")}`}</Text>
          </View>
          <Text style={styles.more}>Formulas ›</Text>
        </Pressable>
      ))}
    </Block>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function clock(ms: number): string {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: C.line },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { color: C.text, fontSize: 17, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 13, lineHeight: 18 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  body: { padding: space.lg, gap: space.lg },
  block: { gap: 6, backgroundColor: C.panel, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: C.line },
  blockTitle: { color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  ctx: { color: C.text, fontSize: 14, lineHeight: 20 },
  hint: { color: C.muted, fontSize: 12, lineHeight: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 6, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 6, borderTopWidth: 1, borderTopColor: C.line },
  rowOn: { backgroundColor: "#1E3D2D" },
  rowLabel: { color: C.text, fontSize: 14 },
  rowValue: { color: C.accent, fontFamily: MONO, fontSize: 14, fontWeight: "700" },
  code: { color: C.muted, fontFamily: MONO, fontSize: 11 },
  more: { color: C.accent, fontSize: 13, fontWeight: "700" },
  log: { gap: 1, paddingVertical: 5, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 6, borderTopWidth: 1, borderTopColor: C.line },
  logLine: { color: C.text, fontFamily: MONO, fontSize: 12 },
  logParams: { color: C.muted, fontFamily: MONO, fontSize: 11 },
  inspector: { flex: 1, backgroundColor: "#FFFFFF" },
  rail: { width: 36, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  railText: { color: C.accent, fontWeight: "700", fontSize: 13, transform: [{ rotate: "-90deg" }], width: 120, textAlign: "center" },
});
