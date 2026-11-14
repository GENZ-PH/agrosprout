import { monthShort } from "../lots/months-core";
import type { LotData } from "../types";

// The Offline notice (#36, docs/06-architecture.md "offline-first"): what the farmer reads when the
// phone has no signal. Plain logic, no React Native imports, so it runs in Node tests.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** The day a lot's NASA data was downloaded (live) or built (sample farm): its newest `retrieved` date. */
export function dataDate(data: Pick<LotData, "provenance">): string | null {
  let newest: string | null = null;
  for (const p of data.provenance) {
    const day = ISO_DAY.exec(p.retrieved)?.[0] ?? null;
    if (day && (newest === null || day > newest)) newest = day;
  }
  return newest;
}

function parts(iso: string): { d: number; m: number; y: number } {
  const [, y, m, d] = ISO_DAY.exec(iso) as RegExpExecArray;
  return { d: Number(d), m: Number(m), y: Number(y) };
}

/** "14 Nov 2026", "13–14 Nov 2026", "30 Oct – 2 Nov 2026" or "30 Dec 2025 – 2 Jan 2026"; `null` for no dates. */
export function dateRangeText(dates: readonly string[]): string | null {
  const days = [...new Set(dates.filter((d) => ISO_DAY.test(d)).map((d) => (ISO_DAY.exec(d) as RegExpExecArray)[0]))].sort();
  if (days.length === 0) return null;
  const a = parts(days[0]);
  const b = parts(days[days.length - 1]);
  const day = (p: typeof a) => `${p.d} ${monthShort(p.m)}`;
  if (days.length === 1) return `${day(a)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${monthShort(a.m)} ${a.y}`;
  if (a.y === b.y) return `${day(a)} – ${day(b)} ${a.y}`;
  return `${day(a)} ${a.y} – ${day(b)} ${b.y}`;
}

const listAnd = (xs: readonly string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/**
 * The text after "Offline." `dates`: each lot's data date (`dataDate`), or `null` while they are
 * still being read. `pending`: names of lots still waiting for their NASA data.
 */
export function offlineDetail({ dates, pending }: { dates: readonly string[] | null; pending: readonly string[] }): string {
  const out: string[] = [];
  if (dates !== null) {
    const when = dateRangeText(dates);
    if (when) out.push(`Your results use the NASA data saved on this phone, last updated ${when}.`);
    else if (pending.length === 0) out.push("The map and new NASA data need signal.");
  }
  if (pending.length === 1) out.push(`${pending[0]} gets its NASA data when the phone is back online.`);
  else if (pending.length > 1) out.push(`${listAnd(pending)} get their NASA data when the phone is back online.`);
  return out.join(" ");
}
