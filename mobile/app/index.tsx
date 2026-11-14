import { StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Icon } from "../src/components/Icon";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { colors, space, text } from "../src/components/theme";

// S0 Welcome (#21, docs/11-user-flow.md). No login, no account (D12).
// TODO(#18): when the farm store lands, send a returning user (a saved farm with lots)
// straight to the dashboard: `if (hasSavedFarm) return <Redirect href="/dashboard" />`.
export default function WelcomeScreen() {
  return (
    <Screen
      footer={
        <>
          <Button label="Start" href="/lots" size="lg" />
          <Disclaimer />
        </>
      }
    >
      <View style={styles.brand}>
        <Icon name="sprout" size={34} color={colors.green} strokeWidth={1.8} />
        <Text style={styles.brandName}>AgriResilience</Text>
      </View>

      <View style={styles.middle}>
        <Text style={text.display} accessibilityRole="header">
          Plan your crops with NASA climate data
        </Text>
        <Text style={[text.body, styles.lead]}>
          Draw your lots, tell us what you plant, and compare crop plans for each lot.
        </Text>
        <Notice icon="lock">Your farm information stays on this phone. No sign-up, no account.</Notice>
        <Text style={[text.small, { color: colors.muted }]}>
          You need signal to load the map and the climate data. Your saved results work offline.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: space.xl },
  brandName: { ...text.title, fontSize: 24 },
  middle: { flexGrow: 1, justifyContent: "center", gap: 20, paddingVertical: space.xl },
  lead: { fontSize: 18, lineHeight: 27, color: colors.muted },
});
