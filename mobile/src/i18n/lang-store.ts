import { createPersistedStore } from "../state/create-persisted-store";
import { translate, type Lang } from "./core";

// The app language the farmer picked (2026-11-15), saved on the phone. English is the default.
type LangState = { lang: Lang; setLang: (lang: Lang) => void };

export const useLangStore = createPersistedStore<LangState>("language", (set) => ({
  lang: "en",
  setLang: (lang) => set({ lang }),
}));

/** The words in the current language (English when there is no translation yet). */
export function tr(en: string, vars?: Record<string, string | number>): string {
  return translate(useLangStore.getState().lang, en, vars);
}

/** Re-renders the caller when the language changes. */
export const useLang = () => useLangStore((s) => s.lang);
