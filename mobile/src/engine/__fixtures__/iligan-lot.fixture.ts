// TEST FIXTURE for engine unit tests (#22). Not demo data; never ship it as real farm data.
// Built 2026-11-14 from the NASA POWER monthly point API (community AG, 2001-2024)
// at 8.2° N, 124.2° E (Iligan area, rounded to 0.1° as live lots are), using
// the parsing rules in #6 and ET0 from src/data/et0.ts. Regenerate with power.ts
// (#6) once it lands. ET0 warnings: ["Elevation not supplied: sea level (0 m) assumed."]
import type { LotData } from "../../types";

export const ILIGAN_LOT_FIXTURE: LotData = {
  "id": "fixture-iligan",
  "name": null,
  "kind": "live",
  "lat": 8.2,
  "lon": 124.2,
  "elevation_m": null,
  "slope_pct": null,
  "period": "2001-2024",
  "monthly": {
    "precip_mm": {
      "p20": [
        71.1,
        47.2,
        35.8,
        48.7,
        135.8,
        235,
        227.7,
        176.9,
        203.7,
        188.1,
        120.4,
        110
      ],
      "p50": [
        130.5,
        92.3,
        88.7,
        74.4,
        198.9,
        265.4,
        276.7,
        217.2,
        271.2,
        261.3,
        182.1,
        193.4
      ],
      "p80": [
        259.1,
        176.8,
        127.8,
        136.5,
        269.4,
        329.9,
        345.8,
        258.6,
        306,
        338.5,
        230.1,
        262.7
      ]
    },
    "et0_mm": [
      85.4,
      90.3,
      119.2,
      127.7,
      123.1,
      107,
      105.4,
      108.9,
      103.6,
      104.4,
      94.2,
      88.9
    ],
    "tmax_c": [
      27.85,
      28.72,
      30.24,
      31.53,
      31.18,
      29.17,
      28.32,
      28.27,
      28.21,
      28.37,
      28.23,
      28.17
    ],
    "tmin_c": [
      16.44,
      15.59,
      16.39,
      17.33,
      19.56,
      19.44,
      19.19,
      19.18,
      18.95,
      19.01,
      18.18,
      17.14
    ],
    "rootzone_wetness": [
      0.903,
      0.85,
      0.787,
      0.74,
      0.764,
      0.848,
      0.922,
      0.939,
      0.954,
      0.965,
      0.953,
      0.926
    ],
    "rh2m_pct": [
      88.72,
      85.9,
      82.29,
      78.94,
      83.2,
      86.61,
      88.27,
      88.13,
      88.58,
      88.58,
      87.71,
      88.08
    ],
    "ws2m_ms": [
      2.01,
      2.08,
      1.83,
      1.54,
      1.34,
      1.43,
      1.74,
      1.82,
      1.71,
      1.62,
      1.48,
      1.69
    ],
    "solar_mj_m2_day": [
      15.04,
      17.46,
      20.02,
      21.35,
      19.7,
      18.32,
      18,
      18.71,
      18.49,
      18.07,
      16.97,
      15.58
    ],
    "heat_days_gt35": null,
    "heavy_rain_days_gt50mm": null,
    "smap_rootzone_m3m3": null
  },
  "trends": null,
  "provenance": [
    {
      "field": "monthly.precip_mm",
      "source": "NASA POWER PRECTOTCORR",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mm/day x days in month (leap Februaries counted); P20/P50/P80 across the 24 years, linear interpolation"
    },
    {
      "field": "monthly.tmax_c",
      "source": "NASA POWER T2M_MAX",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mean of monthly values across years"
    },
    {
      "field": "monthly.tmin_c",
      "source": "NASA POWER T2M_MIN",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mean of monthly values across years"
    },
    {
      "field": "monthly.rootzone_wetness",
      "source": "NASA POWER GWETROOT",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mean of monthly values across years"
    },
    {
      "field": "monthly.rh2m_pct",
      "source": "NASA POWER RH2M",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mean of monthly values across years"
    },
    {
      "field": "monthly.ws2m_ms",
      "source": "NASA POWER WS2M",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mean of monthly values across years"
    },
    {
      "field": "monthly.solar_mj_m2_day",
      "source": "NASA POWER ALLSKY_SFC_SW_DWN",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "mean of monthly values across years; unit MJ/m^2/day per the response"
    },
    {
      "field": "monthly.et0_mm",
      "source": "FAO-56 Penman-Monteith (src/data/et0.ts) from NASA POWER monthly means",
      "native_res": "0.5° x 0.625°",
      "period": "2001-2024",
      "retrieved": "2026-11-14",
      "note": "elevation unknown, sea level used"
    }
  ],
  "caveats": [
    "TEST FIXTURE for engine unit tests. Not shipped as demo data.",
    "NASA POWER grid cell, mean elevation 742 m: the cell includes highland terrain, so temperatures may read cooler than at a lowland field.",
    "Elevation unknown: ET0 computed at sea level.",
    "Lots in the same NASA POWER grid cell get identical climate."
  ]
};
