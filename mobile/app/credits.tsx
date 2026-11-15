import { type ReactNode, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Header } from "../src/components/Header";
import { Screen } from "../src/components/Screen";
import { colors, MIN_TOUCH, radius, space, text } from "../src/components/theme";
import { CROP_LIBRARY } from "../src/data/crops";
import {
  ARTWORK_CREDITS,
  BUILD_CREDITS,
  type CreditItem,
  METHOD_CREDITS,
  SERVICE_CREDITS,
  MAP_CREDITS,
  NASA_CREDITS,
  OTHER_DATA_CREDITS,
  SI_CREDITS,
  SOFTWARE_CREDITS,
} from "../src/content/credits";
import { adaptedCopyNote, CROP_PICTURE_CHANGES, CROP_PICTURE_CREDITS } from "../src/data/crop-credits";
import { useSavedCropPhotos } from "../src/data/crop-photo";

// Licenses and credits: who made the photos, data, map, artwork and software the app uses, and under
// which license. Same facts as THIRD_PARTY.md. No logos.

function Link({ url, label, a11y }: { url: string; label: string; a11y: string }) {
  return (
    <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={a11y} style={styles.linkRow}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

// Grouped by kind of resource (2026-11-15), with a picker at the top; "All" lists everything.
const CATEGORIES = [
  "All",
  "NASA data",
  "Other data",
  "Methods and references",
  "Crop library sources",
  "Online services",
  "Crop photos",
  "Map",
  "Software",
  "Build and hosting",
  "Logo, icons and fonts",
  "SI tools",
] as const;
type Category = (typeof CATEGORIES)[number];

/** Every citation in the crop library, once each, with the crops it covers. */
function cropSources(): CreditItem[] {
  const by = new Map<string, { crops: string[]; url?: string }>();
  for (const c of CROP_LIBRARY.crops)
    for (const src of c.sources) {
      const e = by.get(src.citation) ?? { crops: [], url: src.url ?? undefined };
      if (!e.crops.includes(c.name)) e.crops.push(c.name);
      by.set(src.citation, e);
    }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([citation, e]) => ({ name: citation, lines: [`Used for: ${e.crops.join(", ")}.`], url: e.url }));
}

function Section({ title, children, show = true }: { title: string; children: ReactNode; show?: boolean }) {
  if (!show) return null;
  return (
    <>
      <Text style={text.heading} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.list}>{children}</View>
    </>
  );
}

function Items({ items }: { items: readonly CreditItem[] }) {
  return items.map((d) => (
    <View key={d.name} style={styles.item}>
      <Text style={text.bodyStrong}>{d.name}</Text>
      {d.lines.filter(Boolean).map((l) => (
        <Text key={l} style={text.small}>
          {l}
        </Text>
      ))}
      {d.url ? <Link url={d.url} label={d.url} a11y={`Open the source for ${d.name}`} /> : null}
    </View>
  ));
}

export default function CreditsScreen() {
  const saved = useSavedCropPhotos();
  const [cat, setCat] = useState<Category>("All");
  const on = (c: Category) => cat === "All" || cat === c;
  const lib = cropSources();
  return (
    <Screen links>
      <Header title="Licenses and credits" fallbackHref="/dashboard" />
      <Text style={text.body}>
        AgroSprout is built on the work of many people. Here is who made what, and the license it is shared under.
      </Text>

      <View style={styles.cats} accessibilityRole="tablist">
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCat(c)}
            accessibilityRole="tab"
            accessibilityState={{ selected: cat === c }}
            style={[styles.cat, cat === c && styles.catOn]}
          >
            <Text style={[styles.catText, cat === c && styles.catTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Section title="NASA data" show={on("NASA data")}>
        <Items items={NASA_CREDITS} />
      </Section>

      <Section title="Other data" show={on("Other data")}>
        <Items items={OTHER_DATA_CREDITS} />
      </Section>

      <Section title="Methods and references" show={on("Methods and references")}>
        <Items items={METHOD_CREDITS} />
      </Section>

      <Section title="Crop library sources" show={on("Crop library sources")}>
        <Text style={text.small}>
          Every value in the crop library comes from one of these. The crop library screen shows which value comes from which source.
        </Text>
        <Items items={lib} />
      </Section>

      <Section title="Online services the app calls" show={on("Online services")}>
        <Items items={SERVICE_CREDITS} />
      </Section>

      <Section title="Crop photos" show={on("Crop photos")}>
        <Text style={text.small}>
          Photos from Wikimedia Commons. Each belongs to its photographer under the license shown. We cropped each one square and made it smaller. Where the license is CC BY-SA, our changed copy is shared under that same license.
        </Text>
        {CROP_PICTURE_CREDITS.map((c) => {
          const same = adaptedCopyNote(c);
          return (
            <View key={c.crop} style={styles.item}>
              <Text style={text.bodyStrong}>{c.crop}</Text>
              <Text style={text.small}>
                “{c.title}” by {c.author}, {c.license}, via Wikimedia Commons.
              </Text>
              <Text style={text.caption}>
                {CROP_PICTURE_CHANGES}.{same ? ` ${same}` : ""}
              </Text>
              {c.licenseUrl ? (
                <Link url={c.licenseUrl} label={`${c.license} license`} a11y={`Read the ${c.license} license`} />
              ) : null}
              <Link url={c.url} label="Photo on Wikimedia Commons" a11y={`Open the ${c.crop} photo on Wikimedia Commons`} />
            </View>
          );
        })}
      </Section>

      <Section title="Photos loaded for your crops" show={on("Crop photos")}>
        <Text style={text.small}>
          A crop you find by search has no photo in the app. When you are online, the app asks Wikipedia and Wikimedia Commons for one (only the crop’s scientific name is sent) and shows only photos under CC0, public domain, CC BY or CC BY-SA. Its credit shows under the crop when you choose crops. The photo is Wikimedia’s own small copy, not changed by us.
        </Text>
        {saved.length === 0 ? (
          <Text style={[text.small, { color: colors.muted }]}>No photos loaded on this phone yet.</Text>
        ) : (
          saved.map(({ sci, photo }) => (
            <View key={sci} style={styles.item}>
              <Text style={text.bodyStrong}>{sci}</Text>
              <Text style={text.small}>
                “{photo.title}” by {photo.author}, {photo.license}, via Wikimedia Commons.
              </Text>
              {photo.licenseUrl ? (
                <Link url={photo.licenseUrl} label={`${photo.license} license`} a11y={`Read the ${photo.license} license`} />
              ) : null}
              <Link url={photo.page} label="Photo on Wikimedia Commons" a11y={`Open the ${sci} photo on Wikimedia Commons`} />
            </View>
          ))
        )}
      </Section>

      <Section title="Map" show={on("Map")}>
        <Items items={MAP_CREDITS} />
      </Section>

      <Section title="Open-source software" show={on("Software")}>
        <Items items={SOFTWARE_CREDITS} />
      </Section>

      <Section title="Build and hosting tools" show={on("Build and hosting")}>
        <Items items={BUILD_CREDITS} />
      </Section>

      <Section title="Logo, icons and fonts" show={on("Logo, icons and fonts")}>
        <Items items={ARTWORK_CREDITS} />
      </Section>

      <Section title="SI tools" show={on("SI tools")}>
        <Items items={SI_CREDITS} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  cats: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  cat: { minHeight: 36, justifyContent: "center", paddingHorizontal: space.sm, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 4, backgroundColor: colors.surface },
  catOn: { backgroundColor: colors.green, borderColor: colors.green },
  catText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  catTextOn: { color: colors.white },
  item: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  link: { fontSize: 14, lineHeight: 20, color: colors.blue, textDecorationLine: "underline" },
  // 44 px tall to tap (#45); the link text keeps its size.
  linkRow: { minHeight: MIN_TOUCH, justifyContent: "center" },
});
