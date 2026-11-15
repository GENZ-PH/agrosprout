import { StyleSheet, Text } from "react-native";

import { text } from "./theme";

/** CLAUDE.md rule 6: the app supports, and does not replace, the farmer and the technician. */
export function Disclaimer() {
  return (
    <Text style={[text.caption, styles.small]}>
      This app supports, and does not replace, your own judgment and your agricultural technician.
    </Text>
  );
}

const styles = StyleSheet.create({ small: { fontSize: 12, lineHeight: 16 } });
