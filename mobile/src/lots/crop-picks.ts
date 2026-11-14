import type { Crop, DataStatus, Lot, LotCrop } from "../types";

// S2 crop picking (#25). No React Native imports, so it runs in Node tests.

/**
 * "+ Other": a crop the library doesn't have. Saved as `other:<name>`; the engine
 * reports it as an `unknown-crop` gap and leaves it out of the scores (the option
 * suggested in #25; the team confirms).
 */
export const OTHER_PREFIX = "other:";

export const isOtherCrop = (cropId: string) => cropId.startsWith(OTHER_PREFIX);
export const otherCropName = (cropId: string) => cropId.slice(OTHER_PREFIX.length);

/** `other:<name>` for a typed crop name, or `null` when the name is empty. */
export function otherCropId(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean ? `${OTHER_PREFIX}${clean}` : null;
}

/** "Lowland rice (irrigated or rainfed paddy)" → "Lowland rice". Same rule as the engine's explain text. */
export const cropShortName = (crop: Pick<Crop, "name">) => crop.name.replace(/\s*\(.*\)\s*$/, "").trim() || crop.name;

/** Adds the crop with no months yet (= typical calendar, labelled assumed), or removes it. Other crops keep their months. */
export function toggleCrop(crops: LotCrop[], cropId: string): LotCrop[] {
  return crops.some((c) => c.crop_id === cropId)
    ? crops.filter((c) => c.crop_id !== cropId)
    : [...crops, { crop_id: cropId, seasons: [] }];
}

/**
 * One crop per lot (D13, changed by the team 2026-11-14): the chosen crop replaces whatever the lot had.
 * A crop already on the lot keeps its months. Unchanged `crops` when it is already the only crop.
 */
export function chooseCrop(crops: LotCrop[], cropId: string): LotCrop[] {
  if (crops.length === 1 && crops[0].crop_id === cropId) return crops;
  return [crops.find((c) => c.crop_id === cropId) ?? { crop_id: cropId, seasons: [] }];
}

/** Lots that have no crop picked yet. */
export const lotsWithoutCrops = (lots: Pick<Lot, "name" | "crops">[]) => lots.filter((l) => l.crops.length === 0);

export type DataLine = { text: string; tone: "waiting" | "ready" | "error" };

/** The per-lot progress line for the lot's NASA data (driven by `data_status`). */
export function dataLine(status: DataStatus, online: boolean): DataLine {
  if (status === "ready") return { text: "NASA climate data ready", tone: "ready" };
  if (status === "error") return { text: "Couldn't load the NASA climate data.", tone: "error" };
  return online
    ? { text: "Getting NASA climate data…", tone: "waiting" }
    : { text: "Waiting for internet. The NASA data loads when you're back online.", tone: "waiting" };
}
