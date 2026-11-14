import { Text } from "react-native";

import { useT } from "../i18n/lang-store";
import { text } from "./theme";

/** CLAUDE.md rule 6: the app supports, and does not replace, the farmer and the technician. */
export function Disclaimer() {
  const { t } = useT();
  return <Text style={text.caption}>{t("disclaimer")}</Text>;
}
