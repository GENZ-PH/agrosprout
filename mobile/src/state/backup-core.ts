import type { Destination, Farm, Lot, LotData } from "../types";

// Backup and restore file for farm data (#49). The file stays with the farmer: nothing is uploaded.
// No React Native imports. Saving the file (Android share sheet / web download) and picking it
// are done by the screen; this module only builds, checks and applies the file's contents.

export const BACKUP_FORMAT = 1;
const BACKUP_KIND = "agrosprout-farm-backup";

export interface FarmBackup {
  kind: typeof BACKUP_KIND;
  /** Version of this file layout. */
  format: typeof BACKUP_FORMAT;
  /** ISO time the file was made. */
  created_at: string;
  /** App version that made it (app.json). Informational. */
  app_version: string;
  farm: Farm;
  /** Saved NASA POWER data per lot id (`lotdata:<id>`), so a restore works offline. */
  lotdata: Record<string, LotData>;
}

export type ParseResult = { ok: true; backup: FarmBackup } | { ok: false; reason: string };

/** Builds the backup from the farm and the lots' saved climate data. */
export async function buildBackup(args: {
  farm: Farm;
  readKey: (key: string) => Promise<string | null>;
  appVersion: string;
  now?: () => Date;
}): Promise<FarmBackup> {
  const lotdata: Record<string, LotData> = {};
  for (const lot of args.farm.lots) {
    if (!lot.data_ref.startsWith("lotdata:")) continue; // demo data ships with the app
    const raw = await args.readKey(lot.data_ref).catch(() => null);
    if (!raw) continue;
    try {
      const d = JSON.parse(raw) as unknown;
      if (isLotData(d)) lotdata[lot.id] = d;
    } catch {
      // unreadable climate data is left out; it is fetched again after a restore
    }
  }
  return {
    kind: BACKUP_KIND,
    format: BACKUP_FORMAT,
    created_at: (args.now ?? (() => new Date()))().toISOString(),
    app_version: args.appVersion,
    farm: args.farm,
    lotdata,
  };
}

/** File name like `agrosprout-farm-2026-11-14.json`. */
export const backupFileName = (backup: FarmBackup) => `agrosprout-farm-${backup.created_at.slice(0, 10)}.json`;

export const serializeBackup = (backup: FarmBackup) => JSON.stringify(backup, null, 2);

/** Reads a backup file's text and checks it against the `Farm` type and versions. Never throws. */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "The file is not a farm backup (not valid JSON)." };
  }
  if (!isObj(data) || data.kind !== BACKUP_KIND) {
    return { ok: false, reason: "The file is not an AgriResilience farm backup." };
  }
  if (data.format !== BACKUP_FORMAT) {
    return { ok: false, reason: `This backup uses format ${String(data.format)}; this app reads format ${BACKUP_FORMAT}.` };
  }
  const farmProblem = checkFarm(data.farm);
  if (farmProblem) return { ok: false, reason: `The farm in the file is damaged: ${farmProblem}.` };
  const farm = data.farm as Farm;
  const lotIds = new Set(farm.lots.map((l) => l.id));
  const lotdata: Record<string, LotData> = {};
  if (isObj(data.lotdata)) {
    for (const [id, d] of Object.entries(data.lotdata)) {
      if (lotIds.has(id) && isLotData(d)) lotdata[id] = d; // anything else is ignored, not restored
    }
  }
  return {
    ok: true,
    backup: {
      kind: BACKUP_KIND,
      format: BACKUP_FORMAT,
      created_at: typeof data.created_at === "string" ? data.created_at : "",
      app_version: typeof data.app_version === "string" ? data.app_version : "",
      farm,
      lotdata,
    },
  };
}

/** Short summary for the confirmation step, e.g. "2 lots, 3 crops, 1 place". */
export function describeBackup(backup: FarmBackup) {
  const lots = backup.farm.lots.length;
  const crops = backup.farm.lots.reduce((n, l) => n + l.crops.length, 0);
  const places = backup.farm.destinations.length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(lots, "lot")}, ${plural(crops, "crop")}, ${plural(places, "place")}`;
}

/**
 * Replaces the stored farm with the backup. Call only after the farmer confirms.
 * Order matters: old climate data is removed first and awaited, then the file's climate data is
 * written, then the farm is replaced, so a restored `lotdata:<id>` is never deleted afterwards.
 * Lots whose climate data is not in the file are marked `pending` and fetched again when online.
 */
export async function restoreBackup(args: {
  backup: FarmBackup;
  /** Lots currently on the device (their `lotdata:` keys are removed). */
  currentLots: Lot[];
  replaceFarm: (farm: Farm) => void;
  removeKey: (key: string) => Promise<void>;
  writeKey: (key: string, value: string) => Promise<void>;
}) {
  const { backup } = args;
  const oldRefs = args.currentLots.map((l) => l.data_ref).filter((r) => r.startsWith("lotdata:"));
  await Promise.all(oldRefs.map((r) => args.removeKey(r)));
  for (const lot of backup.farm.lots) {
    const d = backup.lotdata[lot.id];
    if (d) await args.writeKey(`lotdata:${lot.id}`, JSON.stringify(d));
  }
  const lots: Lot[] = backup.farm.lots.map((l) => {
    if (!l.data_ref.startsWith("lotdata:")) return l; // demo data ships with the app
    return { ...l, data_ref: `lotdata:${l.id}`, data_status: backup.lotdata[l.id] ? "ready" : "pending" };
  });
  args.replaceFarm({ ...backup.farm, lots });
}

// ---------------------------------------------------------------------------
// Shape checks against types.ts (no schema library in the app)
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isLonLat = (v: unknown) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const oneOf = (v: unknown, options: readonly string[]) => isStr(v) && options.includes(v);
const isMonth = (v: unknown) => isNum(v) && Number.isInteger(v) && v >= 1 && v <= 12;

const LAND = ["lowland", "upland", "sloping", "unknown"] as const;
const WATER = ["rain", "some", "full", "unknown"] as const;
const SOIL = ["sandy", "loamy", "clayey", "unknown"] as const;
const EQUIPMENT = ["hand", "carabao", "hand-tractor", "tractor", "unknown"] as const;
const STATUS = ["ready", "pending", "error"] as const;
const TRAVEL_SOURCE = ["farmer", "route", "estimate"] as const;
const ROUTE = ["car", "bike", "foot"] as const;
const DEST_TYPE = ["market", "storage", "buyer", "coop"] as const;
const MODE = ["walk", "carabao", "bicycle", "motorcycle", "tricycle", "jeepney", "truck"] as const;

function checkLot(l: unknown, i: number): string | null {
  const at = `lot ${i + 1}`;
  if (!isObj(l)) return `${at} is not an object`;
  if (!isStr(l.id) || !l.id) return `${at} has no id`;
  if (!isStr(l.name)) return `${at} has no name`;
  const g = l.geometry;
  if (!isObj(g) || g.type !== "Polygon" || !Array.isArray(g.coordinates) ||
      !g.coordinates.every((ring) => Array.isArray(ring) && ring.every(isLonLat))) {
    return `${at} has no valid outline`;
  }
  if (!isNum(l.area_ha) || l.area_ha < 0) return `${at} has no valid area`;
  if (!isLonLat(l.centroid)) return `${at} has no valid centre point`;
  const d = l.details;
  if (!isObj(d) || !oneOf(d.land_type, LAND) || !oneOf(d.water, WATER) || !oneOf(d.soil, SOIL)) {
    return `${at} has invalid details`;
  }
  // Equipment is newer and optional: a backup without it restores.
  if (d.equipment !== undefined && !oneOf(d.equipment, EQUIPMENT)) return `${at} has invalid details`;
  if (!Array.isArray(l.crops) || !l.crops.every((c) =>
    isObj(c) && isStr(c.crop_id) && Array.isArray(c.seasons) &&
    c.seasons.every((s) => isObj(s) && isMonth(s.plant_month) && isMonth(s.harvest_month)))) {
    return `${at} has invalid crops or months`;
  }
  if (!oneOf(l.data_status, STATUS)) return `${at} has an invalid data status`;
  if (!isStr(l.data_ref)) return `${at} has no data reference`;
  if (!Array.isArray(l.travel) || !l.travel.every((t) =>
    isObj(t) && isStr(t.destination_id) && isNumOrNull(t.distance_km) && isNum(t.minutes) &&
    oneOf(t.source, TRAVEL_SOURCE) && (t.route_profile === null || oneOf(t.route_profile, ROUTE)))) {
    return `${at} has invalid travel times`;
  }
  if (l.province_code !== undefined && l.province_code !== null && !isStr(l.province_code)) {
    return `${at} has an invalid province`;
  }
  return null;
}

function checkDestination(d: unknown, i: number): string | null {
  const at = `place ${i + 1}`;
  if (!isObj(d)) return `${at} is not an object`;
  if (!isStr(d.id) || !d.id || !isStr(d.name)) return `${at} has no id or name`;
  if (!oneOf(d.type, DEST_TYPE) || !oneOf(d.mode, MODE)) return `${at} has an invalid type or transport`;
  if (!isLonLat(d.point)) return `${at} has no valid location`;
  if (!isNumOrNull(d.load_kg_per_trip) || !isNumOrNull(d.fare_one_way)) return `${at} has an invalid load or fare`;
  return null;
}

/** Returns a problem description, or null when `v` is a valid `Farm` (version 1). */
export function checkFarm(v: unknown): string | null {
  if (!isObj(v)) return "no farm";
  if (v.version !== 1) return `farm version ${String(v.version)} is not supported`;
  if (!Array.isArray(v.lots)) return "no lot list";
  if (!Array.isArray(v.destinations)) return "no place list";
  for (let i = 0; i < v.lots.length; i++) {
    const p = checkLot(v.lots[i], i);
    if (p) return p;
  }
  for (let i = 0; i < v.destinations.length; i++) {
    const p = checkDestination(v.destinations[i], i);
    if (p) return p;
  }
  const ids = (v.lots as Lot[]).map((l) => l.id);
  if (new Set(ids).size !== ids.length) return "two lots share an id";
  const destIds = (v.destinations as Destination[]).map((d) => d.id);
  if (new Set(destIds).size !== destIds.length) return "two places share an id";
  const pr = v.priorities;
  if (!isObj(pr) || !["water", "soil", "income", "labor"].every((k) => isNum(pr[k]) && pr[k] >= 0 && pr[k] <= 100)) {
    return "priorities are invalid";
  }
  // "forage" (Feed animals) is newer: a backup without it is fine (the default is used).
  if (pr.forage !== undefined && !(isNum(pr.forage) && pr.forage >= 0 && pr.forage <= 100)) return "priorities are invalid";
  return null;
}

/** Based on the check `ensureLotData` uses for stored climate data (src/data/power.ts readStored). */
function isLotData(d: unknown): d is LotData {
  return isObj(d) && d.kind === "live" && isNum(d.lat) && isNum(d.lon) && isObj(d.monthly);
}
