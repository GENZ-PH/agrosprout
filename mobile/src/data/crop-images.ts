import type { ImageSourcePropType } from "react-native";

// Crop pictures (#169): one small bundled picture per crop in the library, shown next to the
// crop's name on S2 and the dashboard. `null` = no picture, and the app shows a neutral
// placeholder. Nothing is fetched at run time (the app works offline).
//
// To add a picture: put the file in `mobile/assets/crops/` (about 96-128 px, about 100 KB or less),
// replace the `null` below with `require("../../assets/crops/<crop-id>.webp")`, and add its source,
// author and license under "Images, icons, and fonts" in THIRD_PARTY.md (rule 3). An SI-generated
// picture carries a visible "SI-generated" watermark and no NASA logo (rule 4).
//
// A crop is listed here only when it is in `assets/data/crops.json`; crop-images.test.ts fails if
// a library crop is missing from this list. Crops saved from the search ("other:<name>") have no
// entry and show the placeholder.
export const CROP_IMAGES: Readonly<Record<string, ImageSourcePropType | null>> = {
  "lowland-rice": require("../../assets/crops/lowland-rice.webp"),
  corn: require("../../assets/crops/corn.webp"),
  mungbean: require("../../assets/crops/mungbean.webp"),
  peanut: require("../../assets/crops/peanut.webp"),
  soybean: require("../../assets/crops/soybean.webp"),
  "string-bean": require("../../assets/crops/string-bean.webp"),
  "sweet-potato": require("../../assets/crops/sweet-potato.webp"),
  sorghum: require("../../assets/crops/sorghum.webp"),
  eggplant: require("../../assets/crops/eggplant.webp"),
  "sesbania-rostrata": require("../../assets/crops/sesbania-rostrata.webp"),
};

/** The picture for a crop id, or null when it has none yet (or is not in the library). */
export const cropImage = (cropId: string): ImageSourcePropType | null => CROP_IMAGES[cropId] ?? null;
