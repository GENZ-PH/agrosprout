// The crop library (#11), bundled so the crop picker (S2) and the engine work
// offline. Data: mobile/assets/data/crops.json, checked against the `Crop`
// contract and rule 3 (a source for every value) by crops.test.ts.
// The list itself is still a draft: D24 is open (see meta.status in the file).
import raw from "../../assets/data/crops.json";
import type { Crop, CropLibrary } from "../types";

export const CROP_LIBRARY = raw as CropLibrary;

/** The library entry for a crop id, or undefined if the library has no such crop. */
export const cropById = (id: string): Crop | undefined => CROP_LIBRARY.crops.find((c) => c.id === id);
