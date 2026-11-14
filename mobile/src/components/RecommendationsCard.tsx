import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ComponentKey, ConfidenceLevel, Explanation, OptionKey, RotationOption } from "../engine";
import { Icon } from "./Icon";
import { Bullets, InfoCard } from "./InfoCard";
import {
  CONFIDENCE_LABELS,
  confidenceReasonText,
  deltaText,
  optionCropsText,
  optionSummary,
  scoreRows,
  shortCropName,
  type ScoreRow,
} from "./recommendations-core";
import { rowsOf } from "./layout-core";
import { OPTION_LABELS } from "./soil-health-chart-core";
import { colors, MIN_TOUCH, optionColors, radius, space, text } from "./theme";

// Recommendations (#29, docs/11-user-flow.md S3, challenge objectives O16-O21): the farmer's own
// crops (option A) next to the alternatives B-D, each with its scores and the engine's
// Why · Evidence · Benefits · Trade-offs · Unknowns · Check locally and a confidence badge
// (engine/explain.ts). The card only shows the engine's output; it decides nothing itself.

type Props = {
  /** `analysis.rotations.options`: A first, then B, C, D. */
  options: readonly RotationOption[];
  /** `analysis.explanations`: one per option. */
  explanations: readonly Explanation[];
  /** `analysis.rotations.components_left_out`: no data on this lot, so no option is scored on them. */
  componentsLeftOut: readonly ComponentKey[];
  cropName: (id: string) => string;
  period: string;
  /** 2 on a big window (#114): options side by side, A and B, then C and D. Default 1 (phones). */
  columns?: 1 | 2;
};

export function RecommendationsCard({ options, explanations, componentsLeftOut, cropName, period, columns = 1 }: Props) {
  const a = options.find((o) => o.key === "A");
  const items = options.flatMap((o) => {
    const ex = explanations.find((e) => e.option_key === o.key);
    return ex ? [{ o, ex }] : [];
  });
  const grid = columns > 1;
  // Which options have their details open. Kept here, not per option, so a grid row knows when to
  // stop matching heights: closed rows line up, an open option keeps its neighbour at its own height.
  const [open, setOpen] = useState<Partial<Record<OptionKey, boolean>>>({});
  const toggle = (k: OptionKey) => setOpen((s) => ({ ...s, [k]: !s[k] }));
  return (
    <InfoCard
      title="Recommendations"
      explainer="recommendations"
      period={period}
      subtitle="Your crops (A) next to other ways to use this lot over a year. Scores go from 0 to 100; higher is better."
    >
      <View style={styles.list}>
        {rowsOf(items, columns).map((row) => {
          const matchHeights = grid && !row.some(({ o }) => open[o.key]);
          return (
            <View key={row.map((r) => r.o.key).join("")} style={grid ? [styles.gridRow, !matchHeights && styles.rowTop] : undefined}>
              {row.map(({ o, ex }) => (
                <View key={o.key} style={grid ? styles.gridCell : undefined}>
                  <OptionItem
                    option={o}
                    a={a}
                    explanation={ex}
                    componentsLeftOut={componentsLeftOut}
                    cropName={cropName}
                    open={!!open[o.key]}
                    onToggle={() => toggle(o.key)}
                    fill={matchHeights}
                  />
                </View>
              ))}
              {/* An empty cell keeps a lone last option at half width, under its neighbour. */}
              {grid && row.length < columns ? <View style={styles.gridCell} /> : null}
            </View>
          );
        })}
      </View>
    </InfoCard>
  );
}

type ItemProps = {
  option: RotationOption;
  a: RotationOption | undefined;
  explanation: Explanation;
  componentsLeftOut: readonly ComponentKey[];
  cropName: (id: string) => string;
  open: boolean;
  onToggle: () => void;
  /** Fill the grid cell's height (closed grid rows), with the details button at the bottom. */
  fill?: boolean;
};

function OptionItem({ option: o, a, explanation: ex, componentsLeftOut, cropName, open, onToggle, fill = false }: ItemProps) {
  const title = OPTION_LABELS[o.key];
  const crops = optionCropsText(o, cropName);
  const color = optionColors[o.key];
  const newCrops = o.new_crop_ids.map((id) => shortCropName(cropName(id)));

  return (
    <View style={[styles.option, fill && styles.fillCell, { borderLeftColor: color }]}>
      <View
        style={styles.optionHead}
        accessible
        accessibilityLabel={optionSummary({ key: o.key, title, total: o.total, confidence: ex.confidence.level, top: o.top_total, crops })}
      >
        <View style={[styles.key, { borderColor: color }]}>
          <Text style={[styles.keyText, { color }]}>{o.key}</Text>
        </View>
        <Text style={[text.bodyStrong, styles.flex]}>{title}</Text>
        <Text style={styles.total}>
          {o.total === null ? "–" : Math.round(o.total)}
          <Text style={text.caption}> /100</Text>
        </Text>
      </View>

      <View style={styles.tags}>
        {o.top_total ? <Tag label="Top score" tone="good" /> : null}
        <ConfidenceTag level={ex.confidence.level} />
        {o.assumed_calendar ? <Tag label="Typical months, assumed" tone="warn" /> : null}
        {newCrops.length > 0 ? <Tag label={`New on your lot: ${newCrops.join(", ")}`} tone="plain" /> : null}
      </View>

      <Text style={text.small}>{crops}</Text>

      <Section title="Why this option">
        <Bullets lines={ex.why.map((l) => l.text)} />
      </Section>

      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? "Hide" : "Show"} scores, evidence and checks for option ${o.key}, ${title}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Text style={[text.bodyStrong, styles.toggleText]}>{open ? "Hide details" : "Scores, evidence and checks"}</Text>
        <View style={open ? styles.chevronOpen : styles.chevron}>
          <Icon name="chevron" size={20} color={colors.green} />
        </View>
      </Pressable>

      {open ? <OptionDetails option={o} a={a} explanation={ex} componentsLeftOut={componentsLeftOut} /> : null}
    </View>
  );
}

function OptionDetails({ option: o, a, explanation: ex, componentsLeftOut }: Pick<ItemProps, "option" | "a" | "explanation" | "componentsLeftOut">) {
  const rows = scoreRows(o, a, componentsLeftOut);
  const shown = rows.filter((r) => !r.left_out);
  const leftOut = rows.filter((r) => r.left_out).map((r) => r.label);
  const isA = o.key === "A";

  return (
    <View style={styles.details}>
      <Section title={isA ? "Scores" : "Scores (change vs your crops)"}>
        <View style={styles.scores}>
          {shown.map((r) => (
            <ScoreBar key={r.key} row={r} color={optionColors[o.key]} />
          ))}
        </View>
        {leftOut.length > 0 ? (
          <Text style={text.caption}>Not scored on this lot yet, because data is missing: {leftOut.join(", ")}.</Text>
        ) : null}
      </Section>
      {!isA ? (
        <Section title="Benefits">
          <Bullets lines={ex.benefits.map((l) => l.text)} />
        </Section>
      ) : null}
      {ex.tradeoffs.length > 0 ? (
        <Section title="Trade-offs">
          <Bullets lines={ex.tradeoffs.map((l) => l.text)} />
        </Section>
      ) : null}
      <Section title="Evidence">
        <Bullets lines={ex.evidence.map((l) => l.text)} />
      </Section>
      <Section title="What we don't know">
        <Bullets lines={ex.unknowns.map((l) => l.text)} />
      </Section>
      <Section title="Check locally">
        <Bullets lines={ex.check_locally.map((l) => l.text)} />
      </Section>
      <Section title={`Confidence: ${CONFIDENCE_LABELS[ex.confidence.level]}`}>
        <Bullets
          lines={
            ex.confidence.reasons.length > 0
              ? ex.confidence.reasons.map(confidenceReasonText)
              : ["The order of the options holds in a dry and a wet year, and no answers or scores are missing."]
          }
        />
      </Section>
    </View>
  );
}

function ScoreBar({ row, color }: { row: ScoreRow; color: string }) {
  const value = row.value;
  const change = row.delta === null ? "" : row.delta === 0 ? ", same as your crops" : `, ${Math.abs(row.delta)} ${row.delta > 0 ? "more" : "less"} than your crops`;
  return (
    <View
      style={styles.scoreRow}
      accessible
      accessibilityLabel={value === null ? `${row.label}: no data` : `${row.label}: ${value} out of 100${change}`}
    >
      {/* Label and number on one line, the bar under them: fits a 360 px phone as well as a laptop. */}
      <View style={styles.scoreTop}>
        <Text style={[text.small, styles.flex]}>{row.label}</Text>
        <Text style={[text.small, styles.scoreValue]}>{value === null ? "No data" : value}</Text>
        <Text style={[text.caption, styles.scoreDelta]}>{row.delta === null ? "" : deltaText(row.delta)}</Text>
      </View>
      <View style={styles.track}>
        {value !== null ? <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} /> : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={text.bodyStrong}>{title}</Text>
      {children}
    </View>
  );
}

/** Tag colors reuse contrast-checked pairs from theme.ts; the word is always the cue. */
const TAG = {
  good: { bg: colors.greenTint, fg: colors.green, border: colors.greenTint },
  warn: { bg: colors.amberTint, fg: colors.amber, border: colors.amberTint },
  plain: { bg: colors.surface, fg: colors.muted, border: colors.border },
} as const;

function Tag({ label, tone }: { label: string; tone: keyof typeof TAG }) {
  const t = TAG[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.tagText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const CONFIDENCE_TONE: Record<ConfidenceLevel, keyof typeof TAG> = { high: "good", medium: "plain", low: "warn" };

function ConfidenceTag({ level }: { level: ConfidenceLevel }) {
  return <Tag label={`Confidence: ${CONFIDENCE_LABELS[level]}`} tone={CONFIDENCE_TONE[level]} />;
}

const styles = StyleSheet.create({
  list: { gap: space.md, marginTop: space.xs },
  // A closed row: both options the same height, details buttons in line at the bottom.
  gridRow: { flexDirection: "row", alignItems: "stretch", gap: space.md },
  // A row with an open option: each keeps its own height, so no button floats far below its option.
  rowTop: { alignItems: "flex-start" },
  gridCell: { flex: 1, minWidth: 0 },
  fillCell: { flexGrow: 1 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
  optionHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  key: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 14, fontWeight: "700" },
  total: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tag: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 2 },
  tagText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  section: { gap: space.xs },
  toggle: {
    marginTop: "auto",
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
    marginBottom: -space.sm,
  },
  toggleText: { color: colors.green },
  pressed: { backgroundColor: colors.pressed },
  chevron: { transform: [{ rotate: "90deg" }] },
  chevronOpen: { transform: [{ rotate: "-90deg" }] },
  details: { gap: space.md, paddingTop: space.md },
  scores: { gap: space.sm },
  scoreRow: { gap: 2 },
  scoreTop: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.pressed, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  scoreValue: { fontWeight: "600" },
  scoreDelta: { minWidth: 36, textAlign: "right" },
});
