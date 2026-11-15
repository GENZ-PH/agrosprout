import { useEffect, useState, useSyncExternalStore } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EXPLAINERS, fill } from "../content/explainers";
import { METHODS_ON, SOURCE_DETAILS } from "../content/source-details";
import { SOURCES } from "../content/sources";
import { getCalls, subscribeCalls } from "../net/call-log";
import { Icon } from "./Icon";
import { router } from "expo-router";

import {
  closeInspector,
  getInspector,
  getPanelContext,
  openInspector,
  openOverview,
  type PanelContext,
  subscribeInspector,
} from "./inspector-store";
import { clampDock, saveDockWidth, setDockWidth, useDockWidth } from "./dock-width";
import { canDock } from "./layout-core";
import { useLayout } from "./useLayout";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// The inspector: one panel for the whole app, opened by clicking a NASA SourceChip. On a wide
// screen it docks on the right and pushes the page narrower; on a phone it is a sheet from the
// bottom. Non-NASA sources never open it. It shows the source, the variables taken, how the app uses them, the formulas as
// the code computes them, the cards that use it, and this session's requests to it.

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SFMono-Regular, Menlo, monospace" });

function useInspectorState() {
  const state = useSyncExternalStore(subscribeInspector, getInspector, getInspector);
  const context = useSyncExternalStore(subscribeInspector, getPanelContext, getPanelContext);
  useEffect(() => {
    if (Platform.OS !== "web" || !state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeInspector();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);
  // The overview needs a lot to describe: without one (another screen), nothing shows.
  if (state?.view === "overview" && !context) return { state: null, context };
  return { state, context };
}

/** The panel's content for the current state. */
function PanelBody({ state, context }: { state: NonNullable<ReturnType<typeof getInspector>>; context: PanelContext | null }) {
  return state.view === "overview" && context ? (
    <OverviewBody c={context} />
  ) : state.view === "source" ? (
    <InspectorBody k={state.key} period={state.period} onBack={context ? openOverview : undefined} />
  ) : null;
}

export { canDock };

/**
 * Wide screens: the panel docks beside the page and pushes it narrower (the root layout puts
 * this in a row next to the screens). Nothing shows until a NASA source is clicked.
 */
export function DockedInspector() {
  const { state, context } = useInspectorState();
  const { width } = useLayout();
  const dock = useDockWidth(width);
  if (!canDock(width) || !state) return null;
  return (
    <View style={[styles.dock, { width: dock }]} accessibilityLabel="NASA data panel">
      <DockHandle windowWidth={width} current={dock} />
      <PanelBody state={state} context={context} />
    </View>
  );
}

/**
 * The drag handle on the panel's left edge (web, mouse or touch): drag to make the panel wider or
 * narrower. The width is kept on the device. Arrow keys work too when the handle has focus.
 */
function DockHandle({ windowWidth, current }: { windowWidth: number; current: number }) {
  const [active, setActive] = useState(false);
  if (Platform.OS !== "web") return null;
  const start = (e: { nativeEvent: { pageX: number }; preventDefault?: () => void }) => {
    e.preventDefault?.();
    setActive(true);
    const move = (ev: PointerEvent) => setDockWidth(clampDock(windowWidth - ev.clientX, windowWidth));
    const up = () => {
      setActive(false);
      saveDockWidth();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <View
      // react-native-web passes pointer and key events through to the element.
      {...({
        onPointerDown: start,
        onKeyDown: (e: { nativeEvent: { key: string } }) => {
          const k = e.nativeEvent.key;
          if (k !== "ArrowLeft" && k !== "ArrowRight") return;
          setDockWidth(clampDock(current + (k === "ArrowLeft" ? 40 : -40), windowWidth));
          saveDockWidth();
        },
        tabIndex: 0,
      } as object)}
      accessibilityRole="adjustable"
      accessibilityLabel="Drag to resize the NASA data panel"
      style={[styles.handle, active && styles.handleActive]}
    >
      <View style={styles.grip} />
    </View>
  );
}

/** Phones: the same panel as a sheet from the bottom. */
export function SheetInspector() {
  const { state, context } = useInspectorState();
  const { width } = useLayout();
  if (canDock(width) || !state) return null;
  return (
    <Modal transparent animationType="slide" visible onRequestClose={closeInspector}>
      <Pressable style={styles.scrim} onPress={closeInspector} accessibilityLabel="Close" />
      <View style={[styles.sheet, state.view === "overview" && styles.sheetTall]}>
        <PanelBody state={state} context={context} />
      </View>
    </Modal>
  );
}

export function InspectorBody({ k, period, onBack }: { k: keyof typeof SOURCES; period: string; onBack?: () => void }) {
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
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="All NASA data" style={({ pressed }) => [styles.close, styles.back, pressed && styles.pressed]}>
            <Icon name="back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
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
  handle: { position: "absolute", left: -5, top: 0, bottom: 0, width: 10, zIndex: 5, alignItems: "center", justifyContent: "center", cursor: "col-resize" } as object,
  handleActive: { backgroundColor: colors.greenTint },
  grip: { width: 4, height: 40, borderRadius: 2, backgroundColor: colors.borderStrong },
  dock: { flexShrink: 0, backgroundColor: colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheetTall: { height: "88%", maxHeight: "88%" },
  back: { marginLeft: -space.sm, marginRight: 0 },
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
  /** A 44 dp tap target around the one-line link (#45). */
  linkRow: { minHeight: MIN_TOUCH, justifyContent: "center" },
});

// ---------------------------------------------------------------------------
// Overview (#165): all NASA data behind the lot on the dashboard, laid out the way the challenge
// asks (NASA data, the patterns it checks, how it becomes advice, its limits). Every line names
// what the app really does (see docs/submission/fields.md "NASA Data" and engine/scores.ts).

/** Weather patterns the app checks, where the farmer sees each one, and the NASA variables behind it. */
const CHECKS: readonly { what: string; where: string; vars: string }[] = [
  { what: "Rain and dry months", where: "Fits your rain, dry months, the year calendar", vars: "NASA POWER PRECTOTCORR" },
  {
    what: "Crop water need (evaporation)",
    where: "FAO-56 Penman-Monteith, month by month for each crop",
    vars: "NASA POWER T2M, T2M_RANGE, RH2M, WS2M, ALLSKY_SFC_SW_DWN",
  },
  { what: "Heat", where: "Weather safety: months too hot for the crop (FAO Ecocrop ranges)", vars: "NASA POWER T2M, T2M_RANGE" },
  { what: "Wet soil and waterlogging", where: "Weather safety: waterlogging risk", vars: "NASA POWER GWETROOT" },
  { what: "Heavy rain", where: "Protects from washout (rain on bare soil), harvest in a heavy-rain month", vars: "NASA POWER PRECTOTCORR" },
  { what: "Dry, typical and wet years", where: "Each result in a dry (20th percentile), typical and wet (80th) year; the drier or warmer what-if", vars: "NASA POWER, every year in the record" },
];

export function OverviewBody({ c }: { c: PanelContext }) {
  const steps = [
    `NASA POWER gives the weather at your lot for ${c.period || "the years of the lot's data"}${c.demo ? "" : ", asked for the lot's center rounded to 0.1°"}.`,
    "The app works out each crop's water need month by month (FAO-56) and how much of it rain covers in a dry, typical and wet year.",
    "It builds your crops (A) and three other plans (B to D), and scores each on eight things: fits your rain, weather safety, builds soil, protects from washout, breaks pest cycles, income, easy to get to market and easy to manage.",
    "What matters to you sets the weights. Each plan lists why, the evidence, the benefits, the trade-offs, what is not known and what to check with your agricultural technician.",
  ];
  return (
    <>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.tag}>NASA data</Text>
          <Text style={text.heading} accessibilityRole="header">
            The data behind {c.lotName}
          </Text>
          <Text style={[text.small, styles.muted]}>For agricultural technicians and anyone who wants the details.</Text>
        </View>
        <Pressable onPress={closeInspector} accessibilityRole="button" accessibilityLabel="Close NASA data" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {c.details}
        <Section title="NASA datasets used">
          {c.sources.map((k) => {
            const s = SOURCES[k];
            return (
              <Pressable
                key={k}
                onPress={() => openInspector(k, c.period)}
                accessibilityRole="button"
                accessibilityLabel={`${s.name}: details`}
                style={({ pressed }) => [overview.dataset, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={[text.small, styles.strong]}>{s.name}</Text>
                  <Text style={text.small}>{s.gives}</Text>
                  <Text style={[text.caption, styles.muted]}>{`${s.scale}, ${fill(s.years, { period: c.period || "the years of the lot's data" })}`}</Text>
                </View>
                <Icon name="chevron" size={18} color={colors.green} />
              </Pressable>
            );
          })}
        </Section>

        <Section title="What the data checks on your lot">
          {CHECKS.map((x) => (
            <View key={x.what} style={overview.check}>
              <Text style={[text.small, styles.strong]}>{x.what}</Text>
              <Text style={text.small}>{x.where}</Text>
              <Text style={styles.codeSmall}>{x.vars}</Text>
            </View>
          ))}
        </Section>

        <Section title="From data to advice">
          {steps.map((t, i) => (
            <View key={t} style={styles.bullet}>
              <Text style={[text.small, styles.strong]}>{i + 1}.</Text>
              <Text style={[text.small, styles.flex]}>{t}</Text>
            </View>
          ))}
        </Section>

        <Section title="Limits">
          {[
            "Past records, not a forecast.",
            "One NASA POWER cell is about 50 km wide, so your own field can be wetter, drier, warmer or cooler.",
            "Soil health is a relative indicator from this model, not a soil test.",
            "Income and labor are not scored yet: the crop list has no local prices or labor needs.",
          ].map((t) => (
            <View key={t} style={styles.bullet}>
              <Text style={text.small}>•</Text>
              <Text style={[text.small, styles.flex]}>{t}</Text>
            </View>
          ))}
          <Pressable onPress={() => router.push("/data")} accessibilityRole="link" style={styles.linkRow}>
            <Text style={styles.link}>All data sources and limits</Text>
          </Pressable>
        </Section>

        {c.extra}
      </ScrollView>
    </>
  );
}

const overview = StyleSheet.create({
  dataset: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: MIN_TOUCH,
  },
  check: { gap: 2, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.border },
});
