import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { EXPLAINERS, fill, type ExplainerId } from "../content/explainers";
import { Icon } from "./Icon";
import { SourceChips } from "./SourceChip";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// A dashboard card (#29) with its "ⓘ What am I looking at?" button. The ⓘ opens the card's
// explainer from src/content/explainers.ts (#31): what the data is, where it comes from, how to
// read it and its limits, right under the title so it stays next to the button.

type Props = {
  title: string;
  /** Which text in src/content/explainers.ts the ⓘ opens. */
  explainer: ExplainerId;
  /** The years of the lot's data, e.g. "2001-2025", for the `{period}` in the explainer text. */
  period: string;
  /** One short line under the title. */
  subtitle?: string;
  children: ReactNode;
};

export function InfoCard({ title, explainer, period, subtitle, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={[text.heading, styles.flex]} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`What am I looking at? About ${title}`}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <Icon name="info" size={22} color={colors.green} />
        </Pressable>
      </View>
      {subtitle ? <Text style={text.caption}>{subtitle}</Text> : null}
      {open ? <ExplainerBox id={explainer} period={period} /> : null}
      <SourceChips keys={EXPLAINERS[explainer].sources} period={period} />
      {children}
    </View>
  );
}

/** The four parts of an explainer, in the order a farmer asks them. */
export function ExplainerBox({ id, period }: { id: ExplainerId; period: string }) {
  const e = EXPLAINERS[id];
  return (
    <View style={styles.box}>
      <Part label="What it is">{e.what}</Part>
      <Part label="Where it comes from">{fill(e.source, { period })}</Part>
      <Part label="How to read it">{e.read}</Part>
      <View style={styles.part}>
        <Text style={text.bodyStrong}>Limits</Text>
        <Bullets lines={e.limits} />
      </View>
    </View>
  );
}

function Part({ label, children }: { label: string; children: string }) {
  return (
    <View style={styles.part}>
      <Text style={text.bodyStrong}>{label}</Text>
      <Text style={text.small}>{children}</Text>
    </View>
  );
}

/** A plain bullet list. Each line is one `Text`, so screen readers read it as one item. */
export function Bullets({ lines }: { lines: readonly string[] }) {
  return (
    <View style={styles.bullets}>
      {lines.map((l, i) => (
        <View key={`${i}-${l}`} style={styles.bullet}>
          <Text style={[text.small, styles.dot]} aria-hidden>
            •
          </Text>
          <Text style={[text.small, styles.flex]}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  info: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    marginRight: -space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  pressed: { backgroundColor: colors.pressed },
  box: { backgroundColor: colors.greenTint, borderRadius: radius.sm, padding: space.md, gap: space.md },
  part: { gap: space.xs },
  bullets: { gap: space.xs },
  bullet: { flexDirection: "row", gap: space.sm },
  dot: { width: 10 },
});
