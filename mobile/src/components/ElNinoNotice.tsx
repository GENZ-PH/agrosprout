import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import context from "../../assets/data/context.json";
import { Notice } from "./Notice";
import { colors, MIN_TOUCH, space, text } from "./theme";

// This season's El Niño context (#150): the DOST-PAGASA advisory and the NOAA Oceanic Niño Index,
// both bundled in assets/data/context.json by the pipeline (#10). Context only: no score uses it.
// The wording follows the advisory's own summary in context.json; nothing here is computed.

export function ensoText(): { line: string; source: string; url: string } | null {
  const { oni, advisory } = context;
  if (!oni || !advisory) return null;
  const sign = oni.anomaly_c > 0 ? "+" : "";
  return {
    line: `El Niño year: ${advisory.issuer} (${advisory.issued}) says "${advisory.title}", expected to last into the first half of 2027. For November 2026 it expected below normal to way below normal rain over most of the country. Plan for the dry months: the results here come from past records, not a forecast.`,
    source: `Sources: ${advisory.issuer} press release; ${oni.source}, ${oni.season} ${oni.year}: ${sign}${oni.anomaly_c} °C.`,
    url: advisory.url,
  };
}

export function ElNinoNotice() {
  const e = ensoText();
  if (!e) return null;
  return (
    <View style={styles.wrap}>
      <Notice tone="warn" icon="alert">
        {e.line}
      </Notice>
      <Pressable onPress={() => void Linking.openURL(e.url)} accessibilityRole="link" style={styles.link}>
        <Text style={[text.caption, styles.muted]}>{e.source}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  link: { minHeight: MIN_TOUCH, justifyContent: "center" },
  muted: { color: colors.muted },
});
