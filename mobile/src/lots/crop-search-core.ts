import type { CropLibrary, EcocropNames } from "../types";
import { cropShortName } from "./crop-picks";

// S2 crop search (#152): one box finds a crop by English, local or scientific name in our crop list and in the
// FAO Ecocrop names, offline. No React Native imports, so it runs in Node tests.

interface EntryBase {
  /** Every name the entry can be found by, main names first. */
  names: string[];
  /** How many of the first `names` are main names: our crop's short and local names, or Ecocrop's first name. */
  main: number;
  /** `" " + normalizeName(name)` for each of `names`, worked out once. */
  keys: string[];
  sci: string | null;
}
export type SearchEntry =
  | (EntryBase & { kind: "library"; crop_id: string; title: string; local: string | null })
  | (EntryBase & { kind: "ecocrop"; code: string; sci: string });

export interface SearchResult {
  entry: SearchEntry;
  /** Name to show: our short crop name, or the Ecocrop name that matched (capitalized). */
  title: string;
  /** The name that matched, when the row doesn't already show it (e.g. "camote" for Sweet potato), else null. */
  matched: string | null;
}
export interface SearchOutput {
  results: SearchResult[];
  /** Typed text to offer as "Add “…”" (saved as `other:<text>`), or null when a result already has that name. */
  add: string | null;
}

export const SEARCH_MAX = 8;
export const ADD_MAX_CHARS = 40;

/**
 * Lower case, accents and apostrophes removed, anything else but letters and digits turned into single spaces,
 * and the botanical rank words "ssp.", "subsp." and "var." dropped.
 */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/(^| )(ssp|subsp|var)(?= |$)/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function uniqueNames(names: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw?.trim();
    const key = name ? normalizeName(name) : "";
    if (name && key && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

const keysOf = (names: string[]) => names.map((n) => ` ${normalizeName(n)}`);

/** "Corn (maize, grain)" → ["maize", "grain"]; "Batong (balatong)" → ["Batong", "balatong"] with the part before. */
const bracketParts = (s: string) => (s.match(/\(([^)]*)\)/)?.[1] ?? "").split(",");

/** Our crops first (library order), then every Ecocrop species. `index` null = our crops only. */
export function buildSearchEntries(library: CropLibrary, index: EcocropNames | null): SearchEntry[] {
  const ours: SearchEntry[] = library.crops.map((crop) => {
    const title = cropShortName(crop);
    const eco = index?.library[crop.id];
    const local = crop.local_name;
    const mainNames = uniqueNames([title, local?.replace(/\s*\(.*\)\s*$/, ""), ...(local ? bracketParts(local) : [])]);
    const names = uniqueNames([...mainNames, ...bracketParts(crop.name), ...(eco?.names ?? []), eco?.sci]);
    return {
      kind: "library",
      crop_id: crop.id,
      title,
      local,
      sci: eco?.sci ?? null,
      names,
      main: mainNames.length,
      keys: keysOf(names),
    };
  });
  // An Ecocrop name that is also one of our crops' names ("mung bean" is Ecocrop's name for black gram too) finds
  // only our crop, so a farmer never picks an unscored look-alike of a crop we score.
  const ourNames = new Set(ours.flatMap((e) => e.names.map(normalizeName)));
  const species: SearchEntry[] = (index?.species ?? []).map((s) => {
    const names = uniqueNames([...s.names.filter((n) => !ourNames.has(normalizeName(n))), s.sci]);
    return { kind: "ecocrop", code: s.code, sci: s.sci, names, main: 1, keys: keysOf(names) };
  });
  return [...ours, ...species];
}

interface Hit {
  result: SearchResult;
  tier: number;
  order: number;
}

/**
 * Shorter queries only match the start of the main name: "s" would otherwise find Corn by its rare name "sila",
 * or an acacia by the second word of its scientific name.
 */
const MIN_CHARS_FOR_ANY_WORD = 2;

function hitOf(entry: SearchEntry, q: string, order: number): Hit | null {
  const key = ` ${q}`;
  const short = q.length < MIN_CHARS_FOR_ANY_WORD;
  const keys = short ? entry.keys.slice(0, entry.main) : entry.keys;
  let best = keys.findIndex((k) => k === key);
  const exact = best >= 0;
  if (!exact) best = keys.findIndex((k) => (short ? k.startsWith(key) : k.includes(key)));
  if (best < 0) return null;
  const tier = exact ? 0 : best < entry.main ? 1 : 2;
  const name = entry.names[best];
  let title: string;
  let shown: (string | null)[];
  if (entry.kind === "library") {
    title = entry.title;
    shown = [title, entry.local];
  } else {
    const common = entry.names.slice(0, -1); // the last name is `sci`
    title = best < common.length ? capitalize(name) : common.length ? capitalize(common[0]) : entry.sci;
    shown = [title, entry.sci];
  }
  // Shown already when the row's title, local name or scientific name contains the matched words.
  const words = ` ${normalizeName(name)} `;
  const isShown = shown.some((s) => s !== null && ` ${normalizeName(s)} `.includes(words));
  return { result: { entry, title, matched: isShown ? null : name }, tier, order };
}

/**
 * Empty query: our crops in library order, no cap. Otherwise at most `max` results: our crops first, then
 * Ecocrop; within each, an exact name, then a match on the main name, then other names; then A–Z.
 * A name matches when one of its words, or a run of its words, starts with the query (one letter: the start of the main name only).
 */
export function searchCrops(entries: readonly SearchEntry[], query: string, max = SEARCH_MAX): SearchOutput {
  const q = normalizeName(query);
  if (!q) {
    const results: SearchResult[] = [];
    for (const entry of entries) if (entry.kind === "library") results.push({ entry, title: entry.title, matched: null });
    return { results, add: null };
  }
  const hits: Hit[] = [];
  entries.forEach((e, i) => {
    const hit = hitOf(e, q, i);
    if (hit) hits.push(hit);
  });
  const kindRank = (h: Hit) => (h.result.entry.kind === "library" ? 0 : 1);
  hits.sort(
    (a, b) =>
      kindRank(a) - kindRank(b) ||
      a.tier - b.tier ||
      normalizeName(a.result.title).localeCompare(normalizeName(b.result.title)) ||
      a.order - b.order,
  );
  const results = hits.slice(0, max).map((h) => h.result);
  const clean = query.trim().replace(/\s+/g, " ").slice(0, ADD_MAX_CHARS).trim();
  const named = results.some((r) => r.entry.keys.includes(` ${q}`));
  return { results, add: clean && !named ? clean : null };
}

/**
 * What Enter (the keyboard's Done key) chooses: the first result whose name is exactly what was typed, or the
 * typed name when nothing matched. Otherwise nothing, so a farmer who only wants the keyboard gone never
 * replaces the lot's crop by accident.
 */
export function enterChoice(out: SearchOutput, query: string): SearchResult | "add" | null {
  const q = normalizeName(query);
  if (!q) return null;
  const exact = out.results.find((r) => r.entry.keys.includes(` ${q}`));
  if (exact) return exact;
  return out.results.length === 0 && out.add ? "add" : null;
}

/** One short line for screen readers after each keystroke, instead of every row again. Empty while browsing. */
export function searchSummary(count: number, addName: string | null, browsing: boolean): string {
  if (browsing) return "";
  const asTyped = addName ? `choose “${addName}” as typed.` : "";
  if (count === 0) return asTyped ? `No crop found. You can ${asTyped}` : "No crop found.";
  const found = `${count} crop${count === 1 ? "" : "s"} found.`;
  return asTyped ? `${found} You can also ${asTyped}` : found;
}
