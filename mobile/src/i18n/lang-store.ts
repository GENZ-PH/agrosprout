import { useMemo } from "react";

import { createPersistedStore } from "../state/create-persisted-store";
import { type Lang, LANGS, monthNames, translator } from "./strings";

// The farmer's language choice, kept on the phone like the rest of the app state.
type LangState = { lang: Lang; setLang: (lang: Lang) => void };

export const useLangStore = createPersistedStore<LangState>("lang", (set) => ({
  lang: "en",
  setLang: (lang) => set({ lang: LANGS.includes(lang) ? lang : "en" }),
}));

/** `const { t, lang, months } = useT()` in any screen or component. */
export function useT() {
  const stored = useLangStore((s) => s.lang);
  const lang: Lang = LANGS.includes(stored) ? stored : "en";
  return useMemo(() => ({ lang, t: translator(lang), months: monthNames(lang) }), [lang]);
}
