"""Tests for pipeline/build_land_water.py (offline, made-up shapes in Natural Earth's GeoJSON form).

Run from the repo root:  python3 -m unittest discover -s pipeline -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_land_water as b  # noqa: E402

WINDOW = (0.0, 0.0, 10.0, 10.0)


def square(x0: float, y0: float, x1: float, y1: float) -> list[list[float]]:
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]


def fc(*geoms: dict, **props) -> dict:
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": dict(props), "geometry": g} for g in geoms]}


class WindowTests(unittest.TestCase):
    def test_window_is_the_bounding_box_of_the_philippines_feature(self):
        countries = {
            "type": "FeatureCollection",
            "features": [
                {"properties": {"ADMIN": "Philippines"}, "geometry": {"type": "MultiPolygon", "coordinates": [[square(117, 5, 120, 8)], [[[121, 10], [126.5, 10], [126.5, 21], [121, 10]]]]}},
                {"properties": {"ADMIN": "Malaysia"}, "geometry": {"type": "Polygon", "coordinates": [square(100, 1, 119, 7)]}},
            ],
        }
        self.assertEqual(b.philippines_window(countries), (117, 5, 126.5, 21))

    def test_missing_philippines_raises(self):
        with self.assertRaisesRegex(ValueError, "Philippines"):
            b.philippines_window({"type": "FeatureCollection", "features": []})


class ClipTests(unittest.TestCase):
    def test_ring_inside_is_kept_and_outside_is_dropped(self):
        self.assertEqual(b.clip_ring(square(1, 1, 2, 2), WINDOW), square(1, 1, 2, 2))
        self.assertEqual(b.clip_ring(square(20, 20, 30, 30), WINDOW), [])

    def test_ring_across_the_edge_is_cut_at_the_window(self):
        ring = b.clip_ring(square(5, 5, 15, 8), WINDOW)
        xs = [p[0] for p in ring]
        self.assertEqual(max(xs), 10.0)
        self.assertEqual(min(xs), 5.0)
        self.assertEqual(ring[0], ring[-1], "the ring stays closed")


class TidyTests(unittest.TestCase):
    def test_round_and_drop_repeats(self):
        ring = [[1.00012, 2.00049], [1.00041, 2.0001], [1.5, 2.0], [1.5, 2.5], [1.00012, 2.00049]]
        self.assertEqual(b.tidy_ring(ring), [[1.0, 2.0], [1.5, 2.0], [1.5, 2.5], [1.0, 2.0]])

    def test_ring_that_collapses_is_dropped(self):
        self.assertEqual(b.tidy_ring([[1.0001, 2.0001], [1.0002, 2.0002], [1.0003, 2.0001], [1.0001, 2.0001]]), [])

    def test_simplify_keeps_corners_and_drops_points_on_a_line(self):
        ring = [[0, 0], [1, 0], [2, 0.0004], [3, 0], [3, 3], [0, 3], [0, 0]]
        self.assertEqual(b.simplify_ring(ring, 0.001), [[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]])


class BuildTests(unittest.TestCase):
    def test_build_keeps_land_islands_and_lakes_in_the_window_with_meta(self):
        land = fc({"type": "Polygon", "coordinates": [square(1, 1, 4, 4), square(2, 2, 3, 3)]}, {"type": "Polygon", "coordinates": [square(50, 50, 51, 51)]})
        islands = fc({"type": "Polygon", "coordinates": [square(6, 6, 6.5, 6.5)]})
        lakes = fc({"type": "Polygon", "coordinates": [square(7, 1, 8, 2)]}, name="Laguna de Bay")
        out = b.build(land, islands, lakes, WINDOW, "2026-11-15")
        self.assertEqual(out["meta"]["window"], [0.0, 0.0, 10.0, 10.0])
        self.assertEqual(out["meta"]["version"], "v5.1.2")
        self.assertEqual(out["meta"]["lakes"], ["Laguna de Bay"])
        self.assertIn("Natural Earth", out["meta"]["credit"])
        self.assertEqual(len(out["land"]), 2, "the land polygon with its hole, and the island; the far one is dropped")
        self.assertEqual(len(out["land"][0]), 2, "the hole is kept")
        self.assertEqual(out["lakes"], [[square(7, 1, 8, 2)]])


if __name__ == "__main__":
    unittest.main()
