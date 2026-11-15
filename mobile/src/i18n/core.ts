// App languages (2026-11-15, D9): English (default), Tagalog and Bisaya (Cebuano). Translations are
// keyed by the English text, so anything not translated yet stays in English instead of breaking.
// Pure TypeScript, no React Native imports. The Tagalog and Bisaya were written with SI (Claude) and
// are being checked by the team; the app says so next to the language switch.
import { DICT } from "./dict";

export type Lang = "en" | "tl" | "ceb";

export const LANGS: { key: Lang; label: string; short: string }[] = [
  { key: "en", label: "English", short: "EN" },
  { key: "tl", label: "Tagalog", short: "TL" },
  { key: "ceb", label: "Bisaya", short: "BIS" },
];

/** What the SI is told to write in. */
export const SI_LANGUAGE: Record<Lang, string> = { en: "English", tl: "Tagalog (Filipino)", ceb: "Cebuano (Bisaya)" };

export function translate(lang: Lang, en: string, vars?: Record<string, string | number>): string {
  const out = lang === "en" ? en : (DICT[lang][en] ?? en);
  return vars ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : out;
}
