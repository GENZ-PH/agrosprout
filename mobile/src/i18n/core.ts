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

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

type Pattern = { re: RegExp; names: string[]; out: string };
const patterns: Partial<Record<Lang, Pattern[]>> = {};

/** Dictionary keys with {x} in them also match text the app built, like "Plant Corn." or "Lot 2". */
function patternsFor(lang: "tl" | "ceb"): Pattern[] {
  const ready = patterns[lang];
  if (ready) return ready;
  const out: Pattern[] = [];
  for (const [en, to] of Object.entries(DICT[lang])) {
    if (!/\{\w+\}/.test(en)) continue;
    const names: string[] = [];
    const body = en
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        names.push(m[1]);
        return "(.+?)";
      })
      .join("");
    out.push({ re: new RegExp(`^${body}$`), names, out: to });
  }
  // Longer patterns first, so "Plant {crop} in {month}." wins over "Plant {crop}."
  out.sort((a, b) => b.re.source.length - a.re.source.length);
  patterns[lang] = out;
  return out;
}

/** A filled-in part (a crop list, a month, a lot name): each word or list item looked up on its own. */
function part(lang: "tl" | "ceb", v: string, depth: number): string {
  const exact = DICT[lang][v];
  if (exact) return exact;
  if (depth < 2) {
    const viaPattern = matchPattern(lang, v, depth + 1);
    if (viaPattern) return viaPattern;
  }
  return v.replace(/[A-Z][a-z]+/g, (w) => DICT[lang][w] ?? w).replace(/\band\b/g, DICT[lang]["and"] ?? "and");
}

function matchPattern(lang: "tl" | "ceb", en: string, depth = 0): string | null {
  for (const p of patternsFor(lang)) {
    const m = p.re.exec(en);
    if (!m) continue;
    const vars: Record<string, string> = {};
    p.names.forEach((n, i) => (vars[n] = part(lang, m[i + 1], depth)));
    return fill(p.out, vars);
  }
  return null;
}

export function translate(lang: Lang, en: string, vars?: Record<string, string | number>): string {
  const out = lang === "en" ? en : (DICT[lang][en] ?? (vars ? en : (matchPattern(lang, en) ?? en)));
  return vars ? fill(out, vars) : out;
}
