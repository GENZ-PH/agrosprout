import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COMPONENT_LABELS, type Explanation } from "../engine/explain";
import type { RotationOption } from "../engine/rotations";
import { COMPONENT_KEYS, type ComponentKey } from "../engine/scores";
import type { Crop } from "../types";
import { MONTH_NAMES, monthsText, PLAN_NAME, shortCropName } from "./field-year-core";
import { Icon } from "./Icon";
import { CONFIDENCE_REASON, mergeCropLines } from "./plan-text";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// Everything the challenge asks for about one plan: why it was suggested, the evidence,
// the benefits, the information gaps, and what needs local review (engine/explain.ts).

type Props = {
  option: RotationOption;
  /** Plan A, the farmer's own crops: the baseline every score is compared with. */
  baseline: RotationOption;
  explanation: Explanation | undefined;
  leftOut: readonly ComponentKey[];
  cropById: (id: string) => Crop | undefined;
};

const CONFIDENCE_WORD = { high: "High", medium: "Medium", low: "Low" } as const;

export function PlanDetail({ option, baseline, explanation, leftOut, cropById }: Props) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isBaseline = option.key === baseline.key;
  const scored = COMPONENT_KEYS.filter((k) => !leftOut.includes(k));
  const dry = option.water_fit_range.p20;
  const wet = option.water_fit_range.p80;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={text.caption}>Plan {option.key}</Text>
          <Text style={text.title} accessibilityRole="header">
            {PLAN_NAME[option.kind]}
          </Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalNumber}>{option.total === null ? "?" : Math.round(option.total)}</Text>
          <Text style={text.caption}>out of 100</Text>
        </View>
      </View>

      <View style={styles.sequence}>
        {option.slots.map((s, i) => (
          <Text key={i} style={text.body}>
            <Text style={text.bodyStrong}>{shortCropName(cropById(s.crop_id), s.crop_id)}</Text>
            {`  plant ${MONTH_NAMES[s.plant_month - 1]}, harvest ${MONTH_NAMES[s.harvest_month - 1]}`}
            {option.new_crop_ids.includes(s.crop_id) ? "  (new for this lot)" : ""}
          </Text>
        ))}
      </View>

      <View style={styles.bars}>
        {scored.map((k) => {
          const v = option.scores[k];
          const base = baseline.scores[k];
          const delta = v !== null && base !== null ? Math.round(v - base) : null;
          return (
            <View key={k} style={styles.barRow} accessible accessibilityLabel={`${COMPONENT_LABELS[k]}: ${v === null ? "no score" : Math.round(v)} out of 100`}>
              <Text style={styles.barLabel}>{COMPONENT_LABELS[k]}</Text>
              <View style={styles.track}>
                {v !== null ? <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, v))}%` }]} /> : null}
                {!isBaseline && base !== null ? <View style={[styles.baseMark, { left: `${Math.min(100, base)}%` }]} /> : null}
              </View>
              <Text style={styles.barValue}>{v === null ? "?" : Math.round(v)}</Text>
              <Text style={[styles.delta, delta !== null && delta > 0 && styles.up, delta !== null && delta < 0 && styles.down]}>
                {isBaseline || delta === null || delta === 0 ? "" : delta > 0 ? `+${delta}` : `${delta}`}
              </Text>
            </View>
          );
        })}
        {!isBaseline ? <Text style={text.caption}>The dark line on each bar is your crops now (plan A).</Text> : null}
        {leftOut.length > 0 ? (
          <Text style={text.caption}>
            Not scored on this lot yet: {leftOut.map((k) => COMPONENT_LABELS[k]).join(", ")}.
          </Text>
        ) : null}
      </View>

      {dry !== null && wet !== null ? (
        <Text style={text.small}>
          Water fit runs from <Text style={styles.strong}>{Math.round(dry)}</Text> in a dry year to{" "}
          <Text style={styles.strong}>{Math.round(wet)}</Text> in a wet year
          {option.metrics.stress_months.length > 0 ? `. Crops run short of water in ${monthsText(option.metrics.stress_months)}` : ""}.
        </Text>
      ) : null}

      {explanation ? (
        <>
          <Section title={isBaseline ? "About this plan" : "Why this plan"} lines={explanation.why} />
          <Section title="What you gain" lines={explanation.benefits} tone="up" />
          <Section title="What you give up" lines={explanation.tradeoffs} tone="down" />
          <Section title="What we do not know" lines={mergeCropLines(explanation.unknowns)} />
          <Section title="Check with your technician" lines={explanation.check_locally} />

          <View style={styles.confidence}>
            <Text style={text.bodyStrong}>Confidence: {CONFIDENCE_WORD[explanation.confidence.level]}</Text>
            {explanation.confidence.reasons.map((r) => (
              <Text key={r} style={text.small}>
                {CONFIDENCE_REASON[r]}
              </Text>
            ))}
          </View>

          <Pressable
            onPress={() => setShowEvidence((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showEvidence }}
            style={({ pressed }) => [styles.evidenceToggle, pressed && styles.pressed]}
          >
            <Text style={styles.evidenceLabel}>
              {showEvidence ? "Hide the sources" : `Where these numbers come from (${explanation.evidence.length} sources)`}
            </Text>
            <View style={showEvidence ? styles.chevUp : styles.chevDown}>
              <Icon name="chevron" size={20} color={colors.green} />
            </View>
          </Pressable>
          {showEvidence ? (
            <View style={styles.evidence}>
              {explanation.evidence.map((l) => (
                <Text key={l.code} style={text.small}>
                  {l.text}
                </Text>
              ))}
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
  barLabel: { ...text.small, width: 150 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bg, justifyContent: "center" },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.green },
  baseMark: { position: "absolute", top: -4, width: 2, height: 18, marginLeft: -1, backgroundColor: colors.ink },
  barValue: { ...text.small, width: 28, textAlign: "right", fontWeight: "600", fontVariant: ["tabular-nums"] },
  delta: { ...text.caption, width: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
  up: { color: colors.green, fontWeight: "700" },
  down: { color: colors.danger, fontWeight: "700" },
  strong: { fontWeight: "700" },
  section: { gap: 6 },
  line: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.dashed },
  bulletUp: { backgroundColor: colors.green },
  bulletDown: { backgroundColor: colors.danger },
  lineText: { ...text.small, flex: 1 },
  confidence: { gap: 4, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.bg },
  evidenceToggle: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  pressed: { backgroundColor: colors.pressed },
  evidenceLabel: { ...text.bodyStrong, color: colors.green, flex: 1 },
  chevDown: { transform: [{ rotate: "90deg" }] },
  chevUp: { transform: [{ rotate: "-90deg" }] },
  evidence: { gap: 6 },
});
