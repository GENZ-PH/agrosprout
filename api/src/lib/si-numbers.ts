// No invented numbers (CLAUDE.md rule 3) for SI text: every number in the SI answer must already
// be in the engine output the app sent. Pure functions, no Cloudflare or SDK imports.

/** Numbers as written in text: "12", "0.5", "1,200", "-3". Signs and percent marks are ignored. */
const NUMBER = /\d+(?:[.,]\d+)*/g;

/** "1,200" and "1200" are the same number; "0.50" and "0.5" too. */
export function normalizeNumber(raw: string): string {
  const plain = raw.replace(/,(?=\d{3}(?:\D|$))/g, "");
  const n = Number(plain.replace(",", "."));
  return Number.isFinite(n) ? String(n) : plain;
}

export function numbersIn(text: string): Set<string> {
  return new Set((text.match(NUMBER) ?? []).map(normalizeNumber));
}

/**
 * Numbers in `answer` that are not in `source`. Small counting words written as digits (1 to 12,
 * e.g. "3 things to check", "month 7") are allowed, since they carry no data claim.
 */
export function unsupportedNumbers(answer: string, source: string): string[] {
  const allowed = numbersIn(source);
  const out: string[] = [];
  for (const n of numbersIn(answer)) {
    const v = Number(n);
    if (allowed.has(n)) continue;
    if (Number.isInteger(v) && v >= 1 && v <= 12) continue;
    out.push(n);
  }
  return out;
}
