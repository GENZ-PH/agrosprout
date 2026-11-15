// What the SI notes are told from the NASA satellite and model checks (2026-11-15). The scores come
// from NASA POWER, FAO-56 and FAO Ecocrop only; these lines put the satellite numbers for the same
// lot beside them, so the SI notes and their sources name every NASA dataset the farmer sees.
// Each line says its dataset and period (CLAUDE.md rule 3). No location (rule 8). Pure TypeScript.
import type { MonthPct, SatelliteFiles } from "../data/satellite";

export type SourceLink = { label: string; url: string };

/** Official pages for each satellite dataset, for the "Where this comes from" list. */
export const SATELLITE_LINKS = {
  imerg: { label: "NASA GPM IMERG (rain seen from satellites)", url: "https://gpm.nasa.gov/data/imerg" },
  smap: { label: "NASA SMAP (soil moisture from a satellite)", url: "https://smap.jpl.nasa.gov/" },
  modis: { label: "NASA MODIS vegetation index (how green the land is)", url: "https://lpdaac.usgs.gov/products/mod13q1v061/" },
  fldas: { label: "NASA FLDAS land model (water in and on the soil)", url: "https://ldas.gsfc.nasa.gov/fldas" },
} satisfies Record<string, SourceLink>;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mm = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const pct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));
const ndvi = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100);

/** The calendar month (1-12) of the highest and lowest value, skipping missing months. */
function extremes<T>(rows: readonly T[], month: (r: T) => number, value: (r: T) => number | null): { hi: T; lo: T } | null {
  const ok = rows.filter((r) => value(r) != null);
  if (ok.length < 2) return null;
  const by = [...ok].sort((x, y) => (value(y) as number) - (value(x) as number) || month(x) - month(y));
  return { hi: by[0], lo: by[by.length - 1] };
}

const at = <T extends { month: number }>(rows: readonly T[] | undefined, m1: number) => rows?.find((r) => r.month === m1);

/** Lines for one calendar month (0-11): rain, soil moisture, greenness and run-off from NASA satellites and FLDAS. */
export function satelliteMonthFacts(f: SatelliteFiles | null, month: number): string[] {
  if (!f) return [];
  const m1 = month + 1;
  const out: string[] = [];
  const rain = at(f.imerg?.monthly, m1);
  if (f.imerg && rain && mm(rain.p50_mm) != null)
    out.push(
      `NASA GPM IMERG satellite rain, ${f.imerg.period}: typical year ${mm(rain.p50_mm)} mm (dry year ${mm(rain.p20_mm) ?? "?"} mm, wet year ${mm(rain.p80_mm) ?? "?"} mm).`,
    );
  const soil = at(f.smap?.monthly, m1);
  if (f.smap && soil && pct(soil.rootzone_m3m3.mean) != null)
    out.push(`NASA SMAP satellite soil moisture in the root zone, ${f.smap.period}: about ${pct(soil.rootzone_m3m3.mean)}% of the soil is water on average.`);
  const green = at(f.ndvi?.monthly, m1);
  if (f.ndvi && green && ndvi(green.p50) != null)
    out.push(`NASA MODIS greenness (NDVI, 0 bare to 1 very green), ${f.ndvi.period}: typical ${ndvi(green.p50)}.`);
  const runoff = at(f.fldas?.monthly.total_runoff_mm, m1);
  if (f.fldas && runoff && mm(runoff.p50) != null)
    out.push(`NASA FLDAS land model, ${f.fldas.period}: rain water running off the land in a typical year ${mm(runoff.p50)} mm.`);
  return out;
}

function pctLine(name: string, period: string, rows: readonly MonthPct[], fmt: (v: number | null) => number | null, unit: string, hiWord: string, loWord: string): string | null {
  const e = extremes(rows, (r) => r.month, (r) => fmt(r.p50));
  if (!e) return null;
  return `${name}, ${period}: ${hiWord} ${MON[e.hi.month - 1]} (typical ${fmt(e.hi.p50)}${unit}), ${loWord} ${MON[e.lo.month - 1]} (typical ${fmt(e.lo.p50)}${unit}).`;
}

/** Lines for the whole year: the wettest and driest months by satellite, soil moisture, greenness and run-off. */
export function satelliteYearFacts(f: SatelliteFiles | null): string[] {
  if (!f) return [];
  const out: string[] = [];
  if (f.imerg) {
    const e = extremes(f.imerg.monthly, (r) => r.month, (r) => mm(r.p50_mm));
    if (e)
      out.push(
        `NASA GPM IMERG satellite rain, ${f.imerg.period}: wettest month ${MON[e.hi.month - 1]} (typical ${mm(e.hi.p50_mm)} mm), driest month ${MON[e.lo.month - 1]} (typical ${mm(e.lo.p50_mm)} mm).`,
      );
    const both = f.imerg.monthly
      .map((r) => ({ sat: mm(r.p50_mm), pow: mm(at(f.imerg?.power_compare.monthly, r.month)?.power_p50_mm) }))
      .filter((x): x is { sat: number; pow: number } => x.sat != null && x.pow != null);
    if (both.length === 12) {
      const sat = both.reduce((s, x) => s + x.sat, 0);
      const pow = both.reduce((s, x) => s + x.pow, 0);
      out.push(`Typical rain of the 12 months added up: ${sat} mm from NASA GPM IMERG satellites, ${pow} mm from NASA POWER (what the scores use).`);
    }
  }
  if (f.smap) {
    const e = extremes(f.smap.monthly, (r) => r.month, (r) => pct(r.rootzone_m3m3.mean));
    if (e)
      out.push(
        `NASA SMAP satellite soil moisture in the root zone, ${f.smap.period}: wettest soil in ${MON[e.hi.month - 1]} (about ${pct(e.hi.rootzone_m3m3.mean)}% water), driest soil in ${MON[e.lo.month - 1]} (about ${pct(e.lo.rootzone_m3m3.mean)}% water).`,
      );
  }
  if (f.ndvi) {
    const l = pctLine("NASA MODIS greenness (NDVI, 0 bare to 1 very green)", f.ndvi.period, f.ndvi.monthly, ndvi, "", "greenest month", "least green month");
    if (l) out.push(l);
  }
  if (f.fldas) {
    const l = pctLine("NASA FLDAS land model, rain water running off the land", f.fldas.period, f.fldas.monthly.total_runoff_mm, mm, " mm", "most run-off in", "least run-off in");
    if (l) out.push(l);
  }
  return out;
}

/** The official pages of the datasets these lines came from, in the order the lines name them. */
export function satelliteLinks(f: SatelliteFiles | null): SourceLink[] {
  if (!f) return [];
  const out: SourceLink[] = [];
  if (f.imerg) out.push(SATELLITE_LINKS.imerg);
  if (f.smap) out.push(SATELLITE_LINKS.smap);
  if (f.ndvi) out.push(SATELLITE_LINKS.modis);
  if (f.fldas) out.push(SATELLITE_LINKS.fldas);
  return out;
}

/** The satellite pages for the datasets named in these lines (e.g. the facts an SI note was given). */
export function linksIn(lines: readonly string[] | undefined): SourceLink[] {
  const all = (lines ?? []).join(" ");
  const out: SourceLink[] = [];
  if (all.includes("IMERG")) out.push(SATELLITE_LINKS.imerg);
  if (all.includes("SMAP")) out.push(SATELLITE_LINKS.smap);
  if (all.includes("MODIS")) out.push(SATELLITE_LINKS.modis);
  if (all.includes("FLDAS")) out.push(SATELLITE_LINKS.fldas);
  return out;
}
