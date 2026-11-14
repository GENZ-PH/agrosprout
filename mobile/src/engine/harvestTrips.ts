// Harvest trips and wet-season roads (docs/07-rotation-engine.md §3c, #44).
// Pure TypeScript (no React Native imports). Coefficients live in ./params.ts and
// are labelled assumptions; the farmer's own load per trip overrides the default.
import type { Crop, Destination, Lot, LotData, TransportMode } from "../types";
import { HEAVY_RAIN_MONTH_MM, LOAD_KG_PER_TRIP, WET_ROAD_FACTOR } from "./params";

export type TripsGap = "no-yield" | "no-area" | "no-load";

export interface HarvestTrips {
  /** Harvest weight, kg = yield t/ha x area ha x 1000; `null` when yield or area is unknown. */
  harvest_kg: number | null;
  /** Load carried per trip, kg, and where it came from. */
  load_kg: number | null;
  load_source: "farmer" | "assumed" | null;
  /** Trips needed for one harvest = ceil(harvest_kg / load_kg); `null` when not computable. */
  trips: number | null;
  /** Why `trips` is `null` (never a guess). */
  gap: TripsGap | null;
}

/**
 * Trips needed to bring one harvest to a destination (docs/07 §3c).
 * `yield_t_per_ha` comes from crops.json (cite its source), `area_ha` from the drawn lot (flat map area, D31).
 */
export function tripsPerHarvest(args: {
  crop: Pick<Crop, "yield_t_per_ha">;
  lot: Pick<Lot, "area_ha">;
  destination: Pick<Destination, "mode" | "load_kg_per_trip">;
}): HarvestTrips {
  const { crop, lot, destination } = args;
  const farmerLoad = destination.load_kg_per_trip;
  const hasFarmerLoad = typeof farmerLoad === "number" && Number.isFinite(farmerLoad) && farmerLoad > 0;
  const load_kg = hasFarmerLoad ? farmerLoad : (LOAD_KG_PER_TRIP[destination.mode as TransportMode] ?? null);
  const load_source = hasFarmerLoad ? "farmer" : load_kg !== null ? "assumed" : null;

  const y = crop.yield_t_per_ha;
  const a = lot.area_ha;
  const gap: TripsGap | null =
    y === null || !(y > 0) ? "no-yield" : !(a > 0) ? "no-area" : load_kg === null || !(load_kg > 0) ? "no-load" : null;
  if (gap !== null) return { harvest_kg: null, load_kg, load_source, trips: null, gap };
  const harvest_kg = (y as number) * a * 1000;
  return { harvest_kg, load_kg, load_source, trips: Math.ceil(harvest_kg / (load_kg as number)), gap: null };
}

/** Hours on the road for a harvest: trips x 2 (there and back) x one-way minutes / 60. */
export function tripHours(trips: number, oneWayMinutes: number): number {
  return (trips * 2 * oneWayMinutes) / 60;
}

export interface WetRoad {
  /** True when the month's typical-year rain is above HEAVY_RAIN_MONTH_MM. */
  wet: boolean;
  /** Multiplier for the travel time in this month (1 when dry; `null` rain data counts as dry). */
  factor: number;
  /** The month's typical-year (P50) rain, mm; `null` when missing. */
  rain_mm: number | null;
}

/** Wet-season road check for the harvest month (1-12) from the lot's typical-year rain. */
export function wetRoad(month: number, monthly: Pick<LotData["monthly"], "precip_mm">): WetRoad {
  const rain = monthly.precip_mm.p50[month - 1] ?? null;
  const wet = rain !== null && rain > HEAVY_RAIN_MONTH_MM;
  return { wet, factor: wet ? WET_ROAD_FACTOR : 1, rain_mm: rain };
}

/** One-way minutes in the harvest month: the dry-weather time times the wet-road factor. */
export function harvestMonthMinutes(minutes: number, month: number, monthly: Pick<LotData["monthly"], "precip_mm">): number {
  return minutes * wetRoad(month, monthly).factor;
}
