// The lot cutout card (#134): the selected lot's own shape, cut out with no map under it, drawn
// twice side by side, "Now" (option A, your crops) and the best other option, and filled by one
// data layer. Like a two-panel choropleth, but one lot and one solid color per panel.
// No React Native imports, so `npm test` runs it in Node. The card itself is LotCutoutCard.tsx.
//
// No invented numbers (CLAUDE.md rule 3):
// - One value per lot. Nothing we have varies inside a lot, so a panel is never split into zones.
// - Soil health is the engine's Soil Health Index (soilHealth.ts): a relative indicator from this
//   model, never "carbon", "SOC" or a % change in soil (gap F1). Its color only says whether the
//   line goes up, stays level or goes down from the start.
// - Crop fit uses the engine's own levels (cropFit.ts), the same colors as the farm map.
// - Wetness and rain have no sourced class breaks, so their color is a continuous shade over the
//   value's own range (0 dry to 1 saturated; share of the year's dry-year rain), with no cut-offs.
import type { FitLevel, OptionKey, RotationOption, SoilHealthResult } from "../engine";
import { cropFit } from "../engine/cropFit";
import type { LotAnalysis } from "../engine/analyze";
import type { CropLibrary, LonLat, Lot, LotCrop } from "../types";
import { FIT_COLORS, lotFitLevel, NO_RESULT_COLOR } from "./farm-map-core";
import { FIT_LABELS } from "./recommendations-core";
import { cropList, monthCells, OPTION_LABELS } from "./soil-health-chart-core";
import { colors } from "./theme";

export type CutoutLayer = "soil" | "fit" | "wetness" | "rain";

export const CUTOUT_LAYERS: readonly { key: CutoutLayer; label: string }[] = [
  { key: "soil", label: "Soil health" },
  { key: "fit", label: "Crop fit" },
  { key: "wetness", label: "Root-zone wetness" },
  { key: "rain", label: "Rain (dry year)" },
];

// ---------------------------------------------------------------------------
// Shape: lon/lat outline -> SVG path in a box
// ---------------------------------------------------------------------------

export interface CutoutShape {
  /** SVG path ("M x y L ... Z") of the lot's outer ring, fitted to the box. */
  path: string;
  /** Middle of the drawn shape's bounds, for the value label. */
  labelX: number;
  labelY: number;
}

/**
 * The lot's outer ring fitted inside a `width` x `height` box with `pad` on every side, north up.
 * Equirectangular: x = lon x cos(mid latitude), y = lat, which keeps the shape true at lot size.
 * `null` when the ring has fewer than 3 distinct points or no size.
 */
export function cutoutShape(ring: readonly LonLat[], width: number, height: number, pad: number): CutoutShape | null {
  const pts = ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]);
  if (pts.length < 3 || width <= 2 * pad || height <= 2 * pad) return null;
  const lats = pts.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xy = pts.map(([lon, lat]) => [lon * k, lat] as const);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = x1 - x0;
  const h = y1 - y0;
  // Shoelace area: a flat line (all points in a row) is not a shape.
  const area = xy.reduce((a, [x, y], i) => {
    const [nx, ny] = xy[(i + 1) % xy.length];
    return a + x * ny - nx * y;
  }, 0);
  if (w <= 0 || h <= 0 || Math.abs(area) < 1e-18) return null;
  const scale = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  // Centre the shape in the box.
  const offX = (width - w * scale) / 2;
  const offY = (height - h * scale) / 2;
  const px = (x: number) => offX + (x - x0) * scale;
  const py = (y: number) => offY + (y1 - y) * scale;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const path = xy.map(([x, y], i) => `${i ? "L" : "M"}${r1(px(x))} ${r1(py(y))}`).join(" ") + " Z";
  return { path, labelX: r1(width / 2), labelY: r1(height / 2) };
}

// ---------------------------------------------------------------------------
// Which two options: Now (A) and the best other option
// ---------------------------------------------------------------------------

/**
 * The option shown next to "Now": the highest total among B, C and D (the first one on a tie,
 * in the engine's order). `null` when none has a total.
 */
export function bestOtherOption<T extends Pick<RotationOption, "key" | "total">>(options: readonly T[]): T | null {
  let best: T | null = null;
  for (const o of options) {
    if (o.key === "A" || o.total === null) continue;
    if (!best || (best.total as number) < o.total) best = o;
  }
  return best;
}

// ---------------------------------------------------------------------------
// One panel's value for a layer
// ---------------------------------------------------------------------------

export interface PanelValue {
  /** Fill of the lot shape. */
  color: string;
  /** Short value on the shape, e.g. "56", "Watch out", "0.86", "1,240 mm". */
  value: string;
  /** One line under the panel saying what the value is. */
  detail: string;
  /** Class name in the legend, for the screen-reader summary. */
  className: string;
}

export const NO_DATA: PanelValue = { color: NO_RESULT_COLOR, value: "No data", detail: "Not enough data for this option.", className: "No data" };

/** Lighter end of the wetness and rain shades. A mix of theme tokens, not a new color. */
const SHADE_LOW = colors.bg;
const SHADE_HIGH = colors.blue;

/** `a` to `b` by `t` (0-1), as #RRGGBB. */
export function mixColor(a: string, b: string, t: number): string {
  const c = Math.min(1, Math.max(0, t));
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * c));
  return `#${out.map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export const shade = (t: number) => mixColor(SHADE_LOW, SHADE_HIGH, t);

/** Soil health direction classes, in legend order. Only the sign of the change, no cut-offs. */
export const SOIL_CLASSES = {
  up: { color: colors.green, label: "Goes up" },
  level: { color: colors.muted, label: "Stays level" },
  down: { color: colors.amber, label: "Goes down" },
} as const;

export function soilPanel(result: SoilHealthResult, key: OptionKey): PanelValue {
  const t = result.options.find((o) => o.option_key === key)?.trajectory ?? null;
  if (!t) return { ...NO_DATA, detail: "No line: a score it needs is missing for this option." };
  const end = Math.round(t.points[t.points.length - 1].value);
  const change = end - result.start;
  const cls = change > 0 ? SOIL_CLASSES.up : change < 0 ? SOIL_CLASSES.down : SOIL_CLASSES.level;
  const words = change > 0 ? `up ${change}` : change < 0 ? `down ${-change}` : "no change";
  return {
    color: cls.color,
    value: String(end),
    detail: `Year ${result.years}: ${end} (${words} from ${result.start})`,
    className: cls.label,
  };
}

/** The months the option has a crop in the field (1-12), from the same calendar as the soil chart. */
export function cropMonths(option: Pick<RotationOption, "slots" | "metrics">): number[] {
  return monthCells(option)
    .filter((c) => c.crop_id !== null)
    .map((c) => c.month);
}

export interface FitContext {
  lot: Pick<Lot, "details">;
  monthly: LotAnalysis["monthly"];
  library: Pick<CropLibrary, "crops" | "rice_extra_detail">;
}

/**
 * The option's crop-fit level, its worst crop (as on the farm map). Option A uses the dashboard's
 * own "Your crops here" result so both always agree; other options run the same engine check on
 * their own crops and months.
 */
export function optionFitLevel(
  option: Pick<RotationOption, "key" | "slots">,
  analysis: Pick<LotAnalysis, "crop_fits">,
  ctx: FitContext,
): FitLevel {
  if (option.key === "A") return lotFitLevel(analysis.crop_fits);
  const byCrop = new Map<string, LotCrop>();
  for (const s of option.slots) {
    const lc = byCrop.get(s.crop_id) ?? { crop_id: s.crop_id, seasons: [] };
    lc.seasons.push({ plant_month: s.plant_month, harvest_month: s.harvest_month });
    byCrop.set(s.crop_id, lc);
  }
  const fits = [...byCrop.values()].flatMap((lotCrop) => {
    const crop = ctx.library.crops.find((c) => c.id === lotCrop.crop_id);
    return crop ? [cropFit({ crop, lotCrop, details: ctx.lot.details, data: { monthly: ctx.monthly }, library: ctx.library })] : [];
  });
  return lotFitLevel(fits);
}

export function fitPanel(level: FitLevel): PanelValue {
  return { color: FIT_COLORS[level], value: FIT_LABELS[level], detail: "Its weakest crop sets the color.", className: FIT_LABELS[level] };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Mean root-zone wetness (POWER GWETROOT, 0-1) over the months with a crop in the field. */
export function wetnessPanel(months: readonly number[], wetness: readonly (number | null)[]): PanelValue {
  const vals = months.map((m) => wetness[m - 1]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (vals.length === 0 || vals.length < months.length) return { ...NO_DATA, detail: "No NASA wetness data for some crop months." };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  const driest = months[vals.indexOf(min)];
  return {
    color: shade(mean),
    value: mean.toFixed(2),
    detail: `Average over ${months.length} crop month${months.length === 1 ? "" : "s"}; driest ${MONTHS[driest - 1]} ${min.toFixed(2)}`,
    className: "Root-zone wetness",
  };
}

const mm = (n: number) => `${Math.round(n).toLocaleString("en-US")} mm`;

/**
 * Dry-year rain (P20) that falls in the months with a crop in the field. The shade is its share of
 * the whole dry year's rain, so a calendar that catches more of the rain is darker.
 */
export function rainPanel(months: readonly number[], p20: readonly (number | null)[]): PanelValue {
  const year = p20.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (year.length < 12) return { ...NO_DATA, detail: "No NASA rain data for some months." };
  const total = year.reduce((a, b) => a + b, 0);
  const caught = months.reduce((a, m) => a + (p20[m - 1] as number), 0);
  const share = total > 0 ? caught / total : 0;
  return {
    color: shade(share),
    value: mm(caught),
    detail: `Falls in the crop months of a dry year: ${Math.round(share * 100)}% of that year's rain`,
    className: "Rain in crop months",
  };
}

// ---------------------------------------------------------------------------
// The whole card
// ---------------------------------------------------------------------------

export interface CutoutPanel {
  key: OptionKey;
  /** "Now: Your crops" or "Option B: Best for water". */
  title: string;
  /** "Rice ×2" or "Calendar months: Jun-Sep". */
  crops: string;
  value: PanelValue;
}

export interface CutoutModel {
  panels: CutoutPanel[];
  /** True when both panels show the same value (e.g. same months for a climate layer). */
  same: boolean;
}

export function cutoutModel(
  layer: CutoutLayer,
  analysis: Pick<LotAnalysis, "rotations" | "soil_health" | "crop_fits" | "monthly">,
  ctx: Omit<FitContext, "monthly">,
  cropName: (id: string) => string = (id) => id,
): CutoutModel {
  const opts = analysis.rotations.options;
  const a = opts.find((o) => o.key === "A");
  const best = bestOtherOption(opts);
  const chosen = [a, best].filter((o): o is RotationOption => !!o);
  const panels = chosen.map((o): CutoutPanel => {
    const title = o.key === "A" ? `Now: ${OPTION_LABELS.A}` : `Option ${o.key}: ${OPTION_LABELS[o.key]}`;
    const crops = o.slots.length ? cropList(o.slots.map((s) => cropName(s.crop_id))) : "No crops";
    let value: PanelValue;
    switch (layer) {
      case "soil":
        value = soilPanel(analysis.soil_health, o.key);
        break;
      case "fit":
        value = fitPanel(optionFitLevel(o, analysis, { ...ctx, monthly: analysis.monthly }));
        break;
      case "wetness":
        value = wetnessPanel(cropMonths(o), analysis.monthly.rootzone_wetness);
        break;
      case "rain":
        value = rainPanel(cropMonths(o), analysis.monthly.precip_mm.p20);
        break;
    }
    return { key: o.key, title, crops, value };
  });
  const same = panels.length === 2 && panels[0].value.value === panels[1].value.value && panels[0].value.color === panels[1].value.color;
  return { panels, same };
}

/** Legend rows for a layer. Wetness and rain have a shade instead (see `cutoutShade`). */
export function cutoutLegend(layer: CutoutLayer): { color: string; label: string }[] {
  const noData = { color: NO_RESULT_COLOR, label: "No data" };
  switch (layer) {
    case "soil":
      return [SOIL_CLASSES.up, SOIL_CLASSES.level, SOIL_CLASSES.down, noData];
    case "fit":
      return (["good", "watch", "poor", "unknown"] as const).map((l) => ({ color: FIT_COLORS[l], label: FIT_LABELS[l] })).concat(noData);
    case "wetness":
    case "rain":
      return [noData];
  }
}

/** Ends of the continuous shade for the wetness and rain layers; `null` for class layers. */
export function cutoutShade(layer: CutoutLayer): { low: string; high: string; lowLabel: string; highLabel: string } | null {
  if (layer === "wetness") return { low: shade(0), high: shade(1), lowLabel: "0 dry", highLabel: "1 saturated" };
  if (layer === "rain") return { low: shade(0), high: shade(1), lowLabel: "Less of the year's rain", highLabel: "All of it" };
  return null;
}

/** One line for screen readers: the lot, the layer, then each panel's crops, value and what it means. */
export function cutoutSummary(lotName: string, layer: CutoutLayer, model: CutoutModel): string {
  const name = CUTOUT_LAYERS.find((l) => l.key === layer)?.label ?? layer;
  const parts = model.panels.map((p) => `${p.title}, ${p.crops}: ${p.value.value}. ${p.value.detail}.`);
  return [`${lotName}, ${name.toLowerCase()}.`, ...parts, model.same ? "Both the same." : ""].join(" ").trim();
}
