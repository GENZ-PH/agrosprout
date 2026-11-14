// Market access (M) and layered travel time for one lot
// (docs/07-rotation-engine.md §3c, #27, D17, D18).
// Pure TypeScript (no React Native imports). Coefficients live in ./params.ts.
//
// Travel time per (lot, destination), first available source wins and is
// always labeled (D18):
//   1. farmer   "your time"       high confidence. ALWAYS wins (rule 9).
//   2. route    "road route"      medium. OSRM distance / mode speed (+ wait).
//   3. estimate "rough estimate"  low. Straight line x circuity / mode speed;
//                                 ask the farmer to confirm.
// src/data/routing.ts fetches the route or builds the estimate; this file only
// reads the stored `Lot.travel` entries and turns them into M per crop.
//
// M per crop = score of the travel time to the crop's best destination:
// a market, buyer or co-op; storage counts too for low/medium perishability
// crops (storage bonus). No destination yet = M is off (D20).
import type { Crop, Destination, DestinationType, Level, Travel, TransportMode, TravelSource } from "../types";
import { profileForMode, type TravelAssumptions } from "../data/routing";
import {
  ACCESS_FLOOR,
  ACCESS_MINUTES,
  ROAD_CIRCUITY,
  SALE_DESTINATION_TYPES,
  STORAGE_PERISHABILITY,
  TRAVEL_SPEED_KMH,
  TRAVEL_WAIT_MIN,
} from "./params";

export type TravelConfidence = "high" | "medium" | "low";

/** Label and confidence the UI shows next to every travel time (docs/07 §3c table). */
export const TRAVEL_SOURCE_INFO: Readonly<
  Record<TravelSource, { label: string; confidence: TravelConfidence; ask_to_confirm: boolean }>
> = {
  farmer: { label: "your time", confidence: "high", ask_to_confirm: false },
  route: { label: "road route", confidence: "medium", ask_to_confirm: false },
  estimate: { label: "rough estimate", confidence: "low", ask_to_confirm: true },
};

/** Lower rank = preferred source (D18). */
const SOURCE_RANK: Readonly<Record<TravelSource, number>> = { farmer: 0, route: 1, estimate: 2 };

/**
 * The assumptions `resolveTravel` (src/data/routing.ts) needs for one
 * destination's mode, from params.ts. The circuity is the one measured for
 * that mode's routing profile.
 */
export function travelAssumptionsFor(mode: TransportMode): TravelAssumptions {
  return {
    speedKmh: { ...TRAVEL_SPEED_KMH },
    waitMin: { ...TRAVEL_WAIT_MIN },
    circuity: ROAD_CIRCUITY[profileForMode(mode)],
  };
}

const validMinutes = (t: Travel) => typeof t.minutes === "number" && Number.isFinite(t.minutes) && t.minutes >= 0;

/**
 * The travel entry to use for one destination: the farmer's own time if there
 * is one (even when a route says otherwise), else the road route, else the
 * rough estimate. Entries with a missing or negative time are ignored.
 */
export function pickTravel(travel: readonly Travel[], destinationId: string): Travel | null {
  let best: Travel | null = null;
  for (const t of travel) {
    if (t.destination_id !== destinationId || !validMinutes(t)) continue;
    if (best === null || SOURCE_RANK[t.source] < SOURCE_RANK[best.source]) best = t;
  }
  return best;
}

/**
 * M (0-100) for one crop at a one-way travel time: 100 up to ACCESS_MINUTES.ok
 * for the crop's perishability, then falling linearly to ACCESS_FLOOR at
 * ACCESS_MINUTES.max and beyond.
 */
export function accessScore(minutes: number, perishability: Level): number {
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError(`Invalid travel time: ${minutes} min`);
  const { ok, max } = ACCESS_MINUTES[perishability];
  if (minutes <= ok) return 100;
  if (minutes >= max) return ACCESS_FLOOR;
  return 100 - ((100 - ACCESS_FLOOR) * (minutes - ok)) / (max - ok);
}

/**
 * Why a crop has no M:
 * - perishability-unknown: crops.json has no perishability for the crop.
 * - no-sale-point: only storage places, and the crop spoils too fast to store
 *   (the farmer can add a market or buyer).
 * - travel-pending: the crop's destinations have no travel time yet.
 */
export type AccessGap = "perishability-unknown" | "no-sale-point" | "travel-pending";

export interface CropAccess {
  crop_id: string;
  /** 0-100; `null` = not scored, `gap` says why (never a guess). */
  score: number | null;
  gap: AccessGap | null;
  perishability: Level | null;
  /** The best destination used for the score. */
  destination_id: string | null;
  destination_type: DestinationType | null;
  /** One-way minutes to that destination. */
  minutes: number | null;
  source: TravelSource | null;
  /** "your time" / "road route" / "rough estimate". */
  source_label: string | null;
  confidence: TravelConfidence | null;
  /** True for a rough estimate: ask the farmer to confirm the time. */
  ask_to_confirm: boolean;
  /** True when the best destination is a storage place (storage bonus). */
  via_storage: boolean;
  /** Best time to a market, buyer or co-op, minutes (`null` = none with a time). For "store and sell later" texts. */
  sale_minutes: number | null;
  /** Thresholds used, minutes (from params.ts, all assumptions). */
  ok_minutes: number | null;
  max_minutes: number | null;
}

export interface MarketAccessInput {
  /** The crops to score (e.g. every crop in the library, or the lot's candidates). */
  crops: readonly Crop[];
  /** The farm's harvest destinations (S6). */
  destinations: readonly Destination[];
  /** The lot's travel entries (`Lot.travel`). */
  travel: readonly Travel[];
}

export interface MarketAccessResult {
  /** False while the farm has no destination: M is left out of every score (D20). */
  on: boolean;
  by_crop: Record<string, CropAccess>;
  /** Per-crop M for `rotations({ marketAccess })`; `null` while off. */
  scores: Record<string, number | null> | null;
  /** Destinations with no usable travel time on this lot yet. */
  pending_destination_ids: string[];
}

interface Reach {
  destination: Destination;
  travel: Travel;
}

/** Shortest time; ties go to the more trusted source, then the earlier destination. */
function nearest(reach: readonly Reach[]): Reach | null {
  let best: Reach | null = null;
  for (const r of reach) {
    if (
      best === null ||
      r.travel.minutes < best.travel.minutes ||
      (r.travel.minutes === best.travel.minutes && SOURCE_RANK[r.travel.source] < SOURCE_RANK[best.travel.source])
    ) {
      best = r;
    }
  }
  return best;
}

/** Market access per crop on one lot (docs/07 §3c). */
export function marketAccess(input: MarketAccessInput): MarketAccessResult {
  const { crops, destinations, travel } = input;
  if (destinations.length === 0) {
    return { on: false, by_crop: {}, scores: null, pending_destination_ids: [] };
  }

  const reach: Reach[] = [];
  const pending_destination_ids: string[] = [];
  for (const d of destinations) {
    const t = pickTravel(travel, d.id);
    if (t === null) pending_destination_ids.push(d.id);
    else reach.push({ destination: d, travel: t });
  }
  const sale = reach.filter((r) => SALE_DESTINATION_TYPES.includes(r.destination.type));
  const storage = reach.filter((r) => r.destination.type === "storage");
  const hasSalePlace = destinations.some((d) => SALE_DESTINATION_TYPES.includes(d.type));
  const hasStoragePlace = destinations.some((d) => d.type === "storage");
  const bestSale = nearest(sale);

  const by_crop: Record<string, CropAccess> = {};
  const scores: Record<string, number | null> = {};
  for (const crop of crops) {
    const p = crop.perishability;
    const empty: CropAccess = {
      crop_id: crop.id,
      score: null,
      gap: null,
      perishability: p,
      destination_id: null,
      destination_type: null,
      minutes: null,
      source: null,
      source_label: null,
      confidence: null,
      ask_to_confirm: false,
      via_storage: false,
      sale_minutes: bestSale?.travel.minutes ?? null,
      ok_minutes: p ? ACCESS_MINUTES[p].ok : null,
      max_minutes: p ? ACCESS_MINUTES[p].max : null,
    };

    let a: CropAccess;
    if (p === null) {
      a = { ...empty, gap: "perishability-unknown" };
    } else {
      const canStore = STORAGE_PERISHABILITY.includes(p);
      if (!hasSalePlace && !(canStore && hasStoragePlace)) {
        a = { ...empty, gap: "no-sale-point" };
      } else {
        const best = canStore ? nearest([...sale, ...storage]) : bestSale;
        if (best === null) {
          a = { ...empty, gap: "travel-pending" };
        } else {
          const info = TRAVEL_SOURCE_INFO[best.travel.source];
          a = {
            ...empty,
            score: accessScore(best.travel.minutes, p),
            destination_id: best.destination.id,
            destination_type: best.destination.type,
            minutes: best.travel.minutes,
            source: best.travel.source,
            source_label: info.label,
            confidence: info.confidence,
            ask_to_confirm: info.ask_to_confirm,
            via_storage: best.destination.type === "storage",
          };
        }
      }
    }
    by_crop[crop.id] = a;
    scores[crop.id] = a.score;
  }
  return { on: true, by_crop, scores, pending_destination_ids };
}
