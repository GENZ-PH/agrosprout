// A crop's characteristics as plain rows (2026-11-15), shared by the Crop library screen and the
// crop dialog on the dashboard. Only values from crops.json; a missing value reads "Not known yet".
import type { Crop } from "../types";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVEL = { low: "Low", medium: "Medium", high: "High" } as const;
export const UNKNOWN = "Not known yet";

/** Same rule as the engine (rotations.ts isComplete): these values must all be known to suggest a crop. */
export const usable = (c: Crop) => c.season_days !== null && c.kc !== null && c.stages_days !== null && c.temp_c !== null;

const level = (v: keyof typeof LEVEL | null) => (v ? LEVEL[v] : UNKNOWN);

export function rows(c: Crop): [string, string][] {
  const t = c.temp_c;
  return [
    ["Days in the field", c.season_days === null ? UNKNOWN : `${c.season_days} days`],
    ["Temperature it survives", t ? `${t.min} to ${t.max} °C` : UNKNOWN],
    ["Temperature it likes best", t ? `${t.opt_low} to ${t.opt_high} °C` : UNKNOWN],
    ["Water use at its peak (FAO-56 Kc mid)", c.kc ? String(c.kc[1]) : UNKNOWN],
    ["Root depth", c.root_depth_m ? `${c.root_depth_m[0]} to ${c.root_depth_m[1]} m` : UNKNOWN],
    ["Handles dry spells", level(c.drought_tolerance)],
    ["Handles waterlogged soil", level(c.waterlogging_tolerance)],
    ["Adds nitrogen to the soil", c.n_fixing === null ? UNKNOWN : c.n_fixing ? "Yes (legume)" : "No"],
    ["Spoils after harvest", c.perishability ? { high: "Within days", medium: "In 1 to 3 weeks", low: "Keeps for months" }[c.perishability] : UNKNOWN],
    ["Typical yield (PSA)", c.yield_t_per_ha === null ? UNKNOWN : `${c.yield_t_per_ha} t/ha`],
    [
      "Usual months",
      c.typical_calendar.length === 0
        ? UNKNOWN
        : c.typical_calendar.map((s) => `${MONTH[s.plant_month - 1]} to ${MONTH[s.harvest_month - 1]}`).join(", "),
    ],
  ];
}


/** Fields every crop still lacks (the team fills them): not worth a warning on their own. */
const TEAM_FIELDS = new Set(["labor", "market", "cover_value"]);
const FIELD_LABEL: Record<string, string> = {
  season_days: "days in the field",
  stages_days: "growth stages",
  kc: "water use",
  root_depth_m: "root depth",
  p_depletion: "how dry the soil may get",
  temp_c: "temperature range",
  drought_tolerance: "how it handles dry spells",
  waterlogging_tolerance: "how it handles wet soil",
  n_fixing: "whether it adds nitrogen",
  labor: "work needed",
  market: "market",
  cover_value: "soil cover",
  perishability: "how fast it spoils",
  storable_if_dried: "whether it stores dried",
  yield_t_per_ha: "yield",
  typical_calendar: "usual months",
  local_name: "local name",
};
/** The crop's missing values, in plain words. */
export const missing = (c: Crop) => c.unverified.map((f) => FIELD_LABEL[f] ?? f.replace(/_/g, " "));
/** True when the crop lacks more than the values every crop still lacks. */
export const lacksData = (c: Crop) => !usable(c) || c.unverified.some((f) => !TEAM_FIELDS.has(f));
