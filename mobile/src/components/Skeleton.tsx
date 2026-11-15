import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View, type DimensionValue } from "react-native";

import { colors, radius, space, text } from "./theme";

// Switching lots (2026-11-15): the new lot's results fade in, and while its NASA data loads a
// skeleton in the shape of the suggestion stands in for it, so the page does not jump or go blank.

const native = Platform.OS !== "web";

/** Fades its children in once, on mount (a new lot tab mounts a new one). Skipped with reduced motion. */
export function FadeIn({ children }: { children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) v.setValue(1);
        else Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: native }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [v]);
  const style = { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] };
  return <Animated.View style={[styles.fade, style]}>{children}</Animated.View>;
}

function Bone({ w, h }: { w: DimensionValue; h: number }) {
  return <View style={[styles.bone, { width: w, height: h }]} />;
}

/** The suggestion's shape while a lot loads: kicker, title, crop pictures, the year strip, gains. */
export function LotSkeleton({ lotName }: { lotName: string }) {
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.wrap} accessibilityLabel={`Loading ${lotName}`} accessibilityLiveRegion="polite">
      <Text style={text.caption}>Getting NASA data for {lotName}…</Text>
      <Animated.View style={[styles.wrap, { opacity: pulse }]}>
        <Bone w={180} h={16} />
        <Bone w="70%" h={26} />
        <View style={styles.row}>
          <Bone w={56} h={56} />
          <Bone w={56} h={56} />
          <Bone w={56} h={56} />
        </View>
        <Bone w="100%" h={26} />
        <Bone w="100%" h={26} />
        <Bone w={140} h={18} />
        <Bone w="60%" h={14} />
        <Bone w="55%" h={14} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { gap: space.lg },
  wrap: { gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  bone: { borderRadius: radius.sm, backgroundColor: colors.border },
});
