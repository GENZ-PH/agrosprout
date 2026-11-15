import { StyleSheet, Text, View } from "react-native";

import { tr } from "../i18n/lang-store";
import type { LotDetails } from "../types";
import { AdjustSheet } from "./AdjustControls";
import { Button } from "./Button";
import { LOT_DETAIL_QUESTIONS } from "./lot-details-options";
import { LotDetailsForm } from "./LotDetailsForm";
import { colors, radius, space, text } from "./theme";

// "Tell us about your land" (2026-11-15): the three optional lot details (land type, water source,
// soil feel, #41) on the dashboard itself. Before, they were only behind "Details" while drawing and a
// link on Edit farm, so most lots kept "I don't know" and every result said it was less certain.
// NASA data cannot answer them for a lot (the location sent is rounded to 0.1°, rule 8), so the farmer does.

/** How many of the three answers are still "I don't know". */
export const unknownDetails = (d: LotDetails): number => LOT_DETAIL_QUESTIONS.filter((q) => d[q.key] === "unknown").length;

/** One line of the answers given, e.g. "Upland, rain only, loamy", or null when none is given. */
export function detailsSummary(d: LotDetails): string | null {
  const given = LOT_DETAIL_QUESTIONS.map((q) => (d[q.key] === "unknown" ? null : q.options.find((o) => o.value === d[q.key])?.label ?? null)).filter(
    (x): x is string => x !== null,
  );
  if (given.length === 0) return null;
  return given.map((g, i) => (i === 0 ? tr(g) : tr(g).toLowerCase())).join(", ");
}

/** The card near the top of the results; shown only while an answer is "I don't know". */
export function LandCard({ lotName, details, onOpen }: { lotName: string; details: LotDetails; onOpen: () => void }) {
  const n = unknownDetails(details);
  if (n === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={text.bodyStrong}>{tr("Tell us about the land on {lot}", { lot: lotName })}</Text>
      <Text style={[text.small, styles.muted]}>
        {n === 3
          ? tr("3 quick questions: land type, water and soil. Without them the results are less certain.")
          : tr("{n} of 3 questions still say \"I don't know\", so the results are less certain.", { n })}
      </Text>
      <Button label={n === 3 ? "Answer 3 quick questions" : "Answer the rest"} icon="sprout" variant="secondary" onPress={onOpen} />
    </View>
  );
}

/** The three questions in a sheet over the results; answers save as they are tapped. */
export function LandSheet({
  visible,
  onClose,
  lotName,
  details,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  lotName: string;
  details: LotDetails;
  onChange: (next: LotDetails) => void;
}) {
  return (
    <AdjustSheet
      visible={visible}
      onClose={onClose}
      title={tr("The land on {lot}", { lot: lotName })}
      subtitle={tr("Answers save as you tap. Skip any you are not sure about.")}
    >
      <LotDetailsForm value={details} onChange={onChange} hideIntro />
    </AdjustSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amberTint,
  },
  muted: { color: colors.muted },
});
