// TEST FIXTURE for engine unit tests (#22, #23). Not shipped data.
// Three crops copied verbatim (by script, not retyped) from the cited crops.json
// draft on the app-mvp branch (app/public/data/crops.json, meta.version 0.1.0).
// Every number keeps its citation in `sources`. Swap for the real
// mobile/assets/data/crops.json once #11 lands.
import type { CropLibrary } from "../../types";

export const CROP_LIBRARY_FIXTURE: CropLibrary = {
  "meta": {
    "note": "TEST FIXTURE: 3 crops copied verbatim from the cited crops.json draft (app-mvp branch, version 0.1.0, generated 2026-11-14). Replace with mobile/assets/data/crops.json once #11 lands."
  },
  "rice_extra_mm": 180,
  "rice_extra_detail": {
    "percolation_seepage_mm_per_day": {
      "heavy_clay": 4,
      "average": 6,
      "sandy": 8
    },
    "land_prep_saturation_mm_once": 200,
    "water_layer_establishment_mm_once": 100,
    "how_rice_extra_mm_was_derived": "6 mm/day average percolation and seepage x 30 days = 180 mm/month while ponded. Add 200 mm in the month before transplanting (soil saturation for puddling) and 100 mm in the transplanting month (water layer). Use 4 mm/day for clayey and 8 mm/day for sandy soil feel.",
    "citation": "Brouwer, C., Heibloem, M. 1986. FAO Irrigation Water Management Training Manual No. 3, Section 4.4 Irrigation water need of rice: SAT = 200 mm, PERC 4-8 mm/day (heavy clay 4, sandy 8, average 6), WL = 100 mm",
    "url": "https://www.fao.org/4/s2022e/s2022e08.htm"
  },
  "taw_mm_per_m": {
    "sandy": {
      "min": 50,
      "max": 110,
      "fao_texture_class": "Sand (thetaFC - thetaWP 0.05-0.11 m3/m3); loamy sand is 0.06-0.12"
    },
    "loamy": {
      "min": 130,
      "max": 180,
      "fao_texture_class": "Loam (0.13-0.18 m3/m3); sandy loam is 0.11-0.15, silt loam 0.13-0.19"
    },
    "clayey": {
      "min": 120,
      "max": 200,
      "fao_texture_class": "Clay (0.12-0.20 m3/m3); silty clay is 0.13-0.19"
    },
    "citation": "FAO-56 Table 19, typical soil water characteristics: (thetaFC - thetaWP) in m3/m3, multiplied by 1000 to give mm of water per m of root depth. TAW = 1000 (thetaFC - thetaWP) Zr (FAO-56 Eq. 82)",
    "url": "https://www.fao.org/4/x0490e/x0490e0c.htm"
  },
  "crops": [
    {
      "id": "lowland-rice",
      "name": "Lowland rice (irrigated or rainfed paddy)",
      "local_name": "Humay",
      "family": "Poaceae",
      "season_days": 112,
      "stages_days": [
        30,
        30,
        60,
        30
      ],
      "kc": [
        1.05,
        1.2,
        0.6
      ],
      "root_depth_m": [
        0.5,
        1.0
      ],
      "p_depletion": 0.2,
      "temp_c": {
        "min": 16,
        "opt_low": 25,
        "opt_high": 35,
        "max": 38
      },
      "drought_tolerance": "low",
      "waterlogging_tolerance": "high",
      "n_fixing": false,
      "labor": null,
      "market": null,
      "cover_value": null,
      "perishability": "low",
      "storable_if_dried": true,
      "yield_t_per_ha": 4.53,
      "typical_calendar": [
        {
          "plant_month": 6,
          "harvest_month": 10
        },
        {
          "plant_month": 11,
          "harvest_month": 3
        }
      ],
      "sources": [
        {
          "field_or_fields": "local_name",
          "citation": "Wiktionary, Cebuano 'humay': the grass Oryza sativa; rice",
          "url": "https://en.wiktionary.org/wiki/humay"
        },
        {
          "field_or_fields": "family",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; Oryza sativa listed under Gramineae (Poaceae)",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "season_days",
          "citation": "PhilRice Rice Variety Database, NSIC Rc216 (a widely grown inbred): maturity 112 days",
          "url": "https://dbmp.philrice.gov.ph/seeds/content/seed_characteristics/varietychar.php?Vchars=65"
        },
        {
          "field_or_fields": "stages_days",
          "citation": "Allen et al. 1998, FAO Irrigation and Drainage Paper 56, Table 11 (stage lengths, days); row 'Rice, Dec; May, Tropics; Mediterranean' 30/30/60/30 = 150 days (the other Tropics row is 180 days). FAO-56 says to rescale stages to local season length",
          "url": "https://www.fao.org/4/x0490e/x0490e0b.htm"
        },
        {
          "field_or_fields": "kc",
          "citation": "Allen et al. 1998, FAO-56 Table 12 (single Kc for non-stressed crops in a sub-humid standard climate, RHmin about 45%, u2 about 2 m/s; Kc mid and Kc end need adjustment for the humid Philippine climate); Rice: Kc ini 1.05, Kc mid 1.20, Kc end 0.90-0.60. Lower end 0.60 chosen because FAO-56 says more humid climates have lower Kc end. FAO-56 Table 14 gives Kc ini 1.05 for sub-humid to humid climate with light wind",
          "url": "https://www.fao.org/4/x0490e/x0490e0b.htm"
        },
        {
          "field_or_fields": "root_depth_m, p_depletion",
          "citation": "Allen et al. 1998, FAO-56 Table 22 (maximum effective rooting depth Zr and depletion fraction p for ETc about 5 mm/day); Rice: Zr 0.5-1.0 m, p 0.20 (footnote 4: p for rice is 0.20 of saturation)",
          "url": "https://www.fao.org/4/x0490e/x0490e0e.htm"
        },
        {
          "field_or_fields": "temp_c",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; entry Oryza sativa ssp. indica (EcoPort 8143): TMIN 16, TOPMN 25, TOPMX 35, TMAX 38. The generic Oryza sativa entry gives 10/20/30/36; indica chosen because Philippine lowland rice is indica",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "waterlogging_tolerance",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; Oryza sativa optimal drainage 'poorly (saturated >50% of year)'. Rule used: optimal drainage includes 'poorly' = high",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "drought_tolerance",
          "citation": "Allen et al. 1998, FAO-56 Table 22 (maximum effective rooting depth Zr and depletion fraction p for ETc about 5 mm/day); rice has the lowest p of all crops in the table (0.20 of saturation), meaning stress starts after very little soil drying; Ecocrop minimum annual rainfall for indica rice is 1000 mm, the highest among these crops",
          "url": "https://www.fao.org/4/x0490e/x0490e0e.htm"
        },
        {
          "field_or_fields": "perishability, storable_if_dried",
          "citation": "IRRI Rice Knowledge Bank, Storage: safe storage of rice for longer periods is possible if grain is kept at 14% moisture or less and protected from pests and re-wetting",
          "url": "http://www.knowledgebank.irri.org/step-by-step-production/postharvest/storage"
        },
        {
          "field_or_fields": "yield_t_per_ha",
          "citation": "PSA OpenSTAT table 'Palay and Corn: Volume of Production' and 'Area Harvested', Palay (all ecosystems), Lanao del Norte, 2022-2024: production 600,225.78 t, area 132,605.72 ha, yield 4.53 t/ha (computed). For reference: irrigated 4.62, rainfed 4.08 t/ha in the same province and years",
          "url": "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/0012E4EVCP0.px"
        },
        {
          "field_or_fields": "typical_calendar",
          "citation": "FAO GIEWS Country Brief Philippines, 29 January 2026, crop calendar graphic (national, not regional): rice main season sowing about April-June, harvest about September-December; rice second season sowing about October-December, harvest about January-April. Months chosen inside these windows so plant-to-harvest is about 4 months. Lanao del Norte specific calendar not found",
          "url": "https://www.fao.org/giews/countrybrief/country.jsp?code=PHL&lang=en"
        }
      ],
      "unverified": [
        "labor",
        "market",
        "cover_value"
      ],
      "notes": "Rice likes standing water, so it fits low, wet fields where other crops would rot."
    },
    {
      "id": "corn",
      "name": "Corn (maize, grain)",
      "local_name": "Mais",
      "family": "Poaceae",
      "season_days": 95,
      "stages_days": [
        20,
        35,
        40,
        30
      ],
      "kc": [
        0.3,
        1.2,
        0.6
      ],
      "root_depth_m": [
        1.0,
        1.7
      ],
      "p_depletion": 0.55,
      "temp_c": {
        "min": 10,
        "opt_low": 18,
        "opt_high": 33,
        "max": 47
      },
      "drought_tolerance": "low",
      "waterlogging_tolerance": "low",
      "n_fixing": false,
      "labor": null,
      "market": null,
      "cover_value": null,
      "perishability": "low",
      "storable_if_dried": true,
      "yield_t_per_ha": 3.19,
      "typical_calendar": [
        {
          "plant_month": 5,
          "harvest_month": 8
        },
        {
          "plant_month": 11,
          "harvest_month": 2
        }
      ],
      "sources": [
        {
          "field_or_fields": "local_name",
          "citation": "Wiktionary, Cebuano 'mais': maize, Zea mays; corn",
          "url": "https://en.wiktionary.org/wiki/mais"
        },
        {
          "field_or_fields": "family",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; Zea mays listed under Gramineae (Poaceae)",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "season_days",
          "citation": "PNS/BAFS 27:2018 Code of Practice for the Prevention and Reduction of Aflatoxin in Corn (DA-BAFS), 4.2.2: harvest at physiological maturity, about 90-100 DAP for white corn and 100-120 DAP for yellow corn. White corn is about 86% of Lanao del Norte corn area (PSA 2022-2024), so the midpoint of 90-100 days was used",
          "url": "https://ppssd.buplant.da.gov.ph/storage/app/public/LegalReference/PNS_BAFS%2027_2018%20COP%20Aflatoxin%20in%20corn.pdf"
        },
        {
          "field_or_fields": "stages_days",
          "citation": "Allen et al. 1998, FAO Irrigation and Drainage Paper 56, Table 11 (stage lengths, days); row 'Maize (grain), June, Nigeria (humid)' 20/35/40/30 = 125 days, chosen as the humid tropical row",
          "url": "https://www.fao.org/4/x0490e/x0490e0b.htm"
        },
        {
          "field_or_fields": "kc",
          "citation": "Allen et al. 1998, FAO-56 Table 12 (single Kc for non-stressed crops in a sub-humid standard climate, RHmin about 45%, u2 about 2 m/s; Kc mid and Kc end need adjustment for the humid Philippine climate); Maize field (grain): Kc ini 0.3 (cereals group), Kc mid 1.20, Kc end 0.60-0.35. Footnote 11: 0.60 is for harvest at high grain moisture, 0.35 after full field drying. 0.60 chosen because PNS/BAFS 27:2018 recommends harvest at physiological maturity followed by drying",
          "url": "https://www.fao.org/4/x0490e/x0490e0b.htm"
        },
        {
          "field_or_fields": "root_depth_m, p_depletion",
          "citation": "Allen et al. 1998, FAO-56 Table 22 (maximum effective rooting depth Zr and depletion fraction p for ETc about 5 mm/day); Maize, field (grain): Zr 1.0-1.7 m, p 0.55",
          "url": "https://www.fao.org/4/x0490e/x0490e0e.htm"
        },
        {
          "field_or_fields": "temp_c",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; entry Zea mays ssp. mays (EcoPort 238663): 10/18/33/47",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "drought_tolerance",
          "citation": "FAO-56 Table 24 (seasonal yield response factor Ky from FAO Paper 33): maize Ky 1.25, the highest of the crops here that are listed. Ky above 1 means yield falls faster than water use, so the crop is sensitive to drought",
          "url": "https://www.fao.org/4/x0490e/x0490e0e.htm"
        },
        {
          "field_or_fields": "waterlogging_tolerance",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; Zea mays ssp. mays drainage range 'well (dry spells), excessive'; no poorly drained class. Rule used: no 'poorly' in range = low",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "perishability, storable_if_dried",
          "citation": "PNS/BAFS 27:2018: shelled corn is dried and stored; for stocks held more than a month, pest control is required",
          "url": "https://ppssd.buplant.da.gov.ph/storage/app/public/LegalReference/PNS_BAFS%2027_2018%20COP%20Aflatoxin%20in%20corn.pdf"
        },
        {
          "field_or_fields": "yield_t_per_ha",
          "citation": "PSA OpenSTAT 'Palay and Corn' tables, Corn (white + yellow), Lanao del Norte, 2022-2024: production 981,399.05 t, area 307,556.70 ha, yield 3.19 t/ha (computed). White corn alone 3.02, yellow corn 4.27 t/ha",
          "url": "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/0012E4EVCP0.px"
        },
        {
          "field_or_fields": "typical_calendar",
          "citation": "FAO GIEWS Country Brief Philippines, 29 January 2026, crop calendar graphic (national): maize main season sowing about April-June, harvest about July-September; second season sowing about October-December, harvest about January-April. Lanao del Norte specific calendar not found",
          "url": "https://www.fao.org/giews/countrybrief/country.jsp?code=PHL&lang=en"
        }
      ],
      "unverified": [
        "labor",
        "market",
        "cover_value"
      ],
      "notes": "Corn needs steady rain at flowering, so a dry spell then can cut the harvest hard."
    },
    {
      "id": "mungbean",
      "name": "Mungbean",
      "local_name": "Mungo",
      "family": "Fabaceae",
      "season_days": 65,
      "stages_days": [
        20,
        30,
        30,
        20
      ],
      "kc": [
        0.4,
        1.05,
        0.35
      ],
      "root_depth_m": [
        0.6,
        1.0
      ],
      "p_depletion": 0.45,
      "temp_c": {
        "min": 8,
        "opt_low": 21,
        "opt_high": 36,
        "max": 40
      },
      "drought_tolerance": "medium",
      "waterlogging_tolerance": "low",
      "n_fixing": true,
      "labor": null,
      "market": null,
      "cover_value": null,
      "perishability": "low",
      "storable_if_dried": true,
      "yield_t_per_ha": 0.63,
      "typical_calendar": [
        {
          "plant_month": 5,
          "harvest_month": 7
        },
        {
          "plant_month": 9,
          "harvest_month": 11
        },
        {
          "plant_month": 2,
          "harvest_month": 4
        }
      ],
      "sources": [
        {
          "field_or_fields": "local_name",
          "citation": "StuartXchange (G. Stuart), Philippine Medicinal Plants, Mongo: 'Mungo (Tag., Bis.)', 'Mongo (Tag.)'",
          "url": "https://www.stuartxchange.org/Mongo.html"
        },
        {
          "field_or_fields": "family",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; Vigna radiata under Leguminosae (Fabaceae)",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "season_days, typical_calendar, drought_tolerance, waterlogging_tolerance, n_fixing, perishability, storable_if_dried",
          "citation": "DA High Value Crops Development Program, Mungbean Production Guide: harvest 60-70 days after planting (65 used, the midpoint); Philippine seasons wet May-June, dry September-October, late dry February-March (national); 'relatively tolerant to drought'; 'sensitive to extended periods of water-logging'; N through symbiosis with N-fixing bacteria; store seeds in tight containers in a cool dry place",
          "url": "https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Mungbean-Production-Guide.pdf"
        },
        {
          "field_or_fields": "stages_days",
          "citation": "Allen et al. 1998, FAO Irrigation and Drainage Paper 56, Table 11 (stage lengths, days); row 'Green gram, cowpeas, March, Mediterranean' 20/30/30/20 = 110 days (only row for mungbean; longer than Philippine varieties, rescale to season_days)",
          "url": "https://www.fao.org/4/x0490e/x0490e0b.htm"
        },
        {
          "field_or_fields": "kc",
          "citation": "Allen et al. 1998, FAO-56 Table 12 (single Kc for non-stressed crops in a sub-humid standard climate, RHmin about 45%, u2 about 2 m/s; Kc mid and Kc end need adjustment for the humid Philippine climate); Green gram and cowpeas: Kc ini 0.4 (legumes group), Kc mid 1.05, Kc end 0.60-0.35 (footnote 6: first value harvested fresh, second harvested dry). 0.35 used for dry grain",
          "url": "https://www.fao.org/4/x0490e/x0490e0b.htm"
        },
        {
          "field_or_fields": "root_depth_m, p_depletion",
          "citation": "Allen et al. 1998, FAO-56 Table 22 (maximum effective rooting depth Zr and depletion fraction p for ETc about 5 mm/day); Green gram and cowpeas: Zr 0.6-1.0 m, p 0.45",
          "url": "https://www.fao.org/4/x0490e/x0490e0e.htm"
        },
        {
          "field_or_fields": "temp_c",
          "citation": "FAO Ecocrop database, as redistributed in full by the OpenCLIM/ecocrop project (EcoCrop_DB.csv); fields TMIN, TOPMN, TOPMX, TMAX (deg C) and drainage fields DRA/DRAR. The official FAO Ecocrop viewer now requires a Google sign-in, so the mirror was used; Vigna radiata (EcoPort 2150): 8/21/36/40. The DA guide gives an optimum of 20-30 C",
          "url": "https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv"
        },
        {
          "field_or_fields": "yield_t_per_ha",
          "citation": "PSA OpenSTAT 'Vegetables and Root Crops' production and area, Mongo [Mungbean], Lanao del Norte, 2022-2024: production 563.30 t, area 896 ha, yield 0.63 t/ha (computed)",
          "url": "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/0082E4EVCP3.px"
        }
      ],
      "unverified": [
        "labor",
        "market",
        "cover_value"
      ],
      "notes": "Mungbean is a quick legume that adds nitrogen to the soil and fits between two rice or corn crops."
    }
  ]
};
