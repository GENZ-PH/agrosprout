import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLangStore, useT } from "../i18n/lang-store";
import { LANG_NAME, LANGS } from "../i18n/strings";
import { colors, radius, text } from "./theme";

/** English, Filipino or Bisaya. The choice is saved on the phone. */
export function LanguageSwitch() {
  const { lang, t } = useT();
  const setLang = useLangStore((s) => s.setLang);
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t("lang.label")}>
      {LANGS.map((l) => {
        const on = l === lang;
        return (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.item, on ? styles.on : pressed && styles.pressed]}
          >
            <Text style={[styles.label, on && styles.onLabel]}>{LANG_NAME[l]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignSelf: "flex-start", padding: 3, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  item: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  on: { backgroundColor: colors.ink },
  pressed: { backgroundColor: colors.pressed },
  label: { ...text.small, fontWeight: "600" },
  onLabel: { color: colors.white },
});
