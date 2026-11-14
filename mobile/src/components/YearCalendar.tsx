import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { RotationOption } from "../engine/rotations";
import { monthLong } from "../lots/months-core";
import type { Crop } from "../types";
import { familyStyle, MONTH_NAMES } from "./field-year-core";
import { Icon, type IconName } from "./Icon";
import { ExplainerBox } from "./InfoCard";
import { monthStates, type MonthRisk } from "./season-guide-core";
import { OPTION_LABELS } from "./soil-health-chart-core";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";
import { useLayout } from "./useLayout";
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
};

const TILE_W = 58;
const RISK_ICON: Record<MonthRisk, IconName> = { dry: "sun", hot: "heat", wet: "drop" };
const RISK_COLOR: Record<MonthRisk, string> = { dry: "#B5641B", hot: "#B3261E", wet: "#1D5FA8" };

export function YearCalendar({ options, lotName, cropById, period, initialKey }: Props) {
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
  // Phone: open the strip on this month, with the month before it still in sight.
  const showNow = () => stripRef.current?.scrollTo({ x: Math.max(0, (nowMonth - 2) * (TILE_W + 6)), animated: false });

  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Text style={[styles.blockTitle, styles.flex]} accessibilityRole="header">
          {`Your year on ${lotName}`}
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
      <Text style={[text.small, styles.muted]}>Tap a month to see what to do.</Text>

      <ScrollView
        ref={stripRef}
        horizontal={!wide}
        onLayout={wide ? undefined : showNow}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.strip, wide && styles.stripWide]}
      >
        {states.map((s) => {
          const on = s.month === picked;
          const isNow = s.month === nowMonth;
          return (
            <Pressable
              key={s.month}
              onPress={() => setPicked(s.month)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tileLabel(s, monthLong(s.month), name, isNow)}
              style={[styles.tile, wide && styles.tileWide, on && styles.tileOn, isNow && !on && styles.tileNow]}
            >
              <Text style={[styles.tileMonth, on && styles.tileMonthOn]}>{MONTH_NAMES[s.month - 1]}</Text>
              <View style={styles.tileRisk}>
                {s.risks.map((r) => (
                  <Icon key={r} name={RISK_ICON[r]} size={16} color={on ? colors.white : RISK_COLOR[r]} />
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
              {isNow ? <Text style={[styles.nowTag, on && styles.tileMonthOn]}>Now</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.detail} accessibilityLiveRegion="polite">
        <Text style={text.bodyStrong}>{MONTH_NAMES[picked - 1]}</Text>
        {lines.map((l) => (
          <View key={l.text} style={styles.line}>
            <Icon name={l.icon} size={18} color={toneColor(l.tone)} />
            <Text style={[text.body, styles.flex]}>{l.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plans} accessibilityRole="radiogroup" accessibilityLabel="Plan to show">
        <Text style={[text.small, styles.muted]}>Showing the year for</Text>
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
  plans: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, paddingTop: space.sm },
  plan: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  planOn: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.greenTint },
  planTextOn: { color: colors.green, fontWeight: "700" },
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
  tileOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tileNow: { borderColor: colors.green, borderWidth: 2 },
  tileMonth: { fontSize: 15, fontWeight: "800", color: colors.ink },
  tileMonthOn: { color: colors.white },
  tileRisk: { flexDirection: "row", gap: 2, minHeight: 16 },
  tileBands: { alignSelf: "stretch", gap: 3 },
  band: { height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  bandEmpty: { backgroundColor: "#E9E3D6", borderWidth: 1, borderStyle: "dashed", borderColor: "#B9AE97" },
  nowTag: { fontSize: 12, fontWeight: "800", color: colors.green },
  detail: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
});
