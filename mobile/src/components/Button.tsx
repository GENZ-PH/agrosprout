import { type Href, router } from "expo-router";
import { tr } from "../i18n/lang-store";
import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors, MIN_TOUCH, radius, space } from "./theme";

type Variant = "primary" | "secondary" | "quiet" | "dashed" | "link" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  /** Navigates with expo-router instead of calling `onPress`. Ignored while `disabled`. */
  href?: Href;
  variant?: Variant;
  /** lg = the screen's main action (56), md = everything else (48). */
  size?: "lg" | "md";
  icon?: IconName;
  /** An icon after the label, e.g. a chevron on a "Next" button. */
  iconAfter?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const LOOK: Record<Variant, { bg: string; pressed: string; fg: string; border?: string; dashed?: boolean }> = {
  primary: { bg: colors.green, pressed: colors.greenPressed, fg: colors.white },
  secondary: { bg: colors.surface, pressed: colors.greenTint, fg: colors.green, border: colors.green },
  quiet: { bg: colors.surface, pressed: colors.pressed, fg: colors.ink, border: colors.borderStrong },
  dashed: { bg: "transparent", pressed: colors.pressed, fg: colors.ink, border: colors.dashed, dashed: true },
  link: { bg: "transparent", pressed: colors.pressed, fg: colors.green },
  danger: { bg: colors.danger, pressed: colors.dangerPressed, fg: colors.white },
};

export function Button({
  label,
  onPress,
  href,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const look = LOOK[variant];
  const fg = disabled ? colors.muted : look.fg;
  const isLink = variant === "link";

  // Navigate with router.push rather than <Link asChild>: on web, Link drops the
  // Pressable's style function and the button loses its background.
  const handlePress = disabled ? undefined : href ? () => router.push(href) : onPress;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole={href && !disabled ? "link" : "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        isLink ? styles.link : { minHeight: size === "lg" ? 56 : 48 },
        {
          backgroundColor: disabled && !isLink ? colors.disabledBg : pressed ? look.pressed : look.bg,
          borderColor: disabled ? colors.disabledBg : look.border ?? "transparent",
          borderWidth: look.border ? 1.5 : 0,
          borderStyle: look.dashed ? "dashed" : "solid",
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text
        style={[
          styles.label,
          { color: fg, fontSize: size === "lg" ? 18 : 16 },
          isLink && styles.linkLabel,
        ]}
      >
        {tr(label)}
      </Text>
      {iconAfter ? <Icon name={iconAfter} size={20} color={fg} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  link: {
    minHeight: MIN_TOUCH,
    alignSelf: "flex-start",
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  label: { fontWeight: "600", textAlign: "center" },
  linkLabel: { fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
});
