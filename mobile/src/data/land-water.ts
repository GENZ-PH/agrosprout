// Natural Earth 1:10m land and lakes for the Philippines, bundled so the "looks like water" check on a lot works
// offline. Public domain, "Made with Natural Earth"; built by pipeline/build_land_water.py.
import raw from "../../assets/data/land-water-ph.json";
import { prepareLandWater, type LandWaterData, type LandWaterIndex } from "../lots/land-water-core";

export const LAND_WATER: LandWaterIndex = prepareLandWater(raw as unknown as LandWaterData);
