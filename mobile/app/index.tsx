import { Redirect, router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Notice } from "../src/components/Notice";
import { Screen } from "../src/components/Screen";
import { colors, space, text } from "../src/components/theme";
import { DEMO_FARM, isDemoFarm } from "../src/state/demo-farm-core";
import { useFarmStore } from "../src/state/farm-store";

// S0 Welcome (#21, docs/11-user-flow.md). No login, no account (D12).
// A returning user goes straight to the dashboard: someone who finished onboarding once
// (a lot with crops). A farmer still in onboarding (a lot drawn, no crops yet) who goes
// Back from S1 stays here. The root layout renders screens only after the saved farm has
// loaded, so `lots` is real here.
// "See a sample farm" (#144) loads two fictional lots with bundled NASA POWER data, so results
// show with no drawing and no signal. It is offered only on an empty farm or when the saved farm
// already is the sample, so it never replaces a farm the farmer drew. The sample doesn't count
// as a returning farm: Start stays reachable and begins from an empty farm.
export default function WelcomeScreen() {
  const lots = useFarmStore((s) => s.lots);
  const sample = isDemoFarm(lots);
  const returning = !sample && lots.some((l) => l.crops.length > 0);
  if (returning) return <Redirect href="/dashboard" />;
  const demoAllowed = lots.length === 0 || sample;
  const start = () => {
    if (sample) useFarmStore.getState().clearAll();
    router.push("/lots");
  };
  const openSample = () => {
    useFarmStore.getState().replaceFarm(DEMO_FARM);
    router.push("/dashboard");
  };
  return (
    <Screen
      footer={
        <>
          <Button label="Start" onPress={start} size="lg" />
          {demoAllowed ? <Button label="See a sample farm" variant="secondary" onPress={openSample} /> : null}
          <Disclaimer />
        </>
      }
    >
      <View style={styles.brand}>
        {/* Team wordmark (#177), from the team brand folder; aspect 1400 x 320. */}
        <Image
          source={require("../assets/images/agrosprout-logo.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="AgroSprout"
        />
      </View>

      <View style={styles.middle}>
        <Text style={text.display} accessibilityRole="header">
          Plan your crops with NASA climate data
        </Text>
        <Text style={[text.body, styles.lead]}>
          Draw your lots, tell us what you plant, and compare crop plans for each lot.
        </Text>
        <Notice icon="lock" small>Your farm information stays on this phone. No sign-up, no account.</Notice>
        <Text style={[text.caption, { color: colors.muted }]}>
          You need signal to load the map and the climate data. Your saved results work offline. The sample farm is
          made up and needs no signal.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: space.xl },
  logo: { width: 220, height: 220 * (320 / 1400) },
  middle: { flexGrow: 1, justifyContent: "center", gap: 20, paddingVertical: space.xl },
  lead: { fontSize: 18, lineHeight: 27, color: colors.muted },
});
