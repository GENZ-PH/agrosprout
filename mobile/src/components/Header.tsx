import { type Href, router } from "expo-router";
import { tr } from "../i18n/lang-store";
import { LanguageSwitch } from "./LanguageSwitch";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import { OfflineBadge } from "./OfflineBadge";
import { colors, MIN_TOUCH, space, text } from "./theme";

type Props = {
  title: string;
  /** "back" = chevron, "close" = X, false = no button. */
  leading?: "back" | "close" | false;
  /** Where the button goes when there is no history (e.g. the page was opened by URL on web). */
  fallbackHref?: Href;
  /** Right side, e.g. "Step 1 of 2". */
  right?: ReactNode;
  /** Between the title and the right side, e.g. the dashboard's lot tabs on a wide window. */
  middle?: ReactNode;
  /** true = the AgroSprout wordmark before the title (the dashboard). */
  logo?: boolean;
  /** Replaces the default back (history, else `fallbackHref`), e.g. the dashboard's leave dialog. */
  onBack?: () => void;
};

export function Header({ title, leading = "back", fallbackHref = "/", right, middle, logo = false, onBack }: Props) {
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref)));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {leading ? (
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={leading === "close" ? "Close" : "Back"}
            hitSlop={4}
            style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
          >
            <Icon name={leading} />
          </Pressable>
        ) : null}
        {logo ? (
          <Image
            source={require("../../assets/images/agrosprout-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="AgroSprout"
          />
        ) : null}
        {title ? (
          <Text style={[middle ? styles.titleInline : styles.title, logo && styles.titleSmall]} accessibilityRole="header" numberOfLines={middle ? 1 : 2}>
            {tr(title)}
          </Text>
        ) : logo ? (
          <View style={styles.flex} />
        ) : null}
        {middle ? <View style={styles.middle}>{middle}</View> : null}
        {typeof right === "string" ? <Text style={styles.right}>{tr(right)}</Text> : right}
        <LanguageSwitch />
      </View>
      {/* Only while the phone has no signal (#36). */}
      <OfflineBadge />
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the lot tabs that follow it, so the language menu opens over them.
  wrap: { gap: space.sm, zIndex: 30 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48 },
  lead: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    marginLeft: -10,
    borderRadius: MIN_TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.pressed },
  title: { ...text.title, flex: 1 },
  // Beside the lot tabs: as wide as its words, never squeezed.
  titleInline: { ...text.title, flexShrink: 0, marginRight: space.md },
  middle: { flex: 1, minWidth: 0 },
  flex: { flex: 1 },
  // The wordmark is 1400 x 320.
  logo: { height: 28, width: 28 * (1400 / 320), marginRight: space.sm },
  titleSmall: { fontSize: 18, lineHeight: 24 },
  right: { ...text.small, color: colors.muted },
});
