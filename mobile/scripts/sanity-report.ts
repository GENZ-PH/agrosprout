// Prints the numbers for the docs/07 §7 checks that need someone who knows the
// area (#32), as Markdown. It changes nothing.
//   npm run sanity                      the bundled demo farm (#8)
//   npm run sanity -- path/to/lot.json  any LotData file
// The checks a test can answer are in src/engine/sanity.test.ts.
// No `/// <reference types="node" />` here: with it, tsc fails on the fetch
// types in src/api/client.ts. Node types still load through the test files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LotData, LotDetails, SoilFeel } from "../src/types";
import { parsePowerMonthly, roundForPower } from "../src/data/power";
import { CROP_LIBRARY_FIXTURE as lib } from "../src/engine/__fixtures__/crops.fixture";
import { plantingWindow, rotations, waterBalance } from "../src/engine/index";
import { STRESS_WINDOW_DEFICIT_SHARE } from "../src/engine/params";
import { cropSeasonDays } from "../src/engine/season";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LIVE_RESPONSE = join(process.cwd(), "src", "data", "__fixtures__", "power-monthly-8.2N-124.2E-2001-2025.json");
const DEMO_FARM = join(process.cwd(), "assets", "data", "demo", "lanao-norte-demo-1.json");

const lot: LotData = JSON.parse(readFileSync(process.argv[2] ?? DEMO_FARM, "utf8"));
const m = lot.monthly;
const details: LotDetails = { land_type: "lowland", water: "rain", soil: "loamy" };
const rice = lib.crops.find((c) => c.id === "lowland-rice");
const riceDays = rice ? cropSeasonDays(rice).days : null;
if (!rice || !riceDays) throw new Error("crop library has no lowland-rice season length");

const n = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "–" : v.toFixed(d));
const sum = (s: (number | null)[]) => (s.some((v) => v === null) ? null : s.reduce<number>((a, v) => a + (v ?? 0), 0));
const months = (list: number[]) => (list.length ? list.map((x) => MONTHS[x - 1]).join(", ") : "none");
const row = (cells: (string | number)[]) => console.log(`| ${cells.join(" | ")} |`);
const out = (s = "") => console.log(s);

out(`# docs/07 §7 sanity report: ${lot.id} (${lot.lat}, ${lot.lon}), ${lot.kind}, ${lot.period}`);
out();
out("Crop library: the engine test fixture (src/engine/__fixtures__/crops.fixture.ts) until crops.json (#11) lands. Lot details: rain-fed lowland, soil feel loamy unless a table says otherwise.");
if (lot.caveats.length) out(`Caveats: ${lot.caveats.join(" ")}`);

// --- Checks 1 and 2: rain, ET0, wet and dry months --------------------------------
out("\n## Checks 1-2: rain, ET0, wet and dry months\n");
const surplus = m.precip_mm.p50.map((p, i) => (p === null || m.et0_mm[i] === null ? null : p - (m.et0_mm[i] ?? 0)));
row(["Month", "Rain P20 mm", "Rain P50 mm", "Rain P80 mm", "ET0 mm", "P50 − ET0", "Tmax °C", "Tmin °C"]);
row(Array(8).fill("---"));
MONTHS.forEach((name, i) =>
  row([name, n(m.precip_mm.p20[i]), n(m.precip_mm.p50[i]), n(m.precip_mm.p80[i]), n(m.et0_mm[i]), n(surplus[i]), n(m.tmax_c[i], 1), n(m.tmin_c[i], 1)]),
);
row(["**Year**", n(sum(m.precip_mm.p20)), n(sum(m.precip_mm.p50)), n(sum(m.precip_mm.p80)), n(sum(m.et0_mm)), n(sum(surplus)), "", ""]);
const driest = surplus
  .map((v, i) => ({ month: i + 1, v: v ?? Infinity }))
  .sort((a, b) => a.v - b.v)
  .slice(0, 3)
  .map((x) => x.month);
out(`\nDriest 3 months (lowest P50 − ET0): ${months(driest)}. Months where typical rain is below ET0: ${months(surplus.flatMap((v, i) => (v !== null && v < 0 ? [i + 1] : [])))}.`);
if (lot.elevation_m === null) out("Elevation unknown: ET0 assumes sea level.");

// --- Check 3: rice-rice-bare stress window ------------------------------------------
out("\n## Check 3: rice-rice-bare stress window (typical calendar)\n");
out(`A month is in the stress window when its deficit is more than ${100 * STRESS_WINDOW_DEFICIT_SHARE}% of the month's water need (STRESS_WINDOW_DEFICIT_SHARE). Ponded rice need includes percolation and seepage by soil feel (RICE_PERCOLATION_CLASS).\n`);
row(["Soil feel", "Planted", "WSI P50", "WSI P20", "Stress months (P50)", "Deficit share of need by month (P50)"]);
row(Array(6).fill("---"));
for (const soil of ["clayey", "loamy", "sandy"] as SoilFeel[]) {
  for (const { plant_month } of rice.typical_calendar) {
    const run = (scenario: "p50" | "p20") =>
      waterBalance({ crop: rice, plantMonth: plant_month, seasonDays: riceDays, monthly: m, details: { ...details, soil }, riceDetail: lib.rice_extra_detail, scenario });
    const p50 = run("p50");
    const p20 = run("p20");
    if (!p50.ok || !p20.ok) {
      row([soil, MONTHS[plant_month - 1], "–", "–", p50.ok ? "" : p50.reason, ""]);
      continue;
    }
    const shares = p50.result.months.map((x) => `${MONTHS[x.month - 1]} ${n(x.need_mm > 0 ? (100 * x.deficit_mm) / x.need_mm : 0)}%`);
    row([soil, MONTHS[plant_month - 1], n(p50.result.wsi, 2), n(p20.result.wsi, 2), months(p50.result.stress_months), shares.join(", ")]);
  }
}

// --- Check 4: your months vs better months -------------------------------------------
out("\n## Check 4: rice on its typical months vs the engine's better months\n");
const seasons = rice.typical_calendar.map(({ plant_month, harvest_month }) => ({ plant_month, harvest_month }));
const scan = (s: typeof seasons) =>
  plantingWindow({ lot: { crops: [{ crop_id: rice.id, seasons: s }], details }, data: lot, library: lib }).seasons;
row(["Season", "Status", "Better month", "Fit gain", "Why", "If it were the only season on the lot"]);
row(Array(6).fill("---"));
scan(seasons).forEach((w, i) => {
  const alone = scan([seasons[i]])[0];
  row([
    `${MONTHS[w.yours.plant_month - 1]} (WSI P50 ${n(w.yours.wsi.p50, 2)})`,
    w.status,
    w.better ? MONTHS[w.better.plant_month - 1] : "–",
    n(w.delta, 1),
    w.drivers.join(", ") || "–",
    alone.better ? `${alone.status}: ${MONTHS[alone.better.plant_month - 1]}, +${n(alone.delta, 1)}` : alone.status,
  ]);
});

// --- Check 10 context: options A-D in a dry year -------------------------------------
out("\n## Check 10: water fit (W) of options A-D in a typical (P50) and a dry (P20) year\n");
const r = rotations({ lot: { crops: [{ crop_id: rice.id, seasons: [] }], details }, data: lot, library: lib, priorities: { water: 50, soil: 50, income: 50, labor: 50 } });
row(["Option", "Crops (plant month)", "W P50", "W P20", "Drop", "Total"]);
row(Array(6).fill("---"));
for (const o of r.options) {
  const { p50, p20 } = o.water_fit_range;
  const crops = o.slots.map((s) => `${s.crop_id} (${MONTHS[s.plant_month - 1]})`).join(", ");
  row([o.key, crops, n(p50), n(p20), p50 === null || p20 === null ? "–" : n(p50 - p20), n(o.total)]);
}

// --- Check 8: the live parser on the saved API response vs this lot ------------------
out("\n## Check 8: live monthly parse vs this lot file\n");
if (roundForPower(lot.lat) === 8.2 && roundForPower(lot.lon) === 124.2) {
  const live = parsePowerMonthly(JSON.parse(readFileSync(LIVE_RESPONSE, "utf8")), "saved response", "live");
  out(`power.ts on the saved POWER monthly response (${live.period}) minus this lot (${lot.period}):\n`);
  row(["Series", ...MONTHS]);
  row(Array(13).fill("---"));
  const pct = (a: (number | null)[], b: (number | null)[]) =>
    a.map((v, i) => (v === null || !b[i] ? "–" : `${n((100 * (v - (b[i] ?? 0))) / (b[i] ?? 1), 1)}%`));
  const diff = (a: (number | null)[], b: (number | null)[]) =>
    a.map((v, i) => (v === null || b[i] === null ? "–" : n(v - (b[i] ?? 0), 1)));
  row(["Rain P50", ...pct(live.monthly.precip_mm.p50, m.precip_mm.p50)]);
  row(["ET0", ...pct(live.monthly.et0_mm, m.et0_mm)]);
  row(["Tmax °C", ...diff(live.monthly.tmax_c, m.tmax_c)]);
  row(["Tmin °C", ...diff(live.monthly.tmin_c, m.tmin_c)]);
} else {
  out("Skipped: the saved POWER response covers lots that round to 8.2, 124.2 only.");
}
