"""Tests for pipeline/aggregate.py and pipeline/build_demo.py (issue #8).

Run from the repo root:  python3 -m unittest discover -s pipeline -v
"""
import calendar
import math
import unittest

import aggregate as ag
import build_demo


def days(year, month):
    return [f"{year}{month:02d}{d:02d}" for d in range(1, calendar.monthrange(year, month)[1] + 1)]


class Percentile(unittest.TestCase):
    def test_linear_interpolation_like_power_ts(self):
        self.assertAlmostEqual(ag.percentile([1, 2, 3, 4, 5], 0.2), 1.8)
        self.assertEqual(ag.percentile([1, 2, 3, 4, 5], 0.5), 3)
        self.assertAlmostEqual(ag.percentile([5, 1, 3], 0.8), 4.2)
        self.assertIsNone(ag.percentile([], 0.5))


class Monthly(unittest.TestCase):
    def test_sum_mean_and_day_counts(self):
        feb = {k: 2.0 for k in days(2023, 2)}
        self.assertAlmostEqual(ag.monthly_stat(feb, "sum")[(2023, 2)], 56.0)
        self.assertAlmostEqual(ag.monthly_stat(feb, "mean")[(2023, 2)], 2.0)
        hot = {k: (36.0 if i < 3 else 30.0) for i, k in enumerate(days(2023, 4))}
        self.assertEqual(ag.monthly_stat(hot, "gt35")[(2023, 4)], 3)
        wet = {k: (60.0 if i == 0 else 0.0) for i, k in enumerate(days(2023, 4))}
        self.assertEqual(ag.monthly_stat(wet, "gt50")[(2023, 4)], 1)

    def test_exactly_the_limit_is_not_counted(self):
        d = {k: 35.0 for k in days(2023, 4)}
        self.assertEqual(ag.monthly_stat(d, "gt35")[(2023, 4)], 0)
        cold = {k: (-0.1 if i < 2 else 0.0) for i, k in enumerate(days(2023, 4))}
        self.assertEqual(ag.monthly_stat(cold, "lt0")[(2023, 4)], 2)  # 0.0 itself is not a frost day

    def test_many_missing_days_make_the_month_missing(self):
        d = {k: 1.0 for k in days(2023, 4)}
        for k in list(d)[:4]:  # 4 of 30 days = 13 % missing
            d[k] = None
        self.assertIsNone(ag.monthly_stat(d, "sum")[(2023, 4)])
        d2 = {k: 1.0 for k in days(2023, 4)}
        d2[list(d2)[0]] = None  # 1 of 30 missing: scaled to the full month
        self.assertAlmostEqual(ag.monthly_stat(d2, "sum")[(2023, 4)], 30.0)

    def test_partial_month_is_missing(self):
        d = {k: 1.0 for k in days(2023, 4)[:20]}
        self.assertIsNone(ag.monthly_stat(d, "mean")[(2023, 4)])

    def test_annual_needs_all_twelve_months(self):
        m = {(2020, i): 1.0 for i in range(1, 13)}
        m.update({(2021, i): 1.0 for i in range(1, 12)})
        self.assertEqual(ag.annual(m, "sum"), {2020: 12.0})


class Trends(unittest.TestCase):
    def test_sen_slope_ignores_an_outlier(self):
        xs = list(range(10))
        ys = [2.0 * x for x in xs]
        ys[4] = 100.0
        self.assertAlmostEqual(ag.sen_slope(xs, ys), 2.0)

    def test_mann_kendall_perfect_trend_and_no_trend(self):
        # n = 10, S = 45, var = 125, z = 44 / sqrt(125), two-sided p
        expected = math.erfc((44 / math.sqrt(125)) / math.sqrt(2))
        self.assertAlmostEqual(ag.mann_kendall_p(list(range(10))), expected)
        self.assertGreater(ag.mann_kendall_p([1, 3, 2, 4, 3, 2, 4, 1, 3, 2]), 0.5)
        self.assertIsNone(ag.mann_kendall_p([1, 2, 3]))

    def test_trend_per_decade(self):
        slope, p = ag.trend_per_decade({2000 + i: 100 + 5 * i for i in range(12)})
        self.assertAlmostEqual(slope, 50.0)
        self.assertLess(p, 0.01)


def synthetic_raw():
    """25 years of constant daily weather in the POWER response shape (synthetic)."""
    ymd = [k for y in range(2001, 2026) for m in range(1, 13) for k in days(y, m)]
    values = {"T2M": 26.0, "T2M_MAX": 31.0, "T2M_MIN": 22.0, "PRECTOTCORR": 6.0, "GWETROOT": 0.8,
              "GWETTOP": 0.8, "RH2M": 80.0, "ALLSKY_SFC_SW_DWN": 5.0, "WS2M": 1.5}
    return {
        "geometry": {"coordinates": [124.24, 8.23, 742.0]},
        "parameters": {"ALLSKY_SFC_SW_DWN": {"units": "kW-hr/m^2/day"}},
        "properties": {"parameter": {k: {d: v for d in ymd} for k, v in values.items()}},
    }


class Build(unittest.TestCase):
    farm = {"id": "t", "name": "Test", "lat": 8.23, "lon": 124.24, "elevation_m": None}

    def test_shape_and_values(self):
        out = build_demo.build(self.farm, synthetic_raw(), "2026-11-14")
        m = out["monthly"]
        self.assertEqual(out["kind"], "demo")
        self.assertEqual(out["period"], "2001-2025")
        for key in ("et0_mm", "tmax_c", "tmin_c", "rootzone_wetness", "heat_days_gt35"):
            self.assertEqual(len(m[key]), 12, key)
        self.assertEqual(len(m["precip_mm"]["p50"]), 12)
        self.assertAlmostEqual(m["precip_mm"]["p50"][0], 6.0 * 31)  # mm/day x days in month
        self.assertEqual(m["tmax_c"][0], 31.0)
        self.assertAlmostEqual(m["solar_mj_m2_day"][0], 5.0 * 3.6)  # kWh -> MJ
        self.assertEqual(m["heat_days_gt35"][0], 0)
        self.assertEqual(m["heavy_rain_days_gt50mm"][0], 0)
        self.assertIsNone(m["smap_rootzone_m3m3"])
        self.assertEqual(out["trends"]["method"], "Sen's slope / Mann-Kendall")
        self.assertEqual(out["trends"]["annual_precip_mm_per_decade"], 0)
        self.assertTrue(any("742" in c for c in out["caveats"]))
        self.assertTrue(any("sea level" in c for c in out["caveats"]))
        fields = {p["field"] for p in out["provenance"]}
        self.assertTrue({"monthly.precip_mm", "monthly.et0_mm", "monthly.heat_days_gt35"} <= fields)
        for p in out["provenance"]:
            self.assertTrue(p["source"] and p["period"] and p["native_res"] and p["retrieved"])
        res = {p["field"]: p["native_res"] for p in out["provenance"]}
        # NASA POWER docs: weather model 1/2 x 5/8 degree, solar radiation (CERES SYN1deg) 1 x 1 degree.
        self.assertEqual(res["monthly.solar_mj_m2_day"], "1° × 1° grid cell")
        self.assertEqual(res["monthly.precip_mm"], "0.5° × 0.625° grid cell")
        self.assertIn("solar radiation 1° × 1°", res["monthly.et0_mm"])

    def test_known_elevation_drops_the_sea_level_note(self):
        out = build_demo.build({**self.farm, "elevation_m": 6}, synthetic_raw(), "2026-11-14")
        self.assertEqual(out["elevation_m"], 6)
        self.assertFalse(any("sea level" in c for c in out["caveats"]))


if __name__ == "__main__":
    unittest.main()
