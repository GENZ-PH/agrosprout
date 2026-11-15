import { useState, useSyncExternalStore } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { SOURCES, type SourceKey } from "../content/sources";
import { type CallRecord, getCalls, subscribeCalls } from "../net/call-log";
import { useLiveSatellite } from "../data/live-satellite";
import { SATELLITE } from "../data/satellite";
import type { LotData, Provenance } from "../types";
import { Icon } from "./Icon";
import { SourceChip } from "./SourceChip";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// "NASA data on this page": a panel that opens to show, as it happens, every data request the
// app makes (endpoint, what for, the parameters sent, how long it took) and which NASA datasets
// this lot's results already rest on. The requests come from call-log.ts, which fetchWithTimeout
// fills, so the list cannot leave a call out.

const POWER_MONTHLY = "power.larc.nasa.gov/api/temporal/monthly/point";
const POWER_DAILY = "power.larc.nasa.gov/api/temporal/daily/point";
const SRTM = "api.opentopodata.org/v1/srtm30m";

type Held = { key: SourceKey; endpoint: string; variables: string[]; res: string; period: string; retrieved: string };

/** The datasets in a lot's provenance, one row each, with the variables used from it. */
export function heldDatasets(prov: readonly Provenance[]): Held[] {
  const out = new Map<SourceKey, Held>();
  for (const p of prov) {
    let key: SourceKey | null = null;
    let endpoint = "";
    if (p.source.startsWith("NASA POWER daily")) [key, endpoint] = ["power-daily", POWER_DAILY];
    else if (p.source.startsWith("NASA POWER")) [key, endpoint] = ["power", POWER_MONTHLY];
    else if (p.source.includes("SRTM")) [key, endpoint] = ["srtm", SRTM];
    if (!key) continue;
    const variable = p.source.replace(/^NASA POWER( daily| monthly)?\s*/, "").trim();
    const h = out.get(key) ?? { key, endpoint, variables: [], res: p.native_res, period: p.period, retrieved: p.retrieved };
    if (key !== "srtm" && variable && !variable.startsWith("NASA") && !h.variables.includes(variable)) h.variables.push(variable);
    out.set(key, h);
  }
  return [...out.values()];
}

const PARAM_LABEL: Record<string, string> = {
  parameters: "variables",
  latitude: "lat",
  longitude: "lon",
  start: "from",
  end: "to",
  community: "community",
  locations: "points",
};

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function DataTracePanel({ data }: { data?: LotData }) {
  const [open, setOpen] = useState(false);
  const calls = useSyncExternalStore(subscribeCalls, getCalls, getCalls);
  const held = data ? heldDatasets(data.provenance) : [];
  const pending = calls.some((c) => c.status === "pending");
  const nasaCalls = calls.filter((c) => SOURCES[c.source].nasa).length;
  const reqs = `${nasaCalls} NASA ${nasaCalls === 1 ? "request" : "requests"} since the app opened`;
  // The satellite checks (D35): bundled for the sample farm, fetched through our server for a drawn
  // lot. Shares the query cache with the Satellite checks card, so this asks NASA for nothing more.
  const live = useLiveSatellite(data);
  const files = data?.kind === "demo" ? SATELLITE[data.id] : live?.files;
  const checks: { key: SourceKey; label: string; ready: boolean }[] = data
    ? [
        { key: "imerg", label: "GPM IMERG rain", ready: !!files?.imerg },
        { key: "smap", label: "SMAP soil moisture", ready: !!files?.smap },
        { key: "fldas", label: "FLDAS land model", ready: !!files?.fldas },
        { key: "modis", label: "MODIS greenness", ready: !!files?.ndvi },
        { key: "hls", label: "HLS greenness (Landsat and Sentinel-2)", ready: !!files?.hls },
        { key: "ecostress", label: "ECOSTRESS plant water stress", ready: !!files?.ecostress },
        ...(data.kind === "live" ? [{ key: "srtm" as SourceKey, label: "SRTM elevation and slope", ready: !!live?.srtm }] : []),
      ]
    : [];
  const ready = checks.filter((c) => c.ready).length;
  const summary = data
    ? `${held.length} NASA ${held.length === 1 ? "dataset" : "datasets"} in the results, ${ready} more as checks, ${reqs}`
    : reqs;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`NASA data on this page. ${summary}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={[styles.dot, pending ? styles.dotLive : styles.dotIdle]} />
        <View style={styles.flex}>
          <Text style={text.bodyStrong}>NASA data on this page</Text>
          <Text style={[text.caption, styles.muted]}>{pending ? "Loading NASA data now…" : summary}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chevron" size={20} color={colors.ink} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Text style={styles.section}>Requests since the app opened</Text>
          {calls.length === 0 ? (
            <Text style={[text.small, styles.muted]}>
              {!data
                ? "None yet. Each request to NASA shows up here as soon as the app makes it, for example when you add a lot."
                : data.kind === "demo"
                ? "None yet. The sample farm's NASA data is bundled with the app, so it works offline. The list below says where it came from."
                : "None yet. This lot's data is already saved on the phone; it is fetched again only when the lot changes."}
            </Text>
          ) : (
            calls.map((c) => <CallRow key={c.id} c={c} />)
          )}

          {held.length > 0 ? (
            <>
              <Text style={styles.section}>{"Data this lot's results use"}</Text>
              {held.map((h) => (
                <View key={h.key} style={styles.row}>
                  <View style={styles.rowHead}>
                    <View style={styles.flex}>
                      <SourceChip k={h.key} period={h.period} />
                    </View>
                    <Text style={styles.tag}>{data?.kind === "demo" ? "Bundled" : "Saved on phone"}</Text>
                  </View>
                  <Text style={styles.endpoint}>{h.endpoint}</Text>
                  {h.variables.length > 0 ? <Text style={[text.caption, styles.muted]}>{`Variables: ${h.variables.join(", ")}`}</Text> : null}
                  <Text style={[text.caption, styles.muted]}>
                    {`${h.res}, ${h.period}. ${data?.kind === "demo" ? `Fetched by the team's pipeline on ${h.retrieved}.` : `Fetched on ${h.retrieved}.`}`}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
          {checks.length > 0 ? (
            <>
              <Text style={styles.section}>NASA data set beside the results as checks (not in the scores)</Text>
              {checks.map((c) => (
                <View key={c.key} style={styles.row}>
                  <View style={styles.rowHead}>
                    <View style={styles.flex}>
                      <SourceChip k={c.key} />
                    </View>
                    <Text style={styles.tag}>
                      {c.ready ? (data?.kind === "demo" ? "Bundled" : "Received") : live?.failed.some((f) => f.includes(c.label.split(" ")[0])) ? "Not available now" : "Loading"}
                    </Text>
                  </View>
                  <Text style={[text.caption, styles.muted]}>{c.label}</Text>
                </View>
              ))}
            </>
          ) : null}
          <Text style={[text.caption, styles.muted]}>
            This list stays on your phone. The lot centre is sent to NASA POWER, and to our server for the satellite checks, rounded to 0.1° (about 11 km).
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CallRow({ c }: { c: CallRecord }) {
  const s = SOURCES[c.source];
  const status = c.status === "pending" ? "Loading" : c.status === "ok" ? `OK ${c.http ?? ""}`.trim() : "Failed";
  const params = c.params.map(([k, v]) => `${PARAM_LABEL[k] ?? k} ${v}`).join(", ");
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.flex}>
          <SourceChip k={c.source} />
        </View>
        <Text style={[styles.tag, c.status === "ok" ? styles.tagOk : c.status === "error" ? styles.tagErr : styles.tagLive]}>{status}</Text>
      </View>
      <Text style={text.caption}>{c.purpose}</Text>
      <Text style={styles.endpoint}>{c.endpoint}</Text>
      {params ? <Text style={[text.caption, styles.muted]}>{params}</Text> : null}
      <Text style={[text.caption, styles.muted]}>
        {`${clock(c.at)}${c.ms !== undefined ? `, ${(c.ms / 1000).toFixed(1)} s` : ""}${c.error ? `. ${c.error}` : ""}${s.nasa ? "" : ". Not NASA data"}`}
      </Text>
    </View>
  );
}

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SFMono-Regular, Menlo, monospace" });

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: MIN_TOUCH + 12, paddingHorizontal: space.lg, paddingVertical: space.sm },
  pressed: { backgroundColor: colors.pressed },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: colors.muted },
  strong: { fontWeight: "700" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotIdle: { backgroundColor: colors.green },
  dotLive: { backgroundColor: colors.amber },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
  section: { ...text.small, fontWeight: "700", marginTop: space.sm },
  row: { gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  endpoint: { ...text.caption, fontFamily: MONO, color: colors.ink },
  tag: { ...text.caption, fontWeight: "700", color: colors.green, borderWidth: 1, borderColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 8 },
  tagOk: { color: colors.green, borderColor: colors.green },
  tagErr: { color: colors.danger, borderColor: colors.danger },
  tagLive: { color: colors.amber, borderColor: colors.amber },
});
