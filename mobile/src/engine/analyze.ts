// One call from a stored farm to everything a lot's screens show (docs/06-architecture.md, #29, #34).
// Pure TypeScript (no React Native imports). It only calls the engine entry points in the right
// order, with the same inputs each time, so the screens do not have to know that order.
//
//   climate (+ optional what-if scenario)
//     -> market access (needs the farm's places and the lot's travel times)
//     -> rotation options A-D (needs access and the priority sliders)
//     -> explanations, soil-health lines, planting windows, crop fit, trips per harvest
//
// Nothing here invents a value: a missing input stays `null` or becomes a `gap`.
import type { Crop, CropLibrary, Destination, Farm, Lot, LotData } from "../types";
import { marketAccess, pickTravel, type MarketAccessResult } from "./access";
import { cropFit, type CropFit } from "./cropFit";
import { explain, type Explanation } from "./explain";
import { harvestMonthMinutes, tripHours, tripsPerHarvest, type HarvestTrips } from "./harvestTrips";
import { plantingWindow, type PlantingWindowResult } from "./plantingWindow";
import { rotations, type RotationsResult } from "./rotations";
import { applyScenario, type Scenario, type ScenarioResult } from "./scenario";
import { soilHealth, type SoilHealthResult } from "./soilHealth";

export interface AnalyzeLotInput {
  /** Only the parts the engine reads: the places and the priority sliders. */
  farm: Pick<Farm, "destinations" | "priorities">;
  lot: Lot;
  /** The lot's climate data: live (`lotdata:<id>`) or the bundled demo farm. */
  data: LotData;
  library: CropLibrary;
  /** What-if rainfall and temperature change (#47). `null` or omitted = today's climate. */
  scenario?: Scenario | null;
}

/** Trips for one crop's harvest to one place, with the road time that goes with it. */
export interface HarvestLeg {
  crop_id: string;
  destination_id: string;
  trips: HarvestTrips;
  /** One-way minutes in the harvest month (wet-season factor applied), or `null` with no travel time yet. */
  one_way_minutes: number | null;
  /** Where the travel time came from (`farmer` wins), or `null` with no travel time yet. */
  travel_source: "farmer" | "route" | "estimate" | null;
  /** Hours on the road for the whole harvest, or `null` when trips or minutes are unknown. */
  hours: number | null;
}

export type AnalyzeGap =
  | { code: "unknown-crop"; crop_id: string }
  | { code: "no-crops" };

export interface LotAnalysis {
  lot_id: string;
  /**
   * 1 = the farmer has not given any planting months yet, so option A uses each crop's typical
   * calendar, labeled "assumed". 2 = at least one crop has months (#34).
   */
  stage: 1 | 2;
  /** Set when a what-if scenario is on: the climate used, and the "what if, not a forecast" notes. */
  scenario: ScenarioResult | null;
  /** The climate every result below was computed from (the scenario's, when one is on). */
  monthly: LotData["monthly"];
  /** "Your crops here": one entry per crop the farmer chose. */
  crop_fits: CropFit[];
  access: MarketAccessResult;
  rotations: RotationsResult;
  /** One per option in `rotations.options`, same order. */
  explanations: Explanation[];
  soil_health: SoilHealthResult;
  /** "Your months vs better months"; its `gaps` say which crops have no months yet. */
  planting: PlantingWindowResult;
  /** "Getting your harvest out": one entry per crop and place. Empty while the farm has no place. */
  harvest: HarvestLeg[];
  gaps: AnalyzeGap[];
}

/** Everything the dashboard (S3) and the months screens (S4, S5) show for one lot. */
export function analyzeLot(input: AnalyzeLotInput): LotAnalysis {
  const { farm, lot, library } = input;
  const scenario = input.scenario ? applyScenario(input.data, input.scenario) : null;
  // Same lot data with the scenario's climate swapped in: every call below sees one consistent climate.
  const data: LotData = scenario ? { ...input.data, monthly: scenario.monthly } : input.data;

  const byId = new Map<string, Crop>(library.crops.map((c) => [c.id, c]));
  const gaps: AnalyzeGap[] = [];
  if (lot.crops.length === 0) gaps.push({ code: "no-crops" });

  const crop_fits: CropFit[] = [];
  for (const lc of lot.crops) {
    const crop = byId.get(lc.crop_id);
    if (!crop) {
      gaps.push({ code: "unknown-crop", crop_id: lc.crop_id });
      continue;
    }
    crop_fits.push(cropFit({ crop, lotCrop: lc, details: lot.details, data, library }));
  }

  // Market access is scored for every crop in the library, so alternatives can use it too.
  const access = marketAccess({ crops: library.crops, destinations: farm.destinations, travel: lot.travel });
  const rot = rotations({ lot, data, library, priorities: farm.priorities, marketAccess: access.scores });

  const explanations = explain({ result: rot, lot, data, library, access, destinations: farm.destinations });
  const soil_health = soilHealth(rot.options);
  const planting = plantingWindow({ lot, data, library });

  return {
    lot_id: lot.id,
    stage: lot.crops.some((c) => c.seasons.length > 0) ? 2 : 1,
    scenario,
    monthly: data.monthly,
    crop_fits,
    access,
    rotations: rot,
    explanations,
    soil_health,
    planting,
    harvest: harvestLegs(lot, farm.destinations, byId, data),
    gaps,
  };
}

function harvestLegs(lot: Lot, destinations: readonly Destination[], byId: Map<string, Crop>, data: LotData): HarvestLeg[] {
  const legs: HarvestLeg[] = [];
  for (const lc of lot.crops) {
    const crop = byId.get(lc.crop_id);
    if (!crop) continue;
    // The first season's harvest month sets the wet-season road factor; with no months given there is none.
    const harvestMonth = lc.seasons[0]?.harvest_month ?? null;
    for (const destination of destinations) {
      const trips = tripsPerHarvest({ crop, lot, destination });
      const travel = pickTravel(lot.travel, destination.id);
      const minutes = travel ? (harvestMonth ? harvestMonthMinutes(travel.minutes, harvestMonth, data.monthly) : travel.minutes) : null;
      legs.push({
        crop_id: crop.id,
        destination_id: destination.id,
        trips,
        one_way_minutes: minutes,
        travel_source: travel ? travel.source : null,
        hours: trips.trips !== null && minutes !== null ? tripHours(trips.trips, minutes) : null,
      });
    }
  }
  return legs;
}
