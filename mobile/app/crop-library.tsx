import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { CropImage } from "../src/components/CropImage";
import { Header } from "../src/components/Header";
import { Icon } from "../src/components/Icon";
import { Screen } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { CROP_LIBRARY } from "../src/data/crops";
import { params } from "../src/engine";
import type { Crop } from "../src/types";

// Crop library (2026-11-15): every crop the engine can suggest, with the characteristics it uses and
// where each value comes from, and how a crop is matched to a lot. The numbers shown are the ones in
// crops.json and params.ts, nothing else; a value with no source shows as "not known yet".

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVEL = { low: "Low", medium: "Medium", high: "High" } as const;
const UNKNOWN = "Not known yet";

/** Same rule as the engine (rotations.ts isComplete): these values must all be known to suggest a crop. */
const usable = (c: Crop) => c.season_days !== null && c.kc !== null && c.stages_days !== null && c.temp_c !== null;

const level = (v: keyof typeof LEVEL | null) => (v ? LEVEL[v] : UNKNOWN);

function rows(c: Crop): [string, string][] {
  const t = c.temp_c;
  return [
    ["Days in the field", c.season_days === null ? UNKNOWN : `${c.season_days} days`],
    ["Temperature it survives", t ? `${t.min} to ${t.max} °C` : UNKNOWN],
    ["Temperature it likes best", t ? `${t.opt_low} to ${t.opt_high} °C` : UNKNOWN],
    ["Water use at its peak (FAO-56 Kc mid)", c.kc ? String(c.kc[1]) : UNKNOWN],
    ["Root depth", c.root_depth_m ? `${c.root_depth_m[0]} to ${c.root_depth_m[1]} m` : UNKNOWN],
    ["Handles dry spells", level(c.drought_tolerance)],
    ["Handles waterlogged soil", level(c.waterlogging_tolerance)],
    ["Adds nitrogen to the soil", c.n_fixing === null ? UNKNOWN : c.n_fixing ? "Yes (legume)" : "No"],
    ["Spoils after harvest", c.perishability ? { high: "Within days", medium: "In 1 to 3 weeks", low: "Keeps for months" }[c.perishability] : UNKNOWN],
    ["Typical yield (PSA)", c.yield_t_per_ha === null ? UNKNOWN : `${c.yield_t_per_ha} t/ha`],
    [
      "Usual months",
      c.typical_calendar.length === 0
        ? UNKNOWN
        : c.typical_calendar.map((s) => `${MONTH[s.plant_month - 1]} to ${MONTH[s.harvest_month - 1]}`).join(", "),
    ],
  ];
}

function CropCard({ c }: { c: Crop }) {
  const [open, setOpen] = useState(false);
  const ok = usable(c);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <CropImage cropId={c.id} size={56} />
        <View style={styles.flex}>
          <Text style={text.bodyStrong}>{c.name}</Text>
          <Text style={text.caption}>
            {[c.local_name, c.family].filter(Boolean).join(", ")}
          </Text>
          <Text style={[styles.badge, ok ? styles.badgeOk : styles.badgeNo]}>{ok ? "Used in suggestions" : "Not enough data to suggest yet"}</Text>
        </View>
      </View>
      {c.notes ? <Text style={text.small}>{c.notes}</Text> : null}
      <View style={styles.table}>
        {rows(c).map(([k, v]) => (
          <View key={k} style={styles.tr}>
            <Text style={[text.caption, styles.k]}>{k}</Text>
            <Text style={[text.small, styles.v, v === UNKNOWN && styles.unknown]}>{v}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => setOpen((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? "Hide" : "Show"} sources for ${c.name}`}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>
          {open ? "Hide sources" : `Sources (${c.sources.length})`}
        </Text>
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}>
          <Icon name="chevron" size={18} color={colors.green} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.sources}>
          {c.sources.map((s, i) => (
            <View key={i} style={styles.source}>
              <Text style={[text.caption, styles.strong]}>{s.field_or_fields}</Text>
              <Text style={text.caption}>{s.citation}</Text>
              {s.url ? (
                <Pressable onPress={() => void Linking.openURL(s.url as string)} accessibilityRole="link">
                  <Text style={styles.link} numberOfLines={1}>
                    {s.url}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {c.unverified.length > 0 ? (
            <Text style={text.caption}>Not checked yet, so left empty: {c.unverified.join(", ")}.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function CropLibraryScreen() {
  const crops = [...CROP_LIBRARY.crops].sort((a, b) => Number(usable(b)) - Number(usable(a)) || a.name.localeCompare(b.name));
  const count = crops.filter(usable).length;
  return (
    <Screen links>
      <Header title="Crop library" fallbackHref="/dashboard" />
      <Text style={text.body}>
        These are the {crops.length} crops AgroSprout can compare, {count} of them with enough data to be suggested. Every
        value comes from a published source, shown under each crop. A value we could not check is left empty, never guessed.
      </Text>

      <View style={styles.how}>
        <Text style={text.heading} accessibilityRole="header">
          How a crop is matched to your lot
        </Text>
        <Step n={1} t="For your lot, the app gets 25 years of NASA POWER monthly data for that spot: rain, temperature, the water the air takes from the soil (FAO-56), and how wet the root zone gets." />
        <Step
          n={2}
          t={`Every crop below is tried in every planting month. A month is ruled out when the monthly mean temperature falls outside the temperature the crop survives (FAO Ecocrop), when rain in a typical year leaves the crop short of more than ${Math.round(params.HARD_FILTER_WSI_MAX * 100)}% of its water need (FAO-56 water balance), or when a crop that cannot take waterlogged soil meets root-zone wetness of ${params.HARD_FILTER_WATERLOG_WETNESS_MIN} or more.`}
        />
        <Step n={3} t={`The crops and months left are joined into year plans of up to ${params.MAX_CROPS_PER_ROTATION} crops, and each plan is scored on water, weather risk, soil, pests, erosion, income, market and labor, weighted by your priorities.`} />
        <Step n={4} t="So a different place gives different months and crops: a long dry season rules out thirsty crops in those months, a cool upland rules out crops that need heat, and a wet spot rules out crops that rot in wet soil." />
      </View>

      <Text style={text.heading} accessibilityRole="header">
        The crops
      </Text>
      {crops.map((c) => (
        <CropCard key={c.id} c={c} />
      ))}
    </Screen>
  );
}

function Step({ n, t }: { n: number; t: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.num}>{n}</Text>
      <Text style={[text.small, styles.flex]}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  how: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.greenTint },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  num: { width: 22, height: 22, borderRadius: 11, textAlign: "center", lineHeight: 22, fontSize: 13, fontWeight: "700", color: colors.white, backgroundColor: colors.green, overflow: "hidden" },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  head: { flexDirection: "row", gap: space.md, alignItems: "center" },
  badge: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, fontSize: 12, fontWeight: "700", overflow: "hidden" },
  badgeOk: { backgroundColor: colors.greenTint, color: colors.green },
  badgeNo: { backgroundColor: colors.amberTint, color: colors.amber },
  table: { borderTopWidth: 1, borderTopColor: colors.border },
  tr: { flexDirection: "row", gap: space.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  k: { flex: 1.2 },
  v: { flex: 1, fontWeight: "600" },
  unknown: { color: colors.muted, fontWeight: "400" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, alignSelf: "flex-start" },
  toggleText: { fontSize: 14, fontWeight: "700", color: colors.green },
  sources: { gap: space.sm },
  source: { gap: 2 },
  strong: { fontWeight: "700", color: colors.ink },
  link: { fontSize: 12, lineHeight: 16, color: colors.blue, textDecorationLine: "underline" },
});
