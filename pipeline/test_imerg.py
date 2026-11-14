"""Tests for pipeline/fetch_imerg.py. No network.

fixtures/imerg_3imergm_block.dap.csv is SYNTHETIC (made-up rates in the Hyrax `.dap.csv` layout,
including one fill value); it only tests parsing, not real rainfall.
"""
import json
import unittest
from pathlib import Path
from unittest import mock

import earthdata
import fetch_imerg as f

FIX = Path(__file__).parent / "fixtures"


class Units(unittest.TestCase):
    def test_hours_in_month(self):
        self.assertEqual(f.hours_in_month(2001, 1), 744)
        self.assertEqual(f.hours_in_month(2001, 2), 672)
        self.assertEqual(f.hours_in_month(2004, 2), 696)  # leap year
        self.assertEqual(f.hours_in_month(2001, 4), 720)

    def test_rate_to_month_total(self):
        # 0.5 mm/hr average over January = 0.5 x 24 x 31 = 372 mm
        self.assertAlmostEqual(f.rate_to_month_total(0.5, 2001, 1), 372.0)
        self.assertAlmostEqual(f.rate_to_month_total(0.25, 2004, 2), 174.0)
        self.assertEqual(f.rate_to_month_total(0.0, 2001, 6), 0.0)


class Grid(unittest.TestCase):
    def test_point_on_corner_touches_four_cells(self):
        self.assertEqual(f.lon_indices(123.8), [3037, 3038])  # centres 123.75, 123.85
        self.assertEqual(f.lat_indices(8.0), [979, 980])      # centres 7.95, 8.05

    def test_point_inside_a_cell(self):
        self.assertEqual(f.lon_indices(123.83), [3038])
        self.assertEqual(f.lat_indices(8.07), [980])
        self.assertEqual(f.lon_indices(-179.99), [0])
        self.assertEqual(f.lat_indices(89.99), [1799])

    def test_indices_match_centres(self):
        for i in f.lon_indices(123.8):
            self.assertIn(round(-179.95 + 0.1 * i, 2), (123.75, 123.85))


class Parse(unittest.TestCase):
    def test_parse_block_and_fill(self):
        parsed = f.parse_dap_csv((FIX / "imerg_3imergm_block.dap.csv").read_text())
        self.assertEqual(parsed["Grid/lon"][0], [123.75, 123.85])
        self.assertEqual(f.cell_rates(parsed), [0.1, 0.3, 0.2, None])

    def test_error_body_is_raised(self):
        with self.assertRaises(earthdata.EarthdataError):
            f.check_error('Dataset: x\nError { \n code = 403;\n message = "boom";\n}', "u")
        with self.assertRaisesRegex(earthdata.EarthdataError, "EULA"):
            f.check_error('Error { message = "EULA Acceptance Failure" }', "u")
        f.check_error("Dataset: x\n/Grid/lon, 1.0\n", "u")  # no error

    def test_pick_granules(self):
        cmr = {"items": [{"umm": {
            "GranuleUR": "GPM_3IMERGM.07:3B-MO.MS.MRG.3IMERG.20010101-S000000-E235959.01.V07B.HDF5",
            "RelatedUrls": [
                {"URL": "https://data.example/x.HDF5", "Type": "GET DATA"},
                {"URL": "https://opendap.earthdata.nasa.gov/x", "Type": "USE SERVICE API", "Subtype": "OPENDAP DATA"},
            ]}}]}
        self.assertEqual(f.pick_granules(cmr), {(2001, 1): "https://opendap.earthdata.nasa.gov/x"})


class Stats(unittest.TestCase):
    def test_percentiles_across_years(self):
        totals = {(2001 + i, 1): float(v) for i, v in enumerate([10, 20, 30, 40, 50])}
        jan = f.climatology(totals)[0]
        self.assertEqual(jan["n_years"], 5)
        self.assertAlmostEqual(jan["p50_mm"], 30.0)
        self.assertAlmostEqual(jan["p20_mm"], 18.0)  # linear: idx 0.8 between 10 and 20
        self.assertAlmostEqual(jan["p80_mm"], 42.0)
        self.assertIsNone(f.climatology(totals)[1]["p50_mm"])
        self.assertEqual(f.climatology(totals)[1]["n_years"], 0)

    def test_power_compare_copies_power_and_diffs(self):
        demo = {"monthly": {"precip_mm": {q: [100.0] * 12 for q in ("p20", "p50", "p80")}},
                "provenance": [{"field": "monthly.precip_mm", "source": "NASA POWER daily PRECTOTCORR", "period": "2001-2025"}]}
        im = [{"month": m + 1, "p20_mm": 90.0, "p50_mm": 110.5, "p80_mm": None, "n_years": 25} for m in range(12)]
        pc = f.power_compare(im, demo)
        row = pc["monthly"][0]
        self.assertEqual(row["power_p50_mm"], 100.0)
        self.assertEqual(row["imerg_p50_mm"], 110.5)
        self.assertEqual(row["diff_p50_mm"], 10.5)
        self.assertEqual(row["diff_p20_mm"], -10.0)
        self.assertIsNone(row["diff_p80_mm"])
        self.assertEqual(pc["power"]["period"], "2001-2025")


class Build(unittest.TestCase):
    def test_build_offline_from_mocked_months(self):
        urls = {(2001, 1): "u1", (2002, 1): "u2", (2001, 2): "u3"}
        rates = {"u1": [0.1, 0.1, 0.1, 0.1], "u2": [0.2, 0.2, 0.2, 0.4], "u3": [0.1, None, 0.1, 0.1]}

        def fake(y, m, url, ilon, jlat, offline):
            return {"rates": rates[url], "lon": [123.75, 123.85], "lat": [7.95, 8.05]}
        with mock.patch.object(f, "granule_urls", return_value=urls), mock.patch.object(f, "fetch_month", side_effect=fake):
            out = f.build(offline=True)
        jan = out["monthly"][0]
        self.assertEqual(jan["n_years"], 2)
        # means 0.1 and 0.25 mm/hr over 744 h -> 74.4 and 186.0 mm; p50 = 130.2
        self.assertAlmostEqual(jan["p50_mm"], 130.2)
        self.assertEqual(out["monthly"][1]["n_years"], 0)  # month with a missing cell is left out
        self.assertEqual(len(out["monthly"]), 12)
        self.assertEqual(out["point"], {"lat": 8.0, "lon": 123.8})
        self.assertIn("doi", out["provenance"][0])
        json.dumps(out)


class Token(unittest.TestCase):
    def test_env_token_wins_and_is_not_in_errors(self):
        with mock.patch.dict("os.environ", {"EARTHDATA_TOKEN": "secret-xyz"}):
            self.assertEqual(earthdata.read_token(), "secret-xyz")

    def test_header_only_for_nasa_hosts(self):
        self.assertTrue(earthdata._trusted("https://opendap.earthdata.nasa.gov/x"))
        self.assertFalse(earthdata._trusted("https://nasa.gov.evil.example/x"))
        self.assertFalse(earthdata._trusted("https://bucket.s3.amazonaws.com/x"))


if __name__ == "__main__":
    unittest.main()
