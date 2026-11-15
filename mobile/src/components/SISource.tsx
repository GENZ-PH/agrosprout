import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import { colors, space } from "./theme";

// Where an SI note comes from (2026-11-15): one small line saying SI wrote it and can be wrong, and a
// "Where this comes from" toggle that lists exactly what the SI was given and the official pages for
// each source. The SI writes words only; every number it was given comes from the sources listed.

export type SILink = { label: string; url: string };

export const SI_LINKS = {
  power: { label: "NASA POWER (rain, temperature, monthly data)", url: "https://power.larc.nasa.gov/" },
  powerMethod: { label: "NASA POWER methods", url: "https://power.larc.nasa.gov/docs/methodology/" },
  fao56: { label: "FAO-56 crop water need (water the air takes from the soil)", url: "https://www.fao.org/4/x0490e/x0490e00.htm" },
  ecocrop: { label: "FAO Ecocrop (crop temperature and season)", url: "https://gaez.fao.org/pages/ecocrop" },
  claude: { label: "Claude, by Anthropic (the SI that writes the words)", url: "https://www.anthropic.com/claude" },
} satisfies Record<string, SILink>;

export function SISource({ lead, given, links }: { lead: string; given: string[]; links: SILink[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.small}>{lead} It can be wrong.</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? "Hide" : "Show"} where this comes from`}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{open ? "Hide sources" : "Where this comes from"}</Text>
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}>
          <Icon name="chevron" size={14} color={colors.green} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.small}>The SI was given only this (no location, no names), and wrote the note from it:</Text>
          {given.map((g, i) => (
            <Text key={i} style={styles.small}>
              {`• ${g}`}
            </Text>
          ))}
          <Text style={[styles.small, styles.strong]}>Sources</Text>
          {links.map((l) => (
            <Pressable key={l.url} onPress={() => void Linking.openURL(l.url)} accessibilityRole="link" accessibilityLabel={l.label}>
              <Text style={styles.link}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  small: { fontSize: 12, lineHeight: 16, color: colors.muted },
  strong: { fontWeight: "700", color: colors.ink, marginTop: 2 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 28 },
  toggleText: { fontSize: 12, fontWeight: "700", color: colors.green },
  body: { gap: 2, paddingLeft: space.xs },
  link: { fontSize: 12, lineHeight: 18, color: colors.blue, textDecorationLine: "underline" },
});
