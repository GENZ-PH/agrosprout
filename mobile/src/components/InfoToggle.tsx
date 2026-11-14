import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import type { ExplainerId } from "../content/explainers";
import { Icon } from "./Icon";
import { ExplainerBox } from "./InfoCard";
import { colors, MIN_TOUCH, radius, space } from "./theme";

/** Which explainer a card's ⓘ opens, and the years for its `{period}`. */
export type InfoRef = { id: ExplainerId; period: string };

/**
 * The ⓘ "What am I looking at?" button for cards that are not an InfoCard (#29, #31): the
 * button goes in the card's header row, the box right under the header.
 */
export function useExplainer(info: InfoRef | undefined, title: string): { button: ReactNode; box: ReactNode } {
  const [open, setOpen] = useState(false);
  if (!info) return { button: null, box: null };
  return {
    button: (
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`What am I looking at? About ${title}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.info, pressed && styles.pressed]}
      >
        <Icon name="info" size={22} color={colors.green} />
      </Pressable>
    ),
    box: open ? <ExplainerBox id={info.id} period={info.period} /> : null,
  };
}

const styles = StyleSheet.create({
  info: { width: MIN_TOUCH, height: MIN_TOUCH, marginRight: -space.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  pressed: { backgroundColor: colors.pressed },
});
