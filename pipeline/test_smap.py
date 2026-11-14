"""Tests for pipeline/fetch_smap.py. No network.

fixtures/smap_spl4smgp_block.dap.csv is a REAL answer from NASA Earthdata cloud OPeNDAP
(SPL4SMGP v008 granule SMAP_L4_SM_gph_20150401T043000_Vv8010_001.h5, 3 x 3 cells around row 699,
col 3254), saved 2026-11-14.
"""
import json
import unittest
from pathlib import Path
from unittest import mock

import fetch_smap as s

FIX = Path(__file__).parent / "fixtures"


class Projection(unittest.TestCase):
    def test_ease2_origin_and_equator(self):
        x, y = s.ease2_xy(0.0, 0.0)
        self.assertAlmostEqual(x, 0.0, places=6)
        self.assertAlmostEqual(y, 0.0, places=6)

    def test_ease2_matches_grid_edge(self):
        # EASE-Grid 2.0 global 9 km: 3856 columns of 9008.055... m, so lon 180 sits at the
        # outer edge, 1928 cells from the centre.
        x, _ = s.ease2_xy(0.0, 180.0)
        self.assertAlmostEqual(x / 1928, 9008.055, delta=0.01)

    def test_demo_point_falls_in_row_699_col_3254(self):
        # Cell centres on the 9 km grid (from the file's /x and /y): x0 = -17363027.29 + 9008.0557 * col
        x, y = s.ease2_xy(8.0, 123.8)
        xs = [-17363027.29 + 9008.055664 * c for c in range(3250, 3260)]
        ys = [7310037.17 - 9008.055664 * r for r in range(695, 705)]
        self.assertEqual(3250 + s.nearest_index(xs, x), 3254)
        self.assertEqual(695 + s.nearest_index(ys, y), 699)


class Parse(unittest.TestCase):
    def test_real_block_centre(self):
        parsed = s.parse_dap_csv((FIX / "smap_spl4smgp_block.dap.csv").read_text())
        v = s.centre_values(parsed)
        self.assertAlmostEqual(v["surface"], 0.179393)
        self.assertAlmostEqual(v["rootzone"], 0.22807)
        self.assertAlmostEqual(v["cell_lat"], 7.9687)
        self.assertAlmostEqual(v["cell_lon"], 123.843)

    def test_empty_slice_gives_none(self):
        parsed = s.parse_dap_csv("Dataset: x\n/Geophysical_Data/sm_surface[0], \n")
        self.assertIsNone(s.centre_values(parsed)["surface"])

    def test_fill_and_range(self):
        self.assertIsNone(s.clean(-9999.0))
        self.assertIsNone(s.clean(0.95))
        self.assertIsNone(s.clean(None))
        self.assertEqual(s.clean(0.3), 0.3)

    def test_pick_granules_prefers_later_version(self):
        def item(name):
            return {"umm": {"GranuleUR": name, "RelatedUrls": [{"URL": "https://o/" + name, "Subtype": "OPENDAP DATA"}]}}
        cmr = {"items": [item("SMAP_L4_SM_gph_20200101T043000_Vv8010_001.h5"),
                         item("SMAP_L4_SM_gph_20200101T043000_Vv8013_001.h5"),
                         item("SMAP_L4_SM_gph_20200106T043000_Vv8010_001.h5")]}
        got = s.pick_granules(cmr)
        self.assertEqual(got["2020-01-01"], "https://o/SMAP_L4_SM_gph_20200101T043000_Vv8013_001.h5")
        self.assertIn("2020-01-06", got)


class Sampling(unittest.TestCase):
    def test_sample_dates(self):
        d = s.sample_dates((2015, 4), (2015, 5))
        self.assertEqual(len(d), 12)
        self.assertEqual(d[0].isoformat(), "2015-04-01")
        self.assertEqual(d[-1].isoformat(), "2015-05-26")
        self.assertEqual(len(s.months()), 129)  # 2015-04 .. 2025-12


class Stats(unittest.TestCase):
    def test_monthly_means_need_min_samples(self):
        samples = {"2016-01-01": 0.2, "2016-01-06": 0.3, "2016-01-11": 0.4, "2016-01-16": 0.3,
                   "2016-02-01": 0.1, "2016-02-06": None, "2016-02-11": 0.1}
        mm = s.monthly_means(samples, min_n=4)
        self.assertAlmostEqual(mm[(2016, 1)], 0.3)
        self.assertNotIn((2016, 2), mm)

    def test_climatology_mean_and_percentiles(self):
        mm = {(2016 + i, 3): v for i, v in enumerate([0.10, 0.20, 0.30, 0.40, 0.50])}
        mar = s.climatology(mm)[2]
        self.assertEqual(mar["n"], 5)
        self.assertAlmostEqual(mar["mean"], 0.3)
        self.assertAlmostEqual(mar["p20"], 0.18)
        self.assertAlmostEqual(mar["p80"], 0.42)
        self.assertEqual(s.climatology(mm)[0]["n"], 0)


class Build(unittest.TestCase):
    def test_build_with_mocked_network(self):
        days = [d.isoformat() for d in s.sample_dates()]
        urls = {d: "u" + d for d in days}

        def fake_urls(year, offline):
            return {d: u for d, u in urls.items() if d.startswith(str(year))}

        def fake_sample(day, url, row, col, offline):
            return {"surface": 0.2, "rootzone": 0.3, "cell_lat": 7.9687, "cell_lon": 123.843}
        with mock.patch.object(s, "granule_urls", side_effect=fake_urls), \
                mock.patch.object(s, "grid_index", return_value=(699, 3254)), \
                mock.patch.object(s, "sample", side_effect=fake_sample):
            out = s.build(offline=True)
        self.assertEqual(len(out["monthly"]), 12)
        self.assertEqual(out["monthly"][0]["surface_m3m3"]["n"], 10)   # Jan 2016..2025
        self.assertEqual(out["monthly"][3]["surface_m3m3"]["n"], 11)   # Apr 2015..2025
        self.assertAlmostEqual(out["monthly"][0]["rootzone_m3m3"]["mean"], 0.3)
        self.assertEqual(out["grid_cell"]["row"], 699)
        self.assertEqual(len(out["power_compare"]["monthly"]), 12)
        self.assertIn("different quantity", out["power_compare"]["label"])
        json.dumps(out)


if __name__ == "__main__":
    unittest.main()
