import { type ComponentRef, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { RotationOption } from "../engine/rotations";
import { useT } from "../i18n/lang-store";
import { cropLabel } from "../i18n/strings";
import type { Crop } from "../types";
import { familyStyle } from "./field-year-core";
import { Icon, type IconName } from "./Icon";
import { listText } from "./plan-text";
import { planReasons, type Reason } from "./plan-facts";
import { monthStates, nowSummary, type MonthRisk } from "./season-guide-core";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// The farmer's season guide (plant view): a wall calendar, not a report. It answers "what do I
// do now?" first, then shows the year month by month, why this way, a checklist before planting,
// and the other ways to farm the lot named by their crops. Scores and the NASA evidence live in
// the "Why: the NASA data" view; nothing here is a number the engine did not produce.

type Props = {
  options: readonly RotationOption[];
  selected: RotationOption;
  onSelect: (key: RotationOption["key"]) => void;
  lotName: string;
  cropById: (id: string) => Crop | undefined;
  /** Opens the evidence view. */
  onEvidence: () => void;
  /** Show the El Niño reminder (bundled PAGASA advisory). */
  elNino?: boolean;
  wide?: boolean;
};

const TILE_W = 58;
const RISK_ICON: Record<MonthRisk, IconName> = { dry: "sun", hot: "heat", wet: "drop" };
const RISK_COLOR: Record<MonthRisk, string> = { dry: "#B5641B", hot: "#B3261E", wet: "#1D5FA8" };

export function SeasonGuide({ options, selected, onSelect, lotName, cropById, onEvidence, elNino, wide }: Props) {
  const { t, lang, months } = useT();
  const nowMonth = new Date().getMonth() + 1;
  const [picked, setPicked] = useState<number>(nowMonth);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const stripRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // Phone: open the month strip on this month, with the month before it still in sight.
  const showNow = () => stripRef.current?.scrollTo({ x: Math.max(0, (nowMonth - 2) * (TILE_W + 6)), animated: false });
  const name = (id: string) => cropLabel(lang, cropById(id), id);
  const names = (ids: readonly string[]) => listText(ids.map(name), t);
  const states = useMemo(() => monthStates(selected), [selected]);
  const now = useMemo(() => nowSummary(selected, nowMonth), [selected, nowMonth]);
  const baseline = options[0];
  const { gains, watch } = planReasons(selected, baseline, (id) => !!cropById(id)?.n_fixing);
  const month = states[picked - 1];

  // The hero: the one or two things to do this month, then what comes next.
  const heroLines: { icon: IconName; text: string; crop?: string }[] = [
    ...now.plant.map((id) => ({ icon: "sprout" as IconName, text: t("guide.plant", { crop: name(id) }), crop: id })),
    ...now.harvest.map((id) => ({ icon: "basket" as IconName, text: t("guide.harvest", { crop: name(id) }), crop: id })),
    ...now.growing.map((g) => ({ icon: "sprout" as IconName, text: t("guide.growing", { crop: name(g.crop_id), month: months[g.harvest_month - 1] }), crop: g.crop_id })),
  ];
  if (heroLines.length === 0) heroLines.push({ icon: "clock", text: t("guide.rest") });

  const checklist = [
    ...selected.new_crop_ids.flatMap((id) => [
      { key: `seed-${id}`, text: t("guide.seed", { crop: name(id) }) },
      { key: `buyer-${id}`, text: t("guide.buyer", { crop: name(id) }) },
    ]),
    { key: "tech", text: t("guide.tech") },
  ];

  const hero = (
    <View style={styles.hero}>
      <Text style={styles.heroKicker}>{t("guide.thisMonth", { month: months[nowMonth - 1] })}</Text>
      {heroLines.map((l, i) => {
        const st = l.crop ? familyStyle(cropById(l.crop)?.family) : null;
        return (
          <View key={i} style={styles.heroLine}>
            <View style={[styles.heroIcon, { backgroundColor: st?.fill ?? colors.greenTint }]}>
              <Icon name={l.icon} size={26} color={st?.ink ?? colors.green} />
            </View>
            <Text style={[styles.heroText, i > 0 && styles.heroTextSmall]}>{l.text}</Text>
          </View>
        );
      })}
      {now.risks.map((r) => (
        <View key={r} style={styles.tip}>
          <Icon name={RISK_ICON[r]} size={20} color={RISK_COLOR[r]} />
          <Text style={[text.body, styles.flex]}>{t(`guide.${r}Tip`)}</Text>
        </View>
      ))}
      {now.next ? (
        <Text style={styles.next}>
          {now.next.inMonths === 1
            ? t("guide.nextSoon", { crop: name(now.next.crop_id) })
            : t("guide.next", { crop: name(now.next.crop_id), month: months[now.next.month - 1] })}
        </Text>
      ) : null}
      {elNino ? (
        <View style={styles.elnino}>
          <Icon name="sun" size={20} color={RISK_COLOR.dry} />
          <Text style={[text.small, styles.flex]}>{t("guide.elnino")}</Text>
        </View>
      ) : null}
    </View>
  );

  const calendar = (
    <View style={styles.block}>
      <Text style={styles.blockTitle} accessibilityRole="header">
        {t("guide.year", { lot: lotName })}
      </Text>
      <Text style={[text.small, styles.muted]}>{t("guide.tap")}</Text>
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
              accessibilityLabel={`${months[s.month - 1]}${isNow ? `, ${t("guide.now")}` : ""}`}
              style={[styles.tile, wide && styles.tileWide, on && styles.tileOn, isNow && !on && styles.tileNow]}
            >
              <Text style={[styles.tileMonth, on && styles.tileMonthOn]}>{months[s.month - 1]}</Text>
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
              {isNow ? <Text style={[styles.nowTag, on && styles.tileMonthOn]}>{t("guide.now")}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.monthDetail} accessibilityLiveRegion="polite">
        <Text style={text.bodyStrong}>{months[picked - 1]}</Text>
        {month.plant.length ? <DetailLine icon="sprout" color={colors.green} text={t("guide.monthPlant", { crops: names(month.plant) })} /> : null}
        {month.harvest.length ? <DetailLine icon="basket" color={colors.green} text={t("guide.monthHarvest", { crops: names(month.harvest) })} /> : null}
        {month.field.filter((id) => !month.plant.includes(id) && !month.harvest.includes(id)).length ? (
          <DetailLine
            icon="check"
            color={colors.muted}
            text={t("guide.monthGrow", { crops: names(month.field.filter((id) => !month.plant.includes(id) && !month.harvest.includes(id))) })}
          />
        ) : null}
        {month.field.length === 0 ? <DetailLine icon="alert" color={colors.amber} text={t("guide.monthRest")} /> : null}
        {month.risks.map((r) => (
          <DetailLine key={r} icon={RISK_ICON[r]} color={RISK_COLOR[r]} text={t(`guide.${r}Tip`)} />
        ))}
      </View>
    </View>
  );

  const why =
    gains.length + watch.length > 0 ? (
      <View style={styles.block}>
        <Text style={styles.blockTitle} accessibilityRole="header">
          {t("guide.why")}
        </Text>
        <View style={styles.whyGrid}>
          {gains.map((r, i) => (
            <View key={`g${i}`} style={[styles.whyTile, wide && styles.whyTileWide]}>
              <Icon name="check" size={22} color={colors.green} />
              <Text style={[text.body, styles.flex]}>{reasonText(r, t, name)}</Text>
            </View>
          ))}
          {watch.map((r, i) => (
            <View key={`w${i}`} style={[styles.whyTile, styles.whyWatch, wide && styles.whyTileWide]}>
              <Icon name="alert" size={22} color={colors.amber} />
              <Text style={[text.body, styles.flex]}>{reasonText(r, t, name)}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null;

  const before = (
    <View style={styles.block}>
      <Text style={styles.blockTitle} accessibilityRole="header">
        {t("guide.before")}
      </Text>
      {checklist.map((c) => {
        const on = !!done[c.key];
        return (
          <Pressable
            key={c.key}
            onPress={() => setDone((d) => ({ ...d, [c.key]: !on }))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={styles.check}
          >
            <View style={[styles.checkBox, on && styles.checkBoxOn]}>{on ? <Icon name="check" size={18} color={colors.white} /> : null}</View>
            <Text style={[text.body, styles.flex, on && styles.checkDone]}>{c.text}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const ways = (
    <View style={styles.block}>
      <Text style={styles.blockTitle} accessibilityRole="header">
        {t("guide.ways")}
      </Text>
      <Text style={[text.small, styles.muted]}>{t("guide.waysHint")}</Text>
      <View style={styles.ways}>
        {options.map((o, i) => {
          const on = o.key === selected.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.way, on && styles.wayOn]}
            >
              <View style={styles.wayCrops}>
                {o.slots.map((s, j) => {
                  const st = familyStyle(cropById(s.crop_id)?.family);
                  return <View key={j} style={[styles.dot, { backgroundColor: st.fill }]} />;
                })}
              </View>
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{names([...new Set(o.slots.map((s) => s.crop_id))])}</Text>
                <Text style={[text.small, styles.muted]}>
                  {t("guide.wayMonths", { months: listText([...o.slots].sort((a, b) => a.plant_month - b.plant_month).map((s) => months[s.plant_month - 1]), t) })}
                </Text>
              </View>
              {i === 0 ? <Text style={styles.wayTag}>{t("guide.yours")}</Text> : null}
              {o.top_total && i !== 0 ? <Text style={[styles.wayTag, styles.wayBest]}>{t("guide.bestFit")}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onEvidence} accessibilityRole="link" style={styles.evidence}>
        <Text style={styles.evidenceText}>{t("guide.evidence")}</Text>
        <Icon name="chevron" size={18} color={colors.green} />
      </Pressable>
    </View>
  );

  if (wide) {
    return (
      <View style={styles.gap}>
        <View style={styles.row}>
          <View style={[styles.col, styles.colHero]}>{hero}</View>
          <View style={styles.col}>{ways}</View>
        </View>
        {calendar}
        <View style={styles.row}>
          <View style={styles.col}>{why}</View>
          <View style={styles.col}>{before}</View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.gap}>
      {hero}
      {calendar}
      {why}
      {before}
      {ways}
    </View>
  );
}

function reasonText(r: Reason, t: ReturnType<typeof useT>["t"], name: (id: string) => string): string {
  switch (r.key) {
    case "reason.legume":
      return t(r.key, { crop: name(r.crop_id) });
    case "reason.families":
      return t(r.key, { n: r.n, base: r.base });
    default:
      return t(r.key, { n: r.n });
  }
}

function DetailLine({ icon, color, text: body }: { icon: IconName; color: string; text: string }) {
  return (
    <View style={styles.detailLine}>
      <Icon name={icon} size={18} color={color} />
      <Text style={[text.body, styles.flex]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  row: { flexDirection: "row", gap: space.lg, alignItems: "flex-start" },
  col: { flex: 1, minWidth: 0, gap: space.lg },
  colHero: { flex: 1.2 },
  flex: { flex: 1 },
  muted: { color: colors.muted },

  hero: { backgroundColor: "#1F4D33", borderRadius: radius.lg, padding: space.lg, gap: space.md },
  heroKicker: { ...text.small, color: "#CFE3D4", fontWeight: "700" },
  heroLine: { flexDirection: "row", alignItems: "center", gap: space.md },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  heroText: { flex: 1, fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.white },
  heroTextSmall: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  tip: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "#FBF3E6", borderRadius: radius.md, padding: space.sm },
  next: { ...text.body, color: "#E4F0E7" },
  elnino: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "#FBF3E6", borderRadius: radius.md, padding: space.sm },

  block: { gap: space.sm },
  blockTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: colors.ink },

  strip: { gap: 6, paddingVertical: 2, flexGrow: 1 },
  stripWide: { flexDirection: "row" },
  tile: {
    width: TILE_W,
    minHeight: 112,
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
  nowTag: { fontSize: 11, fontWeight: "800", color: colors.green },
  monthDetail: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 },
  detailLine: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },

  whyGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  whyTile: { flexBasis: "100%", flexDirection: "row", alignItems: "flex-start", gap: space.sm, backgroundColor: colors.greenTint, borderRadius: radius.md, padding: space.md },
  whyTileWide: { flexBasis: "100%" },
  whyWatch: { backgroundColor: colors.amberTint },

  check: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: MIN_TOUCH },
  checkBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.green, alignItems: "center", justifyContent: "center" },
  checkBoxOn: { backgroundColor: colors.green },
  checkDone: { color: colors.muted, textDecorationLine: "line-through" },

  ways: { gap: space.sm },
  way: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TOUCH + 8,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  wayOn: { borderColor: colors.green, borderWidth: 2, backgroundColor: "#F1F6EF" },
  wayCrops: { flexDirection: "row", gap: 3 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  wayTag: { ...text.caption, color: colors.muted, fontWeight: "700" },
  wayBest: { color: colors.green },
  evidence: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: MIN_TOUCH },
  evidenceText: { ...text.bodyStrong, color: colors.green },
});
