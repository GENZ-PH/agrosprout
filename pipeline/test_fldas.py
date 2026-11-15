"""Tests for pipeline/fetch_fldas.py. No network.

fixtures/fldas_noah01_c_gl_m_block.dap.csv is SYNTHETIC (made-up values in the Hyrax `.dap.csv`
layout of FLDAS_NOAH01_C_GL_M, [time][Y][X], with one fill cell); it only tests parsing.
"""
import json
import unittest
from pathlib import Path
from unittest import mock

import fetch_fldas as f

FIX = Path(__file__).parent / "fixtures"


def blk(values):
    """values: {(lat, lon): v} used for every variable."""
    return {"X": [123.75, 123.85], "Y": [7.95, 8.05], **{var: dict(values) for var in f.VARIABLES}}


class Units(unittest.TestCase):
    def test_flux_to_month_total(self):
        # 1e-5 kg m-2 s-1 over January = 1e-5 x 86400 x 31 = 26.784 mm
        self.assertAlmostEqual(f.flux_to_month_total(1e-5, 2001, 1), 26.784)
        self.assertEqual(f.seconds_in_month(2004, 2), 86400 * 29)
        self.assertEqual(f.flux_to_month_total(0.0, 2001, 6), 0.0)


class Grid(unittest.TestCase):
    def test_point_on_corner(self):
        self.assertEqual(f.x_indices(123.8), [3037, 3038])  # 123.75, 123.85
        self.assertEqual(f.y_indices(8.0), [679, 680])      # 7.95, 8.05 (Y starts at -59.95)
        self.assertEqual(f.block_range([679, 680], f.N_Y), (678, 681))

    def test_constraint_names_every_variable(self):
        ce = f.constraint((678, 681), (3036, 3039))
        for v in f.VARIABLES:
            self.assertIn(f"%2F{v}%5B0%5D%5B678:1:681%5D%5B3036:1:3039%5D", ce)


class Parse(unittest.TestCase):
    def test_parse_block_and_fill(self):
        b = f.parse_block((FIX / "fldas_noah01_c_gl_m_block.dap.csv").read_text())
        self.assertEqual(b["Y"], [7.95, 8.05])
        sm = b["SoilMoi00_10cm_tavg"]
        self.assertEqual(sm[(7.95, 123.75)], 0.40)
        self.assertEqual(sm[(8.05, 123.85)], 0.20)
        self.assertIsNone(sm[(8.05, 123.75)])
        self.assertEqual(b["Rainf_f_tavg"][(8.05, 123.85)], 0.0)

    def test_pick_granules(self):
        cmr = {"items": [{"umm": {
            "GranuleUR": "FLDAS_NOAH01_C_GL_M.001:FLDAS_NOAH01_C_GL_M.A200103.001.nc",
            "RelatedUrls": [{"URL": "https://opendap.earthdata.nasa.gov/x", "Subtype": "OPENDAP DATA"}]}}]}
        self.assertEqual(f.pick_granules(cmr), {(2001, 3): "https://opendap.earthdata.nasa.gov/x"})


class Cells(unittest.TestCase):
    def test_drops_fill_and_zero_rain_cells(self):
        vals = {(7.95, 123.75): 1e-5, (7.95, 123.85): 2e-5, (8.05, 123.75): None, (8.05, 123.85): 3e-5}
        months = {(2001, 1): blk(vals), (2002, 1): blk(vals)}
        for b in months.values():
            b[f.RAIN][(8.05, 123.85)] = 0.0  # rain forcing always zero -> dropped
        cells, notes, _rule = f.choose_cells(months)
        self.assertEqual(cells, [(7.95, 123.75), (7.95, 123.85)])
        self.assertEqual(sum(n["used"] for n in notes), 2)

    def test_monthly_values_mean_and_units(self):
        vals = {(7.95, 123.75): 1e-5, (7.95, 123.85): 3e-5}
        out = f.monthly_values({(2001, 1): blk(vals)}, list(vals))
        self.assertAlmostEqual(out["rainfall_mm"][(2001, 1)], 2e-5 * 86400 * 31)
        self.assertAlmostEqual(out["soil_moisture_0_10cm_m3m3"][(2001, 1)], 2e-5)  # kept as is
        self.assertAlmostEqual(out["total_runoff_mm"][(2001, 1)], 2 * 2e-5 * 86400 * 31)


class Build(unittest.TestCase):
    def test_build_offline_from_mocked_months(self):
        urls = {(2001, 1): "u1", (2002, 1): "u2"}
        data = {"u1": {(7.95, 123.75): 1e-5}, "u2": {(7.95, 123.75): 2e-5}}

        def fake(y, m, url, ys, xs, offline):
            return blk({(7.95, 123.75): data[url][(7.95, 123.75)], (8.05, 123.75): None,
                        (7.95, 123.85): None, (8.05, 123.85): None})
        with mock.patch.object(f, "granule_urls", return_value=urls), mock.patch.object(f, "fetch_month", side_effect=fake):
            out = f.build(offline=True)
        jan = out["monthly"]["rainfall_mm"][0]
        self.assertEqual(jan["n_years"], 2)
        self.assertAlmostEqual(jan["p50"], round(1.5e-5 * 86400 * 31, 1))
        self.assertEqual(len(out["monthly"]["evapotranspiration_mm"]), 12)
        self.assertEqual(out["monthly"]["rainfall_mm"][1]["n_years"], 0)
        self.assertEqual(out["grid_cell"]["cells_used"], [{"lat": 7.95, "lon": 123.75}])
        self.assertEqual(out["period"], "2001-01 to 2002-01")
        for k in ("source", "native_res", "period", "doi", "unit_conversion"):
            self.assertIn(k, out["provenance"][0])
        json.dumps(out)


if __name__ == "__main__":
    unittest.main()
