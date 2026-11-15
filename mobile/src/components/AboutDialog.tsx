import { router } from "expo-router";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NASA_CREDITS } from "../content/credits";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// "About AgroSprout" (2026-11-15), opened from the footer: what the app is, how it works, the
// technology, the data it credits and the team. Every line repeats README.md, THIRD_PARTY.md or the
// credits screen; nothing new is claimed. The full list with licenses stays on the Credits screen.

/**
 * The team, by GitHub username (the repo's contributors). docs/README.md has no member names yet:
 * the team replaces these with the names they want shown.
 */
const TEAM = ["RomartM", "johnrald1", "earnieacts", "DMNCDLPRT"] as const;

const HOW = [
  "Draw your lots on the map and pick the crops you grow.",
  "For each lot, the app gets 25 years of NASA POWER climate data for that spot.",
  "On the phone, it checks every crop in every planting month against that climate (FAO-56 water balance, crop temperature limits, soil wetness), builds year plans, and scores them next to your own crops.",
  "You see one suggestion in plain words, and your technician sees every plan, score and data source.",
];

const TECH: readonly [string, string][] = [
  ["App", "Expo and React Native with TypeScript: one codebase for the Android app and the web app"],
  ["Map", "Leaflet with Terra Draw, bundled in the app"],
  ["Engine", "Pure TypeScript on the device, so results work offline"],
  ["API", "Hono on Cloudflare Workers, for routing and the SI summaries"],
  ["Hosting", "Cloudflare Pages"],
  ["SI", "Claude, by Anthropic: the plain-words summaries, checked so they only use the engine's numbers"],
];

export function AboutDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close About" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="none">
          <View style={styles.head}>
            <Text style={[text.title, styles.flex]} accessibilityRole="header">
              About AgroSprout
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={text.body}>
              AgroSprout helps smallholder farmers compare crop rotations and planting months for each of their lots, using NASA Earth
              observations, crop characteristics and the farmer&apos;s own priorities. No login, and farm data stays on the phone. It
              supports, and doesn&apos;t replace, the farmer&apos;s judgment and the agricultural technician.
            </Text>

            <Section title="How it works">
              {HOW.map((h, i) => (
                <View key={h} style={styles.step}>
                  <Text style={styles.num}>{i + 1}</Text>
                  <Text style={[text.small, styles.flex]}>{h}</Text>
                </View>
              ))}
              <Button
                label="See every crop and how it is matched"
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push("/crop-library");
                }}
              />
            </Section>

            <Section title="Technology">
              {TECH.map(([k, v]) => (
                <Text key={k} style={text.small}>
                  <Text style={styles.strong}>{k}: </Text>
                  {v}
                </Text>
              ))}
            </Section>

            <Section title="Data and credits">
              {NASA_CREDITS.map((c) => (
                <Text key={c.name} style={text.small}>
                  {c.name}
                </Text>
              ))}
              <Text style={text.small}>
                Methods: FAO Irrigation and Drainage Paper 56 (Allen et al., 1998); FAO effective rainfall (Training Manual No. 3); FAO
                Ecocrop crop limits.
              </Text>
              <Button
                label="All credits and licenses"
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push("/credits");
                }}
              />
            </Section>

            <Section title="The team">
              <Text style={text.small}>
                Team Jeoleecation, NASA Space Apps Challenge 2026, Local Event Iligan City, Philippines. Challenge: Field Shift: Adapting
                Farms with NASA Data.
              </Text>
              <Text style={text.small}>{TEAM.join(", ")}</Text>
              <Pressable onPress={() => Linking.openURL("https://github.com/InovSea/agrosprout")} accessibilityRole="link">
                <Text style={styles.link}>Source code on GitHub</Text>
              </Pressable>
              <Text style={text.caption}>Not affiliated with or endorsed by NASA.</Text>
            </Section>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={text.heading} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  dialog: { width: "100%", maxWidth: 560, maxHeight: "90%", borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", marginRight: -space.sm },
  body: { gap: space.lg, padding: space.lg },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  num: { width: 22, height: 22, borderRadius: 11, textAlign: "center", lineHeight: 22, fontSize: 13, fontWeight: "700", color: colors.white, backgroundColor: colors.green, overflow: "hidden" },
  strong: { fontWeight: "700" },
  link: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
});
