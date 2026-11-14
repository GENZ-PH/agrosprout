import { StyleSheet, Text, View } from "react-native";

import type { ComponentKey, Explanation, RotationOption } from "../engine";
import type { Crop } from "../types";
import { CropImage } from "./CropImage";
import { ExplainWithSI } from "./ExplainWithSI";
import { explainRequest } from "./explain-core";
import { checkFirst, cropSequence, type LongerSeason, plainReasons, yearStrip } from "./farmer-core";
import { familyStyle, MONTH_NAMES } from "./field-year-core";
import { Icon } from "./Icon";
import { OPTION_LABELS } from "./soil-health-chart-core";
import { colors, space, text } from "./theme";

// "Our suggestion for Lot 1" (dashboard audit 2026-11-15): the first card, for a farmer who finds
// numbers and charts hard. One answer, the year as pictures (the plan next to what they plant now),
// up to three gains in plain words with one kind of number (score out of 100, plan vs yours), and
// the one thing to check first. Everything else (other plans, scores, evidence, charts) is under
// "Details for your technician". It repeats the engine's top option only; it decides nothing.

type Props = {
  lotName: string;
  pick: RotationOption;
  a: RotationOption | undefined;
  explanation: Explanation | undefined;
  cropName: (id: string) => string;
  cropById: (id: string) => Crop | undefined;
  componentsLeftOut: readonly ComponentKey[];
  /** Farmer seasons the results lengthen to the crop's own season (`longerSeasons`). */
  longer?: readonly LongerSeason[];
  /** A what-if is on: the SI summary waits for a tap instead of loading by itself. */
  whatIf?: boolean;
};

const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

function YearRow({ label, strip, cropById }: { label: string; strip: (string | null)[]; cropById: (id: string) => Crop | undefined }) {
  return (
    <View style={styles.yearRow}>
      <Text style={[text.small, styles.rowLabel]}>{label}</Text>
      <View style={styles.cells}>
        {strip.map((id, i) => {
          const style = id ? familyStyle(cropById(id)?.family) : null;
          return (
            <View
              key={i}
              style={[styles.cell, style ? { backgroundColor: style.fill } : styles.cellEmpty]}
              accessibilityLabel={`${MONTH_NAMES[i]}: ${id ? shortName(cropById(id)?.name ?? id) : "nothing planted"}`}
            />
          );
        })}
      </View>
    </View>
  );
}

export function FarmerSuggestion({ lotName, pick, a, explanation, cropName, cropById, componentsLeftOut, longer = [], whatIf = false }: Props) {
  const isA = pick.key === "A";
  const name = (id: string) => shortName(cropName(id));
  const reasons = plainReasons(pick, a, componentsLeftOut);
  const check = checkFirst(explanation);
  const siRequest = explanation ? explainRequest({ pick, a, explanation, cropName, componentsLeftOut }) : null;
  const crops = [...new Set(pick.slots.map((s) => s.crop_id))];
  const yours = a ? [...new Set(a.slots.map((s) => s.crop_id))] : [];
  const legend = [...new Set([...crops, ...(isA ? [] : yours)])];

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.kicker}>Our suggestion for {lotName}</Text>
      <Text style={text.title} accessibilityRole="header">
        {isA ? "Keep your crops" : cropSequence(pick, name)}
      </Text>
      <View style={styles.pics}>
        {crops.map((id) => (
          <View key={id} style={styles.pic}>
            <CropImage cropId={id} size={56} />
            <Text style={text.small} numberOfLines={1}>
              {name(id)}
            </Text>
          </View>
        ))}
      </View>

      {/* The year as pictures: months over numbers. */}
      <View style={styles.year} accessibilityLabel="The year month by month">
        <View style={styles.yearRow}>
          <Text style={[text.small, styles.rowLabel]} />
          <View style={styles.cells}>
            {MONTH_NAMES.map((m) => (
              <Text key={m} style={styles.month}>
                {m[0]}
              </Text>
            ))}
          </View>
        </View>
        <YearRow label={isA ? "Your crops" : "Suggestion"} strip={yearStrip(pick)} cropById={cropById} />
        {!isA && a ? <YearRow label="You now" strip={yearStrip(a)} cropById={cropById} /> : null}
        {longer.map((l) => (
          <Text key={`${l.crop_id}-${l.given}`} style={text.caption}>
            {`You gave ${name(l.crop_id)} ${l.given}. That is shorter than its usual season of ${l.days} days, so the results count ${l.days} days from your planting month.`}
          </Text>
        ))}
        <View style={styles.legend}>
          {legend.map((id) => (
            <View key={id} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: familyStyle(cropById(id)?.family).fill }]} />
              <Text style={text.caption}>{name(id)}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.cellEmpty]} />
            <Text style={text.caption}>Nothing planted</Text>
          </View>
        </View>
      </View>

      {reasons.length > 0 ? (
        <View style={styles.reasons}>
          <Text style={text.bodyStrong}>What you gain</Text>
          {reasons.map((r) => (
            <View key={r.key} style={styles.reason}>
              <Icon name="check" size={20} color={colors.green} />
              <View style={styles.flex}>
                <Text style={text.body}>{r.text}</Text>
                <Text style={text.caption}>
                  {r.plan} out of 100 with this plan, {r.yours} with your crops now
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {check ? (
        <View style={styles.reasons}>
          <Text style={text.bodyStrong}>Ask your technician first</Text>
          <Text style={text.body}>{check}</Text>
        </View>
      ) : null}

      {siRequest ? <ExplainWithSI key={JSON.stringify(siRequest)} request={siRequest} auto={!whatIf} /> : null}
      <Text style={text.caption}>
        {isA ? "Your crops already score highest on this lot." : `This is plan ${pick.key} (${OPTION_LABELS[pick.key]}) in the details for your technician.`} You
        and your technician decide.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Part of the lot tab, not a boxed alert (2026-11-15): plain page content under the header.
  card: { gap: space.md, paddingTop: space.sm },
  kicker: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.olive },
  pics: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  pic: { alignItems: "center", gap: 2, maxWidth: 88 },
  year: { gap: space.xs },
  yearRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rowLabel: { width: 76 },
  cells: { flex: 1, flexDirection: "row", gap: 2 },
  cell: { flex: 1, height: 26, borderRadius: 4 },
  cellEmpty: { backgroundColor: colors.bg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.dashed },
  month: { flex: 1, textAlign: "center", fontSize: 12, lineHeight: 16, color: colors.muted },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  reasons: { gap: space.sm },
  reason: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  flex: { flex: 1, minWidth: 0 },
});
