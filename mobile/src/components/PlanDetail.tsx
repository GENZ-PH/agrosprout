import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Explanation } from "../engine/explain";
import type { RotationOption } from "../engine/rotations";
import { COMPONENT_KEYS, type ComponentKey } from "../engine/scores";
import { useT } from "../i18n/lang-store";
import { cropLabel } from "../i18n/strings";
import type { Crop } from "../types";
import { bareText, monthsText, planName } from "./field-year-core";
import { Icon } from "./Icon";
import { mergeCropLines } from "./plan-text";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// One plan, in two layers. First the short farmer view in the chosen language: the crops and
// months, what gets better and worse against the farmer's own crops, when the field is empty
// or short of water, and what to ask the technician. Then, on request, the engine's full
// explanation (engine/explain.ts, in English): why, benefits, trade-offs, gaps, local checks
// and every source.

type Props = {
  option: RotationOption;
  /** Plan A, the farmer's own crops: the baseline every score is compared with. */
  baseline: RotationOption;
  explanation: Explanation | undefined;
  leftOut: readonly ComponentKey[];
  cropById: (id: string) => Crop | undefined;
  /** Show the full explanation from the start (wide screens). */
  defaultOpen?: boolean;
};

export function PlanDetail({ option, baseline, explanation, leftOut, cropById, defaultOpen = false }: Props) {
  const { t, lang, months } = useT();
  const [open, setOpen] = useState(defaultOpen);
  const isBaseline = option.key === baseline.key;
  const dry = option.water_fit_range.p20;
  const wet = option.water_fit_range.p80;
  const crop = (id: string) => cropLabel(lang, cropById(id), id);

  const rows = COMPONENT_KEYS.filter((k) => !leftOut.includes(k)).map((k) => {
    const v = option.scores[k];
    const base = baseline.scores[k];
    return { k, v, base, delta: !isBaseline && v !== null && base !== null ? Math.round(v - base) : 0 };
  });
  const better = rows.filter((r) => r.delta > 0);
  const worse = rows.filter((r) => r.delta < 0);
  const same = rows.filter((r) => r.delta === 0);

  const bar = (r: (typeof rows)[number]) => (
    <View key={r.k} style={styles.barRow} accessible accessibilityLabel={`${t(`comp.${r.k}`)}: ${r.v === null ? "?" : Math.round(r.v)} ${t("detail.outOf")}`}>
      <Text style={styles.barLabel}>{t(`comp.${r.k}`)}</Text>
      <View style={styles.track}>
        {r.v !== null ? <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, r.v))}%` }]} /> : null}
        {!isBaseline && r.base !== null ? <View style={[styles.baseMark, { left: `${Math.min(100, r.base)}%` }]} /> : null}
      </View>
      <Text style={styles.barValue}>{r.v === null ? "?" : Math.round(r.v)}</Text>
      <Text style={[styles.delta, r.delta > 0 && styles.up, r.delta < 0 && styles.down]}>
        {r.delta === 0 ? "" : r.delta > 0 ? `+${r.delta}` : `${r.delta}`}
      </Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={text.caption}>{t("plan.label", { key: option.key })}</Text>
          <Text style={text.title} accessibilityRole="header">
            {planName(option.kind, t)}
          </Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalNumber}>{option.total === null ? "?" : Math.round(option.total)}</Text>
          <Text style={text.caption}>{t("detail.outOf")}</Text>
        </View>
      </View>

      <View style={styles.sequence}>
        {option.slots.map((s, i) => (
          <Text key={i} style={text.body}>
            <Text style={text.bodyStrong}>{crop(s.crop_id)}</Text>
            {`  ${t("detail.slot", { plant: months[s.plant_month - 1], harvest: months[s.harvest_month - 1] })}`}
            {option.new_crop_ids.includes(s.crop_id) ? `  (${t("detail.new")})` : ""}
          </Text>
        ))}
      </View>

      {isBaseline ? <Text style={text.small}>{t("detail.yours")}</Text> : null}

      {better.length > 0 ? (
        <View style={styles.bars}>
          <Text style={[text.bodyStrong, styles.up]}>{t("detail.gain")}</Text>
          {better.map(bar)}
        </View>
      ) : null}
      {worse.length > 0 ? (
        <View style={styles.bars}>
          <Text style={[text.bodyStrong, styles.down]}>{t("detail.lose")}</Text>
          {worse.map(bar)}
        </View>
      ) : null}
      {same.length > 0 ? <View style={styles.bars}>{same.map(bar)}</View> : null}

      {!isBaseline ? <Text style={text.caption}>{t("detail.marker")}</Text> : null}

      <View style={styles.facts}>
        <Text style={text.small}>
          {isBaseline
            ? `${bareText(option.metrics, t, months)}.`
            : t("detail.empty", { days: option.metrics.bare_days, base: baseline.metrics.bare_days })}
        </Text>
        {dry !== null && wet !== null ? <Text style={text.small}>{t("detail.waterRange", { dry: Math.round(dry), wet: Math.round(wet) })}</Text> : null}
        {option.metrics.stress_months.length > 0 ? (
          <Text style={text.small}>{t("detail.stress", { months: monthsText(option.metrics.stress_months, t, months) })}</Text>
        ) : null}
      </View>

      <View style={styles.ask}>
        <Text style={text.bodyStrong}>{t("detail.ask")}</Text>
        {option.new_crop_ids.map((id) => (
          <Text key={id} style={text.small}>
            {t("detail.askNew", { crop: crop(id) })}
          </Text>
        ))}
        <Text style={text.small}>{t("detail.askConfirm")}</Text>
      </View>

      <View style={styles.unknown}>
        <Text style={text.bodyStrong}>{t("detail.unknown")}</Text>
        <Text style={text.small}>{t("detail.unknownYear")}</Text>
        <Text style={text.small}>{t("year.source")}</Text>
        {option.assumed_calendar ? <Text style={text.small}>{t("year.assumed")}</Text> : null}
        {leftOut.length > 0 ? <Text style={text.small}>{t("detail.leftOut", { list: leftOut.map((k) => t(`comp.${k}`)).join(", ") })}</Text> : null}
      </View>

      {explanation ? (
        <>
          <View style={styles.confidence}>
            <Text style={text.bodyStrong}>{t("conf.title", { level: t(`conf.${explanation.confidence.level}`) })}</Text>
            {explanation.confidence.reasons.map((r) => (
              <Text key={r} style={text.small}>
                {t(`conf.${r}`)}
              </Text>
            ))}
          </View>

          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => [styles.moreToggle, pressed && styles.pressed]}
          >
            <Text style={styles.moreLabel}>{open ? t("detail.moreHide") : t("detail.moreShow")}</Text>
            <View style={open ? styles.chevUp : styles.chevDown}>
              <Icon name="chevron" size={20} color={colors.green} />
            </View>
          </Pressable>
          {open ? (
            <View style={styles.more}>
              <Section title={isBaseline ? "About this plan" : "Why this plan"} lines={explanation.why} />
              <Section title="What you gain" lines={explanation.benefits} tone="up" />
              <Section title="What you give up" lines={explanation.tradeoffs} tone="down" />
              <Section title="What we do not know" lines={mergeCropLines(explanation.unknowns)} />
              <Section title="Check with your technician" lines={explanation.check_locally} />
              <Section title={`Where these numbers come from (${explanation.evidence.length} sources)`} lines={explanation.evidence} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Section({ title, lines, tone }: { title: string; lines: readonly { code: string; text: string }[]; tone?: "up" | "down" }) {
  if (lines.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={text.bodyStrong}>{title}</Text>
      {lines.map((l) => (
        <View key={l.code} style={styles.line}>
          <View style={[styles.bullet, tone === "up" && styles.bulletUp, tone === "down" && styles.bulletDown]} />
          <Text style={styles.lineText}>{l.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.lg },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  headText: { flex: 1, gap: 2 },
  total: { alignItems: "flex-end" },
  totalNumber: { fontSize: 40, lineHeight: 42, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  sequence: { gap: 4, paddingLeft: space.md, borderLeftWidth: 3, borderLeftColor: colors.green },
  bars: { gap: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  barLabel: { ...text.small, width: 164 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bg, justifyContent: "center" },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.green },
  baseMark: { position: "absolute", top: -4, width: 2, height: 18, marginLeft: -1, backgroundColor: colors.ink },
  barValue: { ...text.small, width: 28, textAlign: "right", fontWeight: "600", fontVariant: ["tabular-nums"] },
  delta: { ...text.caption, width: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
  up: { color: colors.green, fontWeight: "700" },
  down: { color: colors.danger, fontWeight: "700" },
  unknown: { gap: 4 },
  facts: { gap: 4 },
  ask: { gap: 6, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.amberTint },
  section: { gap: 6 },
  line: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.dashed },
  bulletUp: { backgroundColor: colors.green },
  bulletDown: { backgroundColor: colors.danger },
  lineText: { ...text.small, flex: 1 },
  confidence: { gap: 4, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.bg },
  moreToggle: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  pressed: { backgroundColor: colors.pressed },
  moreLabel: { ...text.bodyStrong, color: colors.green, flex: 1 },
  chevDown: { transform: [{ rotate: "90deg" }] },
  chevUp: { transform: [{ rotate: "-90deg" }] },
  more: { gap: space.lg },
});
