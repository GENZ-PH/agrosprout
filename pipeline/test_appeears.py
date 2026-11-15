"""Tests for pipeline/fetch_appeears.py. No network.

fixtures/appeears/*.csv are HAND-MADE files in the AppEEARS point-result column layout; their values
are invented for the tests and are not NASA data (see fixtures/appeears/README.md).
"""
import datetime as dt
import json
import unittest
from pathlib import Path
from unittest import mock

import fetch_appeears as a

FIX = Path(__file__).parent / "fixtures" / "appeears"


def rows(name):
    return a.read_csv(FIX / name)


class Files(unittest.TestCase):
    def test_find_csv_normalises_product_ids(self):
        self.assertEqual(a.find_csv("MOD13Q1.061", FIX).name, "fx-MOD13Q1-061-results.csv")
        self.assertEqual(a.find_csv("HLSL30_VI.020", FIX).name, "fx-HLSL30-VI-020-results.csv")
        self.assertEqual(a.find_csv("HLSL30.020", FIX).name, "fx-HLSL30-020-results.csv")
        self.assertIsNone(a.find_csv("ECO_L3T_JET.002", FIX))

    def test_task_request_is_one_point_task(self):
        t = a.task_request()
        self.assertEqual(t["task_type"], "point")
        self.assertEqual(t["params"]["coordinates"][0]["latitude"], 8.0)
        self.assertEqual(t["params"]["coordinates"][0]["longitude"], 123.8)
        prods = {l["product"] for l in t["params"]["layers"]}
        self.assertIn("MOD13Q1.061", prods)
        self.assertIn("ECO_L4T_ESI.002", prods)
        self.assertNotIn("token", json.dumps(t).lower())


class ModisQA(unittest.TestCase):
    def test_reliability_filter_scaling_and_composite_day(self):
        kept, total = a.modis_samples(rows("fx-MOD13Q1-061-results.csv"))
        self.assertEqual(total, 8)  # the 2026 row is outside 2001..2025
        self.assertEqual(len(kept), 5)
        days = [d.isoformat() for d, _ in kept]
        self.assertIn("2001-01-20", days)          # composite DOY 20, not window start
        self.assertIn("2003-01-02", days)          # window 2002-12-19, DOY 2 -> next year
        vals = dict((d.isoformat(), v) for d, v in kept)
        self.assertAlmostEqual(vals["2002-01-25"], 0.8)  # raw 8000 scaled by 0.0001
        self.assertNotIn(0.9, vals.values())       # reliability 3 (cloudy) dropped
        self.assertNotIn(0.3, vals.values())       # reliability 1 (marginal) dropped


class HlsQA(unittest.TestCase):
    def test_fmask_bits(self):
        self.assertTrue(a.fmask_ok(0))
        self.assertTrue(a.fmask_ok(32))    # water kept
        self.assertTrue(a.fmask_ok(64 + 128))  # aerosol bits only
        self.assertFalse(a.fmask_ok(2))    # cloud
        self.assertFalse(a.fmask_ok(4))    # adjacent
        self.assertFalse(a.fmask_ok(8))    # shadow
        self.assertFalse(a.fmask_ok(16))   # snow
        self.assertFalse(a.fmask_ok(None))
        self.assertFalse(a.fmask_ok(255))

    def test_join_on_date(self):
        kept, total = a.hls_samples(rows("fx-HLSL30-VI-020-results.csv"), rows("fx-HLSL30-020-results.csv"))
        self.assertEqual(total, 3)
        self.assertEqual([(d.isoformat(), v) for d, v in kept], [("2020-03-02", 0.2), ("2020-03-18", 0.6)])
        kept, total = a.hls_samples(rows("fx-HLSS30-VI-020-results.csv"), rows("fx-HLSS30-020-results.csv"))
        self.assertEqual((total, len(kept)), (2, 1))  # fill -19999 dropped


class EcoQA(unittest.TestCase):
    def test_cloud_water_nan(self):
        kept, total = a.eco_samples(rows("fx-ECO-L4T-ESI-002-results.csv"), "ESI", 0.0, 1.0)
        self.assertEqual(total, 5)  # the NaN row does not count as an observation
        self.assertEqual(sorted(v for _, v in kept), [0.3, 0.6, 0.8])


class Stats(unittest.TestCase):
    def test_climatology_percentiles_and_counts(self):
        s = [(dt.date(2001, 1, 5), 0.5), (dt.date(2001, 1, 20), 0.7),
             (dt.date(2002, 1, 10), 0.4), (dt.date(2002, 1, 25), 0.8), (dt.date(2003, 1, 2), 0.2)]
        jan = a.climatology(s)[0]
        self.assertEqual((jan["n_years"], jan["n_samples"]), (3, 5))
        self.assertAlmostEqual(jan["p50"], 0.6)
        self.assertAlmostEqual(jan["p20"], 0.36)
        self.assertAlmostEqual(jan["p80"], 0.6)
        feb = a.climatology(s)[1]
        self.assertEqual((feb["p50"], feb["n_years"], feb["n_samples"]), (None, 0, 0))

    def test_low_months_rule(self):
        m = [{"month": i + 1, "p50": v} for i, v in enumerate([0.3, 0.4, None, 0.39] + [0.7] * 8)]
        self.assertEqual(a.low_months(m, 0.4), [1, 4])


class Build(unittest.TestCase):
    def test_build_all_from_fixtures(self):
        out = a.build_all(FIX, today="2026-11-14")
        self.assertEqual(set(out), {"ndvi", "hls", "ecostress"})
        n = out["ndvi"]
        self.assertEqual(len(n["monthly"]), 12)
        self.assertEqual(n["monthly"][0]["n_samples"], 5)
        self.assertEqual(n["sampling"]["valid_samples"], 5)
        self.assertEqual(n["provenance"]["period"], "2001-01-05 to 2003-01-02")
        self.assertEqual(n["provenance"]["doi"], "10.5067/MODIS/MOD13Q1.061")
        self.assertIn("pixel_reliability == 0", n["sampling"]["qa_rule"])
        self.assertIn("0.4", n["low_ndvi_rule"])
        h = out["hls"]
        self.assertAlmostEqual(h["monthly"][2]["p50"], 0.4)
        self.assertEqual(h["monthly"][2]["n_samples"], 3)
        self.assertEqual(h["low_ndvi_months"], [])
        e = out["ecostress"]
        self.assertAlmostEqual(e["esi"]["monthly"][4]["p50"], 0.5)
        self.assertEqual(e["esi"]["valid_samples"], 3)
        self.assertNotIn("et_daily", e)
        for v in out.values():
            json.dumps(v)

    def test_no_csvs_builds_nothing(self):
        with mock.patch.object(a, "find_csv", return_value=None):
            self.assertEqual(a.build_all(FIX), {})


if __name__ == "__main__":
    unittest.main()
