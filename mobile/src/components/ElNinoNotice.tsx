import { useState } from "react";
import { tr } from "../i18n/lang-store";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import context from "../../assets/data/context.json";
import { Notice } from "./Notice";
import { colors, MIN_TOUCH, space, text } from "./theme";

// This season's El Niño context (#150): the DOST-PAGASA advisory and the NOAA Oceanic Niño Index,
// both bundled in assets/data/context.json by the pipeline (#10). Context only: no score uses it.
// The wording follows the advisory's own summary in context.json; nothing here is computed.

export function ensoText(): { short: string; line: string; source: string; url: string; oniUrl: string } | null {
  const { oni, advisory } = context;
  if (!oni || !advisory) return null;
  const sign = oni.anomaly_c > 0 ? "+" : "";
  return {
    // Plain-language first line (#165); the full advisory wording stays one tap away.
    short: tr("El Niño year. PAGASA says a very strong El Niño will last into early 2027, with less rain than normal. Plan for dry months: these results come from past years, not a forecast."),
    line: `El Niño year: ${advisory.issuer} (${advisory.issued}) says "${advisory.title}", expected to last into the first half of 2027. For November 2026 it expected below normal to way below normal rain over most of the country. Plan for the dry months: the results here come from past records, not a forecast.`,
    source: `Sources: ${advisory.issuer} press release; ${oni.source}, ${oni.season} ${oni.year}: ${sign}${oni.anomaly_c} °C.`,
    url: advisory.url,
    oniUrl: oni.url,
  };
}

export function ElNinoNotice() {
  const [open, setOpen] = useState(false);
  const e = ensoText();
  if (!e) return null;
  return (
    <View style={styles.wrap}>
      <Notice tone="warn" icon="alert">
        {e.short}
      </Notice>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.link}
      >
        <Text style={[text.caption, styles.linkText]}>{open ? tr("Hide the advisory") : tr("Read the PAGASA advisory and sources")}</Text>
      </Pressable>
      {open ? (
        <>
          <Text style={text.small}>{e.line}</Text>
          <Text style={[text.caption, styles.muted]}>{e.source}</Text>
          <View style={styles.links}>
            <Pressable onPress={() => void Linking.openURL(e.url)} accessibilityRole="link" style={styles.link}>
              <Text style={[text.caption, styles.linkText]}>PAGASA press release</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(e.oniUrl)} accessibilityRole="link" style={styles.link}>
              <Text style={[text.caption, styles.linkText]}>NOAA ONI table</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md },
  link: { minHeight: MIN_TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { color: colors.green, textDecorationLine: "underline" },
  muted: { color: colors.muted },
});
