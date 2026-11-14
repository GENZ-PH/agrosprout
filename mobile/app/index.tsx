import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Icon } from "../src/components/Icon";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { Notice } from "../src/components/Notice";
import { Screen, useWide } from "../src/components/Screen";
import { colors, radius, space, text } from "../src/components/theme";
import { useT } from "../src/i18n/lang-store";
import { isDemoFarm, loadDemoFarm } from "../src/state/demo-farm";
import { useFarmStore } from "../src/state/farm-store";

// S0 Welcome (#21, docs/11-user-flow.md). No login, no account (D12).
// One column on a phone with the buttons pinned at the bottom; on a laptop the words sit on
// the left and the actions on the right.
export default function WelcomeScreen() {
  const lots = useFarmStore((s) => s.lots);
  const { t } = useT();
  const wide = useWide();
  // The demo never replaces a farm the farmer has drawn: it is offered only on an empty
  // farm, or when the saved farm already is the demo.
  const demoAllowed = lots.length === 0 || isDemoFarm(lots);
  const hasOwnFarm = lots.length > 0 && !isDemoFarm(lots);
  // Starting your own farm after a look at the demo begins from an empty farm.
  const startOwn = () => {
    if (isDemoFarm(lots)) void useFarmStore.getState().clearAll();
    router.push("/lots");
  };
  const openDemo = () => {
    loadDemoFarm();
    router.push("/dashboard");
  };

  const brand = (
    <View style={styles.brand}>
      <Icon name="sprout" size={34} color={colors.green} strokeWidth={1.8} />
      <Text style={styles.brandName}>AgriResilience</Text>
    </View>
  );
  const words = (
    <>
      <Text style={[text.display, wide && styles.displayWide]} accessibilityRole="header">
        {t("welcome.title")}
      </Text>
      <Text style={[text.body, styles.lead]}>{t("welcome.lead")}</Text>
    </>
  );
  const assurances = (
    <>
      <Notice icon="lock">{t("welcome.private")}</Notice>
      <Text style={[text.small, { color: colors.muted }]}>{t("welcome.signal")}</Text>
    </>
  );
  const actions = (
    <>
      {hasOwnFarm ? <Button label={t("welcome.open")} href="/dashboard" size="lg" /> : <Button label={t("welcome.start")} onPress={startOwn} size="lg" />}
      {demoAllowed ? <Button label={t("welcome.demo")} variant="secondary" onPress={openDemo} /> : null}
    </>
  );

  if (wide) {
    return (
      <Screen wide footer={<Disclaimer />}>
        <View style={styles.topRow}>
          {brand}
          <LanguageSwitch />
        </View>
        <View style={styles.columns}>
          <View style={styles.left}>{words}</View>
          <View style={styles.panel}>
            {actions}
            {assurances}
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {actions}
          <Disclaimer />
        </>
      }
    >
      {brand}
      <LanguageSwitch />
      <View style={styles.middle}>
        {words}
        {assurances}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: space.xl },
  brandName: { ...text.title, fontSize: 24 },
  middle: { flexGrow: 1, justifyContent: "center", gap: 20, paddingVertical: space.xl },
  lead: { fontSize: 18, lineHeight: 27, color: colors.muted },
  topRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.lg },
  columns: { flexGrow: 1, flexDirection: "row", alignItems: "center", gap: space.xl * 2, paddingVertical: space.xl },
  left: { flex: 1.3, gap: 20 },
  displayWide: { fontSize: 44, lineHeight: 52 },
  panel: {
    flex: 1,
    gap: space.md,
    padding: space.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
});
