// Credits for the crop pictures in mobile/assets/crops/ (#169). Each picture is a square crop, resized
// to 160 px, of a Wikimedia Commons photo (so each is a modified copy). Same list as THIRD_PARTY.md.
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
  { crop: "Mung bean", title: "Bean pod of Vigna radiata (mung bean).jpg", author: "Sanjay Acharya", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Bean_pod_of_Vigna_radiata_(mung_bean).jpg" },
  { crop: "Peanut", title: "Peanut 9417.jpg", author: "Pollinator", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Peanut_9417.jpg" },
  { crop: "Soybean", title: "Soybean Pods (10059910446).jpg", author: "United Soybean Board", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", url: "https://commons.wikimedia.org/wiki/File:Soybean_Pods_(10059910446).jpg" },
  { crop: "String bean", title: "Long Bean.JPG", author: "David", license: "Public domain", licenseUrl: "", url: "https://commons.wikimedia.org/wiki/File:Long_Bean.JPG" },
  { crop: "Sweet potato", title: "Ipomoea batatasL ja01.jpg", author: "miya", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Ipomoea_batatasL_ja01.jpg" },
  { crop: "Sorghum", title: "Sorghum 6364.jpg", author: "Chris Light", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Sorghum_6364.jpg" },
  { crop: "Eggplant", title: "Solanum melongena 24 08 2012 (1).JPG", author: "Joydeep", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", url: "https://commons.wikimedia.org/wiki/File:Solanum_melongena_24_08_2012_(1).JPG" },
  { crop: "Sesbania rostrata", title: "Sesbania rostrata-NMNH-13374155.jpg", author: "NMNH (Smithsonian National Museum of Natural History, herbarium specimen)", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", url: "https://commons.wikimedia.org/wiki/File:Sesbania_rostrata-NMNH-13374155.jpg" },
];
