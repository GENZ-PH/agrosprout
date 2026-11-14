"""Tests for pipeline/et0.py.

Run from the repo root:  python3 -m unittest discover -s pipeline -v

FAO-56 Chapter 4, Example 17 ("Determination of ETo with mean monthly data"):
Bangkok, Thailand, 13 deg 44' N (13.73), elevation 2 m, April (15 April, J = 105).
Source: https://www.fao.org/4/x0490e/x0490e08.htm
The paper prints rounded intermediates, so each check uses a tolerance that
matches the printed precision. These are the SAME numbers as
mobile/src/data/et0.test.ts, so passing both proves the two implementations agree.
"""

import unittest

import et0

LAT, ELEV, DOY = 13.73, 2, 105


class Example17(unittest.TestCase):
    def test_mid_month_day_of_year(self):
        self.assertEqual(et0.mid_month_day_of_year(3), 105)
        self.assertEqual(et0.mid_month_day_of_year(0), 15)
        self.assertEqual(et0.mid_month_day_of_year(11), 349)

    def test_radiation_terms(self):
        self.assertAlmostEqual(et0.extraterrestrial_radiation(LAT, DOY), 38.06, delta=0.05)
        self.assertAlmostEqual(et0.daylight_hours(LAT, DOY), 12.31, delta=0.02)
        self.assertAlmostEqual(et0.solar_from_sunshine(8.5, LAT, DOY), 22.65, delta=0.05)

    def test_et0_and_intermediates(self):
        rs = et0.solar_from_sunshine(8.5, LAT, DOY)
        r = et0.et0_day(
            tmax_c=34.8,
            tmin_c=25.6,
            ea_kpa=2.85,
            wind_ms_2m=2,
            rs_mj_m2_day=rs,
            lat_deg=LAT,
            elev_m=ELEV,
            day_of_year=DOY,
            g_mj_m2_day=0.14 * (30.2 - 29.2),  # Eq. 44, March mean 29.2 C
        )
        d = r.detail
        self.assertAlmostEqual(d.tmean_c, 30.2, places=9)
        self.assertAlmostEqual(d.pressure_kpa, 101.3, delta=0.05)
        self.assertAlmostEqual(d.gamma_kpa_c, 0.0674, delta=0.0002)
        self.assertAlmostEqual(d.delta_kpa_c, 0.246, delta=0.001)
        self.assertAlmostEqual(d.es_kpa, 4.42, delta=0.01)
        self.assertAlmostEqual(d.rso_mj_m2_day, 28.54, delta=0.05)
        self.assertAlmostEqual(d.rns_mj_m2_day, 17.44, delta=0.05)
        self.assertAlmostEqual(d.rnl_mj_m2_day, 3.11, delta=0.03)
        self.assertAlmostEqual(d.rn_mj_m2_day, 14.33, delta=0.05)
        self.assertAlmostEqual(d.radiation_term_mm_day, 3.97, delta=0.03)
        self.assertAlmostEqual(d.aerodynamic_term_mm_day, 1.75, delta=0.03)
        self.assertAlmostEqual(r.et0_mm_day, 5.72, delta=0.05)


class Helpers(unittest.TestCase):
    def test_rh_uses_eq_19(self):
        base = dict(
            tmax_c=34.8, tmin_c=25.6, wind_ms_2m=2, rs_mj_m2_day=22.65,
            lat_deg=LAT, elev_m=ELEV, day_of_year=DOY, g_mj_m2_day=0.14,
        )
        via_rh = et0.et0_day(**base, rh_mean_pct=60)
        self.assertAlmostEqual(via_rh.detail.ea_kpa, via_rh.detail.es_kpa * 0.6, places=12)
        via_ea = et0.et0_day(**base, ea_kpa=via_rh.detail.es_kpa * 0.6)
        self.assertAlmostEqual(via_rh.et0_mm_day, via_ea.et0_mm_day, places=12)

    def test_needs_ea_or_rh(self):
        with self.assertRaises(TypeError):
            et0.et0_day(
                tmax_c=30, tmin_c=22, wind_ms_2m=2, rs_mj_m2_day=18,
                lat_deg=8, elev_m=0, day_of_year=100, g_mj_m2_day=0,
            )

    def test_solar_units(self):
        self.assertEqual(et0.solar_to_mj(5, "MJ/m^2/day"), 5)
        self.assertAlmostEqual(et0.solar_to_mj(1, "kW-hr/m^2/day"), 3.6, places=12)
        self.assertAlmostEqual(et0.solar_to_mj(100, "W/m^2"), 8.64, places=9)
        with self.assertRaises(ValueError):
            et0.solar_to_mj(1, "cal/cm^2/day")

    def test_wind_at_2m(self):
        self.assertAlmostEqual(et0.wind_at_2m(3.2, 10), 2.4, delta=0.05)  # FAO-56 Example 14
        self.assertAlmostEqual(et0.wind_at_2m(2, 2), 2, delta=0.01)

    def test_latitude_limit(self):
        with self.assertRaises(ValueError):
            et0.extraterrestrial_radiation(80, 100)


FLAT = lambda v: [v] * 12  # noqa: E731


def monthly(**over):
    args = dict(
        tmax_c=FLAT(32), tmin_c=FLAT(23), rh_mean_pct=FLAT(80),
        wind_ms_2m=FLAT(1.5), rs_mj_m2_day=FLAT(18), lat_deg=8.23, elev_m=6,
    )
    args.update(over)
    return et0.monthly_et0(**args)


class Monthly(unittest.TestCase):
    def test_constant_temperature_means_g_zero_and_mm_month(self):
        r = monthly()
        self.assertFalse(r.elevation_assumed)
        for m in range(12):
            expected = et0.et0_day(
                tmax_c=32, tmin_c=23, rh_mean_pct=80, wind_ms_2m=1.5, rs_mj_m2_day=18,
                lat_deg=8.23, elev_m=6, day_of_year=et0.mid_month_day_of_year(m),
                g_mj_m2_day=0,
            ).et0_mm_day
            self.assertAlmostEqual(r.et0_mm_day[m], expected, places=12)
            self.assertAlmostEqual(
                r.et0_mm_month[m], r.et0_mm_day[m] * et0.DAYS_IN_MONTH[m], places=9
            )

    def test_g_wraps_december_to_january(self):
        tmax = FLAT(32)
        tmax[11] = 28  # cool December -> January G = 0.07 * (27.5 - 25.5) = 0.14 > 0
        r = monthly(tmax_c=tmax)
        with_g0 = et0.et0_day(
            tmax_c=32, tmin_c=23, rh_mean_pct=80, wind_ms_2m=1.5, rs_mj_m2_day=18,
            lat_deg=8.23, elev_m=6, day_of_year=15, g_mj_m2_day=0,
        ).et0_mm_day
        self.assertLess(r.et0_mm_day[0], with_g0)

    def test_missing_input_gives_none_for_that_month_only(self):
        tmax = FLAT(32)
        tmax[5] = None  # -999 turned into None by the POWER parser
        r = monthly(tmax_c=tmax)
        self.assertIsNone(r.et0_mm_day[5])
        self.assertIsNone(r.et0_mm_month[5])
        self.assertIsNotNone(r.et0_mm_day[4])
        self.assertTrue(any(w.startswith("Month 6") for w in r.warnings))
        self.assertTrue(
            any(w.startswith("Month 5") and "G set to 0" in w for w in r.warnings)
        )

    def test_null_elevation_is_flagged(self):
        r = monthly(elev_m=None)
        self.assertTrue(r.elevation_assumed)
        self.assertIn("sea level", r.warnings[0])

    def test_series_must_have_12_values(self):
        with self.assertRaises(ValueError):
            monthly(tmax_c=[30])


if __name__ == "__main__":
    unittest.main()
