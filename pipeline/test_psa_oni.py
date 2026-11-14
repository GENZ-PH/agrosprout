"""Tests for pipeline/fetch_psa.py and pipeline/fetch_oni.py (offline).

Run from the repo root:  python3 -m unittest discover -s pipeline -v

The CSV below is cut from a real PSA OpenSTAT answer (Lanao del Norte, retrieved
2026-11-14); the expected yields were worked out by hand with a calculator.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import fetch_oni  # noqa: E402
import fetch_psa  # noqa: E402

HEADER = '"Ecosystem/Croptype","Geolocation","2024 Annual","2025 Annual","2026 Annual"'
PROD = HEADER + '\n"Palay","....Lanao del Norte",200017.97,213163.75,..\n"Corn","....Lanao del Norte",322662.30,329513.58,..\n'
AREA = HEADER + '\n"Palay","....Lanao del Norte",45000.00,47026.09,..\n"Corn","....Lanao del Norte",100000.00,105592.00,..\n'


class PsaTests(unittest.TestCase):
    def test_number_treats_dots_and_blank_as_missing(self):
        self.assertIsNone(fetch_psa.number(".."))
        self.assertIsNone(fetch_psa.number(""))
        self.assertEqual(fetch_psa.number("213163.75"), 213163.75)

    def test_clean_name_strips_leading_dots(self):
        self.assertEqual(fetch_psa.clean_name("....Lanao del Norte"), "Lanao del Norte")

    def test_parse_reads_only_annual_columns(self):
        d = fetch_psa.parse_csv(PROD)
        self.assertEqual(d[("Palay", "Lanao del Norte")], {2024: 200017.97, 2025: 213163.75, 2026: None})

    def test_yield_is_production_over_area_for_latest_complete_year(self):
        r = fetch_psa.build_yields(PROD, AREA, {"80": "Lanao del Norte"}, "2026-11-14")
        palay = r["provinces"]["80"]["palay"]
        self.assertEqual(palay["year"], 2025)  # 2026 is ".." so it is skipped
        self.assertEqual(palay["yield_t_per_ha"], round(213163.75 / 47026.09, 3))  # 4.533
        self.assertEqual(r["provinces"]["80"]["corn"]["yield_t_per_ha"], 3.121)
        self.assertEqual(r["retrieved"], "2026-11-14")
        self.assertIn("PSA OpenSTAT", r["source"])

    def test_zero_area_or_missing_values_give_null_not_zero(self):
        self.assertIsNone(fetch_psa.latest_yield({2025: 10.0}, {2025: 0.0}))
        self.assertIsNone(fetch_psa.latest_yield({2025: None}, {2025: 5.0}))
        # falls back to an earlier year when the latest one is incomplete
        self.assertEqual(fetch_psa.latest_yield({2024: 10.0, 2025: None}, {2024: 4.0, 2025: 5.0})["year"], 2024)

    def test_province_without_rows_is_null_for_both_crops(self):
        r = fetch_psa.build_yields(PROD, AREA, {"99": "Nowhere"}, "x")
        self.assertEqual(r["provinces"]["99"], {"name": "Nowhere", "palay": None, "corn": None})


ONI = """ SEAS  YR   TOTAL   ANOM
  DJF 1950  25.01  -1.32
  JAS 2026  29.12   2.16
  ASO 2026  29.23   2.46
"""


class OniTests(unittest.TestCase):
    def test_latest_season_is_read_from_the_file(self):
        o = fetch_oni.build_oni(ONI, "2026-11-14")
        self.assertEqual((o["season"], o["year"], o["anomaly_c"]), ("ASO", 2026, 2.46))
        self.assertEqual(o["retrieved"], "2026-11-14")
        self.assertTrue(o["url"].startswith("https://www.cpc.ncep.noaa.gov/"))

    def test_malformed_lines_are_skipped_and_empty_gives_none(self):
        self.assertEqual(fetch_oni.parse_latest("junk\n  XYZ 2026 1 2\n  ASO 20x6 1 2\n"), None)
        self.assertIsNone(fetch_oni.build_oni("", "x"))


if __name__ == "__main__":
    unittest.main()
