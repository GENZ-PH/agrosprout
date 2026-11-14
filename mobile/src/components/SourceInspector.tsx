import { useEffect, useSyncExternalStore } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EXPLAINERS, fill } from "../content/explainers";
import { METHODS_ON, SOURCE_DETAILS } from "../content/source-details";
import { SOURCES } from "../content/sources";
import { getCalls, subscribeCalls } from "../net/call-log";
import { Icon } from "./Icon";
import { closeInspector, getInspector, subscribeInspector } from "./inspector-store";
import { useLayout } from "./useLayout";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// The inspector: one panel for the whole app, opened by clicking a NASA SourceChip. On a wide
// screen it docks on the right and pushes the page narrower; on a phone it is a sheet from the
// bottom. Non-NASA sources never open it. It shows the source, the variables taken, how the app uses them, the formulas as
// the code computes them, the cards that use it, and this session's requests to it.

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SFMono-Regular, Menlo, monospace" });

function useInspectorState() {
  const state = useSyncExternalStore(subscribeInspector, getInspector, getInspector);
  useEffect(() => {
    if (Platform.OS !== "web" || !state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeInspector();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);
  return state;
}

/**
 * Wide screens: the panel docks beside the page and pushes it narrower (the root layout puts
 * this in a row next to the screens). Nothing shows until a NASA source is clicked.
 */
export function DockedInspector() {
  const state = useInspectorState();
  const { wide } = useLayout();
  if (!wide || !state) return null;
  return (
    <View style={styles.dock} accessibilityLabel="NASA data inspector">
      <InspectorBody k={state.key} period={state.period} />
    </View>
  );
}

/** Phones: the same panel as a sheet from the bottom. */
export function SheetInspector() {
  const state = useInspectorState();
  const { wide } = useLayout();
  if (wide || !state) return null;
  return (
    <Modal transparent animationType="slide" visible onRequestClose={closeInspector}>
      <Pressable style={styles.scrim} onPress={closeInspector} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <InspectorBody k={state.key} period={state.period} />
      </View>
    </Modal>
  );
}

export function InspectorBody({ k, period }: { k: keyof typeof SOURCES; period: string }) {
  const s = SOURCES[k];
  const d = SOURCE_DETAILS[k];
  const calls = useSyncExternalStore(subscribeCalls, getCalls, getCalls).filter((c) => c.source === k);
  // On the sample farm every NASA POWER chip shows the daily data (SourceChip.tsx), so the daily
  // source is "seen" wherever NASA POWER is.
  const usedIn = Object.values(EXPLAINERS).filter((e) => e.sources.includes(k) || (k === "power-daily" && e.sources.includes("power")));
  const methods = (METHODS_ON[k] ?? []).map((key) => ({ key, src: SOURCES[key], det: SOURCE_DETAILS[key] }));
  const years = fill(s.years, { period: period || "the years of the lot's data" });
  return (
    <>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.tag}>NASA data</Text>
          <Text style={text.heading} accessibilityRole="header">
            {s.name}
          </Text>
          <Text style={[text.small, styles.muted]}>{s.by}</Text>
        </View>
        <Pressable onPress={closeInspector} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={text.body}>{`${s.gives}. ${s.scale}, ${years}.`}</Text>

        {d?.variables?.length ? (
          <Section title="What the app takes from it">
            {d.variables.map((v) => (
              <View key={v.code} style={styles.varRow}>
                <Text style={styles.code}>{v.code}</Text>
                <Text style={[text.small, styles.flex]}>{v.meaning}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {d?.how?.length ? (
          <Section title="How the app uses it">
            {d.how.map((h) => (
              <View key={h} style={styles.bullet}>
                <Text style={text.small}>•</Text>
                <Text style={[text.small, styles.flex]}>{h}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {d?.formulas?.length ? (
          <Section title="Formulas">
            {d.formulas.map((f) => (
              <View key={f.name} style={styles.formula}>
                <Text style={[text.small, styles.strong]}>{f.name}</Text>
                {f.lines.map((l) => (
                  <Text key={l} style={styles.formulaLine}>
                    {l}
                  </Text>
                ))}
                {f.note ? <Text style={[text.caption, styles.muted]}>{f.note}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {methods.length ? (
          <Section title="Methods that use this data">
            {methods.map((m) => (
              <View key={m.key} style={styles.method}>
                <Text style={[text.small, styles.strong]}>{`${m.src.name} (${m.src.by})`}</Text>
                {m.det?.how?.[0] ? <Text style={text.small}>{m.det.how[0]}</Text> : null}
                {(m.det?.formulas ?? []).map((f) => (
                  <View key={f.name} style={styles.formula}>
                    <Text style={[text.small, styles.strong]}>{f.name}</Text>
                    {f.lines.map((l) => (
                      <Text key={l} style={styles.formulaLine}>
                        {l}
                      </Text>
                    ))}
                    {f.note ? <Text style={[text.caption, styles.muted]}>{f.note}</Text> : null}
                  </View>
                ))}
                {m.det?.cite ? <Text style={[text.caption, styles.muted]}>{m.det.cite}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {usedIn.length ? (
          <Section title="Where you see it">
            <Text style={text.small}>{usedIn.map((e) => e.title).join(", ")}</Text>
          </Section>
        ) : null}

        {calls.length ? (
          <Section title={`Requests since the app opened (${calls.length})`}>
            {calls.slice(0, 3).map((c) => (
              <View key={c.id} style={styles.call}>
                <Text style={styles.codeSmall}>{c.endpoint}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {`${c.params.map(([a, b]) => `${a}=${b}`).join(" ")}  ${c.status === "ok" ? `OK ${c.http}` : c.status === "error" ? "Failed" : "Loading"}${c.ms !== undefined ? `, ${(c.ms / 1000).toFixed(1)} s` : ""}`}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {d?.cite || d?.url ? (
          <Section title="Source">
            {d?.cite ? <Text style={[text.caption, styles.muted]}>{d.cite}</Text> : null}
            {d?.url ? (
              <Pressable onPress={() => void Linking.openURL(d.url as string)} accessibilityRole="link">
                <Text style={styles.link}>{d.url}</Text>
              </Pressable>
            ) : null}
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={text.bodyStrong}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { width: 420, flexShrink: 0, backgroundColor: colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { maxHeight: "82%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, padding: space.lg, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1, minWidth: 0 },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, marginRight: -space.sm, marginTop: -space.xs },
  pressed: { backgroundColor: colors.pressed },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: space.lg, gap: space.lg },
  muted: { color: colors.muted },
  strong: { fontWeight: "700" },
  tag: { ...text.caption, fontWeight: "700", color: colors.green, alignSelf: "flex-start", marginBottom: 4 },
  section: { gap: space.xs },
  varRow: { flexDirection: "row", gap: space.sm, alignItems: "baseline" },
  code: { fontFamily: MONO, fontSize: 12, color: colors.ink, minWidth: 140 },
  codeSmall: { fontFamily: MONO, fontSize: 12, color: colors.ink },
  bullet: { flexDirection: "row", gap: space.sm },
  formula: { gap: 4, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.md, borderWidth: 1, borderColor: colors.border },
  formulaLine: { fontFamily: MONO, fontSize: 12, lineHeight: 18, color: colors.ink },
  call: { gap: 2 },
  method: { gap: space.xs, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  link: { ...text.small, color: colors.blue, textDecorationLine: "underline" },
});
