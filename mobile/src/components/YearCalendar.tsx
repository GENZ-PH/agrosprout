import { useContext, useMemo, useRef, useState, type ComponentRef } from "react";
import { tr, useLang } from "../i18n/lang-store";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { RotationOption } from "../engine/rotations";
import { monthLong } from "../lots/months-core";
import type { Crop, LotData } from "../types";
import { familyStyle, MONTH_NAMES } from "./field-year-core";
import { Icon } from "./Icon";
import { ExplainerBox } from "./InfoCard";
import { monthStates, RISK_COLOR, RISK_ICON } from "./season-guide-core";
import { OPTION_LABELS } from "./soil-health-chart-core";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";
import { useLayout } from "./useLayout";
import { MonthSI, yearRequests } from "./YearStrip";
import { satelliteMonthFacts } from "./satellite-facts";
import { SatelliteContext } from "./SourceChip";
import { type LineTone, tileLabel, yearCalendarLines } from "./year-calendar-core";

// "Your year on Lot 1": the plan as a wall calendar, one tile per month (what is planted or
// harvested, and the months a crop may be short of water, too hot or too wet). Tap a month for what
// to do in it. Only engine output is shown: the plan's slots and its risk months. Ported from
// preview/dashboard-ui (SeasonGuide), English only.

type Props = {
  options: readonly RotationOption[];
  lotName: string;
  cropById: (id: string) => Crop | undefined;
  /** Years of the lot's data, for the ⓘ. */
  period: string;
  /** The plan shown first (the suggested one); the farmer can switch. Defaults to their own crops. */
  initialKey?: RotationOption["key"];
  /** This lot's NASA months, for the SI note on the picked month. */
  monthly: Pick<LotData["monthly"], "precip_mm" | "et0_mm">;
  /** During a what-if the SI note waits. */
  whatIf: boolean;
};

const TILE_W = 58;

export function YearCalendar({ options, lotName, cropById, period, initialKey, monthly, whatIf }: Props) {
  const { wide } = useLayout();
  const [info, setInfo] = useState(false);
  const nowMonth = new Date().getMonth() + 1;
  const [key, setKey] = useState<RotationOption["key"]>(initialKey && options.some((o) => o.key === initialKey) ? initialKey : options[0].key);
  const [picked, setPicked] = useState(nowMonth);
  const stripRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const selected = options.find((o) => o.key === key) ?? options[0];
  const states = useMemo(() => monthStates(selected), [selected]);
  const name = (id: string) => cropById(id)?.name.replace(/\s*\(.*\)\s*$/, "").trim() || id;
  const lines = yearCalendarLines(states[picked - 1], name);
  // The tiles start at this month and run 12 months on (like the suggestion's strip), so the
  // month the farmer is in comes first on a phone, with no scrolling to find it.
  const yours = options.find((o) => o.key === "A");
  const sat = useContext(SatelliteContext);
  const lang = useLang();
  const siYear = yearRequests({ pick: selected, a: selected.key === "A" ? undefined : yours, monthly, name, satellite: (m) => satelliteMonthFacts(sat, m), lang });
  // The crops of this plan, for the legend under the tiles.
  const planCrops = [...new Set(selected.slots.map((x) => x.crop_id))];
  // Earlier and later years (2026-11-15): the window is 12 months from this month, moved a year at a
  // time up to 5 years back or ahead. The plan repeats every year; past months are dimmed.
  const [shift, setShift] = useState(0);
  const thisYear = new Date().getFullYear();
  const ordered = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const abs = thisYear * 12 + (nowMonth - 1) + shift * 12 + i;
        const nowAbs = thisYear * 12 + (nowMonth - 1);
        return { ...states[abs % 12], year: Math.floor(abs / 12), when: abs < nowAbs ? "past" : abs === nowAbs ? "now" : "ahead" };
      }),
    [states, nowMonth, shift, thisYear],
  );
  const pickedYear = ordered.find((s) => s.month === picked)?.year ?? thisYear;
  const range = `${MONTH_NAMES[ordered[0].month - 1]} ${ordered[0].year} to ${MONTH_NAMES[ordered[11].month - 1]} ${ordered[11].year}`;

  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Text style={[styles.blockTitle, styles.flex]} accessibilityRole="header">
          {tr("Your year on {name}", { name: lotName })}
        </Text>
        <Pressable
          onPress={() => setInfo((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`What am I looking at? About Your year on ${lotName}`}
          accessibilityState={{ expanded: info }}
          style={styles.info}
        >
          <Icon name="info" size={26} color={colors.green} />
        </Pressable>
      </View>
      {info ? <ExplainerBox id="year-calendar" period={period} /> : null}
      <View style={styles.plans} accessibilityRole="radiogroup" accessibilityLabel="Plan to show">
        <Text style={[text.small, styles.muted]}>{tr("Plan")}</Text>
        {options.map((o) => {
          const on = o.key === selected.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setKey(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              aria-checked={on}
              style={[styles.plan, on && styles.planOn]}
            >
              <Text style={[text.small, on && styles.planTextOn]}>{OPTION_LABELS[o.key]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[text.small, styles.muted]}>{tr("Tap a month to see what to do, and why.")}</Text>

      <View style={styles.nav}>
        <Pressable
          onPress={() => setShift((v) => Math.max(-5, v - 1))}
          disabled={shift <= -5}
          accessibilityRole="button"
          accessibilityLabel="Earlier year"
          style={[styles.navBtn, shift <= -5 && styles.navOff]}
        >
          <Icon name="back" size={18} color={colors.green} />
          <Text style={styles.navText}>{tr("Earlier")}</Text>
        </Pressable>
        <View style={[styles.flex, styles.navMid]}>
          <Text style={[text.small, styles.navRange]}>{range}</Text>
          {shift !== 0 ? (
            <Pressable onPress={() => setShift(0)} accessibilityRole="button" accessibilityLabel="Back to this year">
              <Text style={styles.navText}>{tr("Back to now")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setShift((v) => Math.min(5, v + 1))}
          disabled={shift >= 5}
          accessibilityRole="button"
          accessibilityLabel="Later year"
          style={[styles.navBtn, shift >= 5 && styles.navOff]}
        >
          <Text style={styles.navText}>{tr("Later")}</Text>
          <Icon name="chevron" size={18} color={colors.green} />
        </Pressable>
      </View>
      <ScrollView
        ref={stripRef}
        horizontal={!wide}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.strip, wide && styles.stripWide]}
      >
        {ordered.map((s) => {
          const on = s.month === picked;
          const isNow = s.when === "now";
          return (
            <Pressable
              key={s.month}
              onPress={() => setPicked(s.month)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tileLabel(s, monthLong(s.month), name, isNow)}
              style={[styles.tile, wide && styles.tileWide, on && styles.tileOn, isNow && !on && styles.tileNow, s.when === "past" && styles.tilePast]}
            >
              <Text style={[styles.tileMonth, on && styles.tileMonthOn]}>{MONTH_NAMES[s.month - 1]}</Text>
              {s.month === 1 || s === ordered[0] ? <Text style={styles.tileYear}>{s.year}</Text> : null}
              <View style={styles.tileRisk}>
                {s.risks.map((r) => (
                  <Icon key={r} name={RISK_ICON[r]} size={16} color={RISK_COLOR[r]} />
                ))}
              </View>
              <View style={styles.tileBands}>
                {s.field.length === 0 ? <View style={[styles.band, styles.bandEmpty]} /> : null}
                {s.field.map((id) => {
                  const st = familyStyle(cropById(id)?.family);
                  return (
                    <View key={id} style={[styles.band, { backgroundColor: st.fill }]}>
                      {s.plant.includes(id) ? <Icon name="sprout" size={14} color={st.ink} /> : null}
                      {s.harvest.includes(id) ? <Icon name="basket" size={14} color={st.ink} /> : null}
                    </View>
                  );
                })}
              </View>
              {isNow ? <Text style={styles.nowTag}>Now</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.legend}>
        {planCrops.map((id) => (
          <View key={id} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: familyStyle(cropById(id)?.family).fill }]} />
            <Text style={text.caption}>{name(id)}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <Icon name="sprout" size={14} color={colors.muted} />
          <Text style={text.caption}>{tr("Plant")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Icon name="basket" size={14} color={colors.muted} />
          <Text style={text.caption}>{tr("Harvest")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Icon name="sun" size={14} color={RISK_COLOR.dry} />
          <Text style={text.caption}>{tr("Short of water")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Icon name="heat" size={14} color={RISK_COLOR.hot} />
          <Text style={text.caption}>{tr("Too hot")}</Text>
        </View>
        <View style={styles.legendItem}>
          <Icon name="drop" size={14} color={RISK_COLOR.wet} />
          <Text style={text.caption}>{tr("Too wet")}</Text>
        </View>
      </View>

      <View style={styles.detail} accessibilityLiveRegion="polite">
        <Text style={text.bodyStrong}>
          {monthLong(picked)}
          {` ${pickedYear}`}
          {pickedYear === thisYear && picked === nowMonth ? " (this month)" : ""}, {OPTION_LABELS[selected.key]}
        </Text>
        {lines.map((l) => (
          <View key={l.text} style={styles.line}>
            <Icon name={l.icon} size={18} color={toneColor(l.tone)} />
            <Text style={[text.body, styles.flex]}>{l.text}</Text>
          </View>
        ))}
        <MonthSI year={siYear} month={picked - 1} whatIf={whatIf} />
      </View>
    </View>
  );
}

function toneColor(tone: LineTone): string {
  switch (tone) {
    case "risk-dry":
      return RISK_COLOR.dry;
    case "risk-hot":
      return RISK_COLOR.hot;
    case "risk-wet":
      return RISK_COLOR.wet;
    case "warn":
      return colors.amber;
    case "muted":
      return colors.muted;
    default:
      return colors.green;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: colors.muted },
  block: { gap: space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  blockTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: colors.ink },
  info: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  plans: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  plan: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  planOn: { borderColor: colors.green, backgroundColor: colors.green },
  planTextOn: { color: colors.white, fontWeight: "700" },
  strip: { gap: 6, paddingVertical: 2, flexGrow: 1 },
  stripWide: { flexDirection: "row" },
  tile: {
    width: TILE_W,
    minHeight: 112,
    minWidth: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  tileWide: { flex: 1, width: undefined },
  tileOn: { backgroundColor: colors.greenTint, borderColor: colors.green, borderWidth: 2.5 },
  tileNow: { borderColor: colors.green, borderWidth: 2 },
  tileMonth: { fontSize: 15, fontWeight: "800", color: colors.ink },
  tileMonthOn: { color: colors.green },
  tileYear: { fontSize: 11, lineHeight: 13, fontWeight: "700", color: colors.muted, marginTop: -4 },
  tilePast: { opacity: 0.6 },
  nav: { flexDirection: "row", alignItems: "center", gap: space.sm },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: MIN_TOUCH, paddingHorizontal: space.xs },
  navOff: { opacity: 0.35 },
  navText: { fontSize: 14, fontWeight: "700", color: colors.green },
  navMid: { alignItems: "center" },
  navRange: { fontWeight: "700", textAlign: "center" },
  tileRisk: { flexDirection: "row", gap: 2, minHeight: 16 },
  tileBands: { alignSelf: "stretch", gap: 3 },
  band: { height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  bandEmpty: { backgroundColor: "#E9E3D6", borderWidth: 1, borderStyle: "dashed", borderColor: "#B9AE97" },
  nowTag: { fontSize: 12, fontWeight: "800", color: colors.green },
  detail: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
});
