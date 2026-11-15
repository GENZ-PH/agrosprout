"""Tests for pipeline/build_places.py (offline, made-up rows in GeoNames' 19 tab-separated columns).

Run from the repo root:  python3 -m unittest discover -s pipeline -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_places as b  # noqa: E402


def line(name: str, lat: str, lon: str, code: str, admin1: str, admin2: str, population: str = "0") -> str:
    """One GeoNames row: geonameid, name, asciiname, alternatenames, lat, lon, class, code, country, cc2,
    admin1, admin2, admin3, admin4, population, elevation, dem, timezone, modified."""
    cls = "A" if code.startswith("ADM") else "P"
    cols = ["1", name, name, "", lat, lon, cls, code, "PH", "", admin1, admin2, "", "", population, "", "0", "Asia/Manila", "2026-01-01"]
    return "\t".join(cols)


LANAO = line("Province of Lanao del Norte", "8.0", "124.0", "ADM2", "10", "34")
ILIGAN = line("Iligan City", "8.231374", "124.261044", "ADM3", "10", "34", "342618")
TUBOD = line("Tubod", "8.05", "123.8", "ADM3", "10", "34", "5000")
VILLAGE = line("Tubod", "8.2", "124.2", "PPL", "10", "34", "100")


class BuildPlacesTest(unittest.TestCase):
    def test_only_adm3(self):
        out = b.build(b.parse([LANAO, ILIGAN, VILLAGE]), "2026-11-15")
        self.assertEqual([p[0] for p in out["places"]], ["Iligan City"])

    def test_province_prefix_removed(self):
        out = b.build(b.parse([LANAO, ILIGAN]), "2026-11-15")
        self.assertEqual(out["places"][0][1], "Lanao del Norte")

    def test_ncr(self):
        rows = [
            line("Capital District", "14.6", "121.0", "ADM2", "NCR", "39"),
            line("City of Manila", "14.6", "120.98", "ADM3", "NCR", "39", "1800000"),
        ]
        out = b.build(b.parse(rows), "2026-11-15")
        self.assertEqual(out["places"][0][1], "Metro Manila")

    def test_order_and_rounding(self):
        out = b.build(b.parse([LANAO, TUBOD, ILIGAN]), "2026-11-15")
        self.assertEqual([p[0] for p in out["places"]], ["Iligan City", "Tubod"])
        self.assertEqual(out["places"][0][2:], [8.231, 124.261])

    def test_meta(self):
        out = b.build(b.parse([LANAO, ILIGAN, TUBOD]), "2026-11-15")
        self.assertIn("CC BY 4.0", out["meta"]["licence"])
        self.assertEqual(out["meta"]["count"], len(out["places"]))
        self.assertEqual(out["meta"]["retrieved"], "2026-11-15")
        self.assertIn("GeoNames", out["meta"]["credit"])


if __name__ == "__main__":
    unittest.main()
