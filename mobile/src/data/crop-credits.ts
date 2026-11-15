// Credits for the crop pictures in mobile/assets/crops/ (#169). Each picture is a square crop, resized
// to 160 px, of a Wikimedia Commons photo (so each is a modified copy). Same list as THIRD_PARTY.md.
// Authors are written as each Commons file page asks to be credited (checked against the Commons API
// on 2026-11-15). Shown on the Licenses and credits screen (app/credits.tsx).
export type CropPictureCredit = {
  crop: string;
  /** The Commons file name, as the title of the work. */
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  url: string;
};

export const CROP_PICTURE_CREDITS: readonly CropPictureCredit[] = [
  { crop: "Rice", title: "Rice plant.jpg", author: "Douglas Paul Perkins", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", url: "https://commons.wikimedia.org/wiki/File:Rice_plant.jpg" },
  { crop: "Corn", title: "Starr-160618-0718-Zea mays-immature cob with silks-Hawea Pl Olinda-Maui (28067473235).jpg", author: "Forest and Kim Starr", license: "CC BY 3.0 US", licenseUrl: "https://creativecommons.org/licenses/by/3.0/us/", url: "https://commons.wikimedia.org/wiki/File:Starr-160618-0718-Zea_mays-immature_cob_with_silks-Hawea_Pl_Olinda-Maui_(28067473235).jpg" },
  { crop: "Mung bean", title: "Bean pod of Vigna radiata (mung bean).jpg", author: "Sanjay ach at the English-language Wikipedia", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Bean_pod_of_Vigna_radiata_(mung_bean).jpg" },
  { crop: "Peanut", title: "Peanut 9417.jpg", author: "Pollinator", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Peanut_9417.jpg" },
  { crop: "Soybean", title: "Soybean Pods (10059910446).jpg", author: "United Soybean Board", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", url: "https://commons.wikimedia.org/wiki/File:Soybean_Pods_(10059910446).jpg" },
  { crop: "String bean", title: "Long Bean.JPG", author: "David", license: "Public domain", licenseUrl: "", url: "https://commons.wikimedia.org/wiki/File:Long_Bean.JPG" },
  { crop: "Sweet potato", title: "Ipomoea batatasL ja01.jpg", author: "miya", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Ipomoea_batatasL_ja01.jpg" },
  { crop: "Sorghum", title: "Sorghum 6364.jpg", author: "Chris Light", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Sorghum_6364.jpg" },
  { crop: "Eggplant", title: "Solanum melongena 24 08 2012 (1).JPG", author: "Joydeep", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Solanum_melongena_24_08_2012_(1).JPG" },
  { crop: "Sesbania rostrata", title: "Sesbania rostrata-NMNH-13374155.jpg", author: "NMNH (Smithsonian National Museum of Natural History, herbarium specimen)", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", url: "https://commons.wikimedia.org/wiki/File:Sesbania_rostrata-NMNH-13374155.jpg" },
  { crop: "Cabbage", title: "Chou cabus blanc 01.jpg", author: "Coyau", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Chou_cabus_blanc_01.jpg" },
  { crop: "Potato", title: "Potato tubers in pail.jpg", author: "Ruslan V. Albitsky aka pauk", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Potato_tubers_in_pail.jpg" },
  { crop: "Carrot", title: "Harvested Carrots.jpg", author: "Shark2025", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Harvested_Carrots.jpg" },
  { crop: "Onion", title: "Onion on White.JPG", author: "Colin", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Onion_on_White.JPG" },
  { crop: "Tomato", title: "Tomato je.jpg", author: "Softeis", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Tomato_je.jpg" },
  { crop: "Hot pepper", title: "Fresh Red Curly Chili Peppers (Capsicum annuum) Pile.jpg", author: "Undeka 11", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Fresh_Red_Curly_Chili_Peppers_(Capsicum_annuum)_Pile.jpg" },
  { crop: "Cassava", title: "Cassava roots for peeling.jpg", author: "Denis kasozi", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Cassava_roots_for_peeling.jpg" },
  { crop: "Cowpea", title: "Purple cowpea pods.jpg", author: "Fumikas Sagisavas", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", url: "https://commons.wikimedia.org/wiki/File:Purple_cowpea_pods.jpg" },
  { crop: "Squash", title: "Cucurbita moschata Butternut 2012 G2.jpg", author: "George Chernilevsky", license: "Public domain", licenseUrl: "", url: "https://commons.wikimedia.org/wiki/File:Cucurbita_moschata_Butternut_2012_G2.jpg" },
  { crop: "Cucumber", title: "ARS cucumber.jpg", author: "Stephen Ausmus, USDA ARS", license: "Public domain", licenseUrl: "", url: "https://commons.wikimedia.org/wiki/File:ARS_cucumber.jpg" },
  { crop: "Watermelon", title: "DFC 6158 Sweet summer ready to slice - ripe watermelons on display one halved to reveal its juicy red flesh.jpg", author: "PattayaPatrol", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:DFC_6158_Sweet_summer_ready_to_slice_-_ripe_watermelons_on_display_one_halved_to_reveal_its_juicy_red_flesh.jpg" },
  { crop: "Lettuce", title: "Lactuca sativa var. (2).jpg", author: "Prenn", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Lactuca_sativa_var._(2).jpg" },
];

/** What we changed in every bundled picture. */
export const CROP_PICTURE_CHANGES = "Cropped square and resized";

/** True for a CC BY-SA license: a changed copy must be shared under the same license. */
export const isShareAlike = (license: string) => /^cc by-sa\b/i.test(license.trim());

/** The license our changed copy is shared under: the same one for CC BY-SA, else null (no condition). */
export function adaptedCopyNote(c: Pick<CropPictureCredit, "license">): string | null {
  return isShareAlike(c.license) ? `Our changed copy is shared under the same license, ${c.license}.` : null;
}
