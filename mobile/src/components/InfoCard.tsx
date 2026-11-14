import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { EXPLAINERS, fill, type ExplainerId } from "../content/explainers";
import { SOURCES, type SourceKey } from "../content/sources";
import { SourceChip, SourceChips } from "./SourceChip";
import { Icon } from "./Icon";
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

/** What it is, how to read it and its limits. Where it comes from is on the card as source chips (click a NASA one for the detail). */
export function ExplainerBox({ id, period }: { id: ExplainerId; period: string }) {
  const e = EXPLAINERS[id];
  return (
    <View style={styles.box}>
      <Part label="What it is">{e.what}</Part>
      <Part label="How to read it">{e.read}</Part>
      <View style={styles.part}>
        <Text style={text.bodyStrong}>Limits</Text>
        <Bullets lines={e.limits} />
      </View>
    </View>
  );
}

/**
 * The datasets behind a card, from the one list in sources.ts, so every ⓘ names a source the
 * same way: name, who publishes it, what it gives, how coarse it is and which years.
 */
export function SourceList({ keys, period }: { keys: readonly SourceKey[]; period: string }) {
  if (keys.length === 0) return null;
  return (
    <View style={styles.part}>
      <Text style={text.bodyStrong}>Data used</Text>
      {keys.map((k) => {
        const s = SOURCES[k];
        return (
          <View key={k} style={styles.source} accessible accessibilityLabel={`${s.name}, ${s.by}. ${s.gives}. ${s.scale}. ${fill(s.years, { period })}.`}>
            <View style={styles.sourceHead}>
              <SourceChip k={k} period={period} />
            </View>
            <Text style={[text.caption, styles.muted]}>{`${s.gives}. ${s.scale}, ${fill(s.years, { period })}. ${s.by}.`}</Text>
          </View>
        );
      })}
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
  muted: { color: colors.muted },
  source: { gap: 2, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 6 },
  sourceHead: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  sourceName: { fontWeight: "700" },
  nasa: { ...text.caption, fontWeight: "700", color: colors.green, borderWidth: 1, borderColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 6 },
});
