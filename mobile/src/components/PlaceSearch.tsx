import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, type TextStyle, useWindowDimensions, View } from "react-native";

import { PLACES } from "../data/places";
import { searchPlaces, type PlaceHit } from "../map/place-search-core";
import { Icon } from "./Icon";
import { colors, MIN_TOUCH, space, text } from "./theme";

// S1 place search (#196): a box at the top left of the lots map, between the back and Find me buttons. It searches
// the bundled town list on the phone; nothing typed is sent anywhere (rule 8). Picking a result moves the map.

type Props = {
  /** Wide window: a fixed-width box instead of filling the gap between the two round buttons. */
  wide: boolean;
  onPick: (hit: PlaceHit) => void;
};

/** Same shadow as the round map buttons on S1. */
const SHADOW = "0px 2px 8px rgba(0, 0, 0, 0.28)";
/** Back and Find me are 48 px wide, 10 px from the edges; the box keeps 8 px from each. */
const SIDE = 10 + 48 + 8;
/**
 * Web only: no browser focus ring inside the rounded box (Chrome draws `outline-style: auto` whatever the width);
 * the box's green border shows focus instead. React Native's types don't list "none", hence the cast.
 */
const NO_WEB_OUTLINE = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as TextStyle;

export function PlaceSearch({ wide, onPick }: Props) {
  const { width } = useWindowDimensions();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchPlaces(PLACES, query), [query]);
  const typed = query.trim().length > 0;
  // A list only once there is something to match: under 2 letters `searchPlaces` gives nothing to show.
  const showing = open && (hits.length > 0 || query.trim().length >= 2);

  const change = (q: string) => {
    setQuery(q);
    setActive(0);
    setOpen(true);
  };
  const pick = (hit: PlaceHit | undefined) => {
    if (!hit) return;
    if (hit.key !== "coords") setQuery(hit.title);
    setOpen(false);
    Keyboard.dismiss();
    input.current?.blur();
    onPick(hit);
  };
  const clear = () => {
    change("");
    input.current?.focus();
  };
  // Web keyboard: arrows move through the results, Escape closes them (Enter is onSubmitEditing).
  const onKey = (key: string) => {
    if (!showing || hits.length === 0) return;
    if (key === "ArrowDown") setActive((i) => (i + 1) % hits.length);
    else if (key === "ArrowUp") setActive((i) => (i - 1 + hits.length) % hits.length);
    else if (key === "Escape") setOpen(false);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, wide ? styles.wrapWide : styles.wrapPhone]}>
      {/* The green border is the focus ring, so the browser's own rectangle is turned off on the input. */}
      <View style={[styles.field, (focused || showing) && styles.fieldOpen]}>
        <Icon name="search" size={20} color={colors.muted} />
        <TextInput
          ref={input}
          value={query}
          onChangeText={change}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => pick(hits[active] ?? hits[0])}
          onKeyPress={(e) => onKey(e.nativeEvent.key)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={width < 360 ? "Search a place" : "Search a town or city"}
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search a place on the map"
          style={styles.input}
        />
        {typed ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      {showing ? (
        // On a phone the list uses the full width under the top row, so long names fit; it covers the zoom
        // buttons only while it is open.
        <View style={[styles.results, !wide && styles.resultsPhone]}>
          {/* Screen readers hear this one line after each keystroke, not every row. */}
          <Text style={[text.caption, styles.summary]} accessibilityLiveRegion="polite" aria-live="polite">
            {hits.length === 0
              ? "No place found. Try the town name, or tap Find me."
              : `${hits.length} ${hits.length === 1 ? "place" : "places"} found`}
          </Text>
          {hits.map((h, i) => (
            <Pressable
              key={h.key}
              onPress={() => pick(h)}
              accessibilityRole="button"
              accessibilityLabel={`${h.title}, ${h.detail}`}
              style={({ pressed }) => [styles.row, (pressed || i === active) && styles.pressed]}
            >
              <Icon name={h.key === "coords" ? "pin" : "search"} size={18} color={colors.muted} />
              <View style={styles.rowText}>
                <Text style={text.bodyStrong} numberOfLines={1}>
                  {h.title}
                </Text>
                <Text style={text.caption} numberOfLines={1}>
                  {h.detail}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 10, gap: space.sm },
  wrapPhone: { left: SIDE, right: SIDE },
  wrapWide: { left: SIDE, width: 360 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 48,
    paddingLeft: space.md + 2,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    boxShadow: SHADOW,
  },
  fieldOpen: { borderColor: colors.green },
  input: { ...text.body, ...NO_WEB_OUTLINE, flex: 1, minWidth: 0, height: 44, paddingVertical: 0 },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  pressed: { backgroundColor: colors.pressed },
  results: { overflow: "hidden", borderRadius: 16, backgroundColor: colors.surface, boxShadow: SHADOW },
  resultsPhone: { marginHorizontal: 10 - SIDE },
  summary: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1, minWidth: 0 },
});
