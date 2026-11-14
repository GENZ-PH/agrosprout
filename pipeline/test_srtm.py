"""Tests for pipeline/fetch_srtm.py and its use in build_demo.py (issue #9). No network."""
import math
import unittest
from unittest import mock

import build_demo
import fetch_srtm as s
from test_demo import synthetic_raw


class Geometry(unittest.TestCase):
    def test_grid_is_about_30_m_apart_north_row_first(self):
        pts = s.grid_points(8.23, 124.24)
        self.assertEqual(len(pts), 9)
        self.assertEqual(pts[4], (8.23, 124.24))
        lat_m, lon_m = s.meters_per_degree(8.23)
        self.assertAlmostEqual((pts[0][0] - pts[4][0]) * lat_m, 30, delta=0.2)  # a is north
        self.assertAlmostEqual((pts[5][1] - pts[4][1]) * lon_m, 30, delta=0.2)  # f is east
        self.assertGreater(pts[0][0], pts[6][0])
        self.assertLess(pts[3][1], pts[5][1])

    def test_metres_per_degree(self):
        self.assertAlmostEqual(s.meters_per_degree(0)[1], 111319.5, delta=1)  # equator, WGS84
        self.assertAlmostEqual(s.meters_per_degree(0)[0], 110574, delta=2)


class Slope(unittest.TestCase):
    def test_flat_is_zero(self):
        self.assertEqual(s.horn_slope_pct([5.0] * 9), 0)

    def test_plane_rising_to_the_east(self):
        # 3 m rise per 30 m step east -> 10 % slope, same sign either direction of north
        z = [-3, 0, 3] * 3
        self.assertAlmostEqual(s.horn_slope_pct([v + 10 for v in z]), 10.0)

    def test_plane_rising_to_the_north(self):
        z = [3, 3, 3, 0, 0, 0, -3, -3, -3]  # north row first
        self.assertAlmostEqual(s.horn_slope_pct(z), 10.0)

    def test_diagonal_combines_both_directions(self):
        z = [0, 3, 6, -3, 0, 3, -6, -3, 0]  # +3 m east and +3 m north per step
        self.assertAlmostEqual(s.horn_slope_pct(z), 100 * math.hypot(0.1, 0.1))

    def test_missing_height_gives_no_slope(self):
        self.assertIsNone(s.horn_slope_pct([5.0] * 8 + [None]))


class Lookup(unittest.TestCase):
    def with_heights(self, z):
        with mock.patch.object(s, "fetch_heights", return_value=z):
            return s.elevation_and_slope(8.23, 124.24)

    def test_normal_point(self):
        r = self.with_heights([5, 5, 5, 5, 6, 6, 5, 6, 6])
        self.assertEqual((r["elevation_m"], r["slope_pct"], r["caveats"]), (6, 1.8, []))

    def test_zero_metres_is_flagged_as_possible_shoreline(self):
        r = self.with_heights([0.0] * 9)
        self.assertEqual(r["elevation_m"], 0)
        self.assertTrue(any("shoreline" in c for c in r["caveats"]))

    def test_no_tile_gives_unknown_not_zero(self):
        r = self.with_heights([None] * 9)
        self.assertIsNone(r["elevation_m"])
        self.assertIsNone(r["slope_pct"])
        self.assertTrue(r["caveats"])

    def test_neighbour_missing_keeps_elevation_but_flags_slope(self):
        r = self.with_heights([5, 5, 5, 5, 6, 6, 5, 6, None])
        self.assertEqual(r["elevation_m"], 6)
        self.assertIsNone(r["slope_pct"])
        self.assertTrue(any("slope is unknown" in c for c in r["caveats"]))


class InDemoFarm(unittest.TestCase):
    farm = {"id": "t", "name": "Test", "lat": 8.23, "lon": 124.24, "elevation_m": None}

    def test_srtm_values_and_provenance_are_used(self):
        srtm = {"elevation_m": 6.0, "slope_pct": 1.8, "caveats": []}
        out = build_demo.build(self.farm, synthetic_raw(), "2026-11-14", srtm)
        self.assertEqual((out["elevation_m"], out["slope_pct"]), (6.0, 1.8))
        prov = {p["field"]: p for p in out["provenance"]}
        self.assertIn("NASA SRTM v3", prov["elevation_m"]["source"])
        self.assertIn("slope_pct", prov)
        self.assertFalse(any("sea level" in c for c in out["caveats"]))
        self.assertTrue(any("cooler than at the field" in c for c in out["caveats"]))

    def test_farm_values_win_over_srtm(self):
        srtm = {"elevation_m": 6.0, "slope_pct": 1.8, "caveats": []}
        out = build_demo.build({**self.farm, "elevation_m": 20, "slope_pct": 9}, synthetic_raw(), "2026-11-14", srtm)
        self.assertEqual((out["elevation_m"], out["slope_pct"]), (20, 9))
        self.assertNotIn("elevation_m", {p["field"] for p in out["provenance"]})

    def test_no_srtm_keeps_unknown_and_sea_level_note(self):
        out = build_demo.build(self.farm, synthetic_raw(), "2026-11-14")
        self.assertIsNone(out["elevation_m"])
        self.assertIsNone(out["slope_pct"])
        self.assertTrue(any("sea level" in c for c in out["caveats"]))


if __name__ == "__main__":
    unittest.main()
