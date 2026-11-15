import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LANGS } from "../i18n/core";
import { tr, useLang, useLangStore } from "../i18n/lang-store";
import { colors, MIN_TOUCH, radius, space } from "./theme";

// The language switch in every header (2026-11-15): a small button with the current language that
// opens English, Tagalog and Bisaya. The whole app redraws in the chosen language.
export function LanguageSwitch() {
  const lang = useLang();
  const setLang = useLangStore((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.key === lang) ?? LANGS[0];
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${tr("Language")}: ${current.label}`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{current.short}</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {LANGS.map((l) => (
            <Pressable
              key={l.key}
              onPress={() => {
                setOpen(false);
                setLang(l.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: l.key === lang }}
              style={({ pressed }) => [styles.item, l.key === lang && styles.itemOn, pressed && styles.pressed]}
            >
              <Text style={[styles.itemText, l.key === lang && styles.itemTextOn]}>{l.label}</Text>
            </Pressable>
          ))}
          <Text style={styles.note}>{tr("Translated with SI. The team is checking it.")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", zIndex: 20 },
  button: {
    minWidth: MIN_TOUCH,
    height: 36,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 13, fontWeight: "700", color: colors.green },
  pressed: { opacity: 0.7 },
  menu: {
    position: "absolute",
    top: 40,
    right: 0,
    width: 200,
    padding: space.xs,
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  item: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm, borderRadius: radius.sm },
  itemOn: { backgroundColor: colors.greenTint },
  itemText: { fontSize: 15, color: colors.ink },
  itemTextOn: { fontWeight: "700", color: colors.green },
  note: { fontSize: 11, lineHeight: 15, color: colors.muted, paddingHorizontal: space.sm, paddingTop: 2 },
});
