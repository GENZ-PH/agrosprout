"""Does the app's monthly-mean ET0 method agree with summing daily ET0? (#57, task 6)

The app (mobile/src/data/et0.ts) and pipeline/build_demo.py compute ET0 once per calendar
month from monthly means (FAO-56 Eq. 6 on mean temperature, humidity, wind and radiation).
This script compares that with the alternative: ET0 for every day, summed per month, averaged
over the years. Same NASA POWER daily data (2001-2025) and the same cell elevation for both.

It only shows that the two METHODS agree. It does not show that the absolute ET0 values are
right; that needs an independent source (docs/07-rotation-engine.md section 7).

Run from the repo root (needs network on the first run; raw downloads are cached in
pipeline/raw/, which is gitignored):

    python3 pipeline/check_et0_methods.py
"""

import calendar
import datetime
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import et0  # noqa: E402
from aggregate import mean, monthly_stat, per_calendar_month  # noqa: E402
from fetch_power import daily_series, fetch_daily, solar_unit  # noqa: E402

# Iligan is the reference (humid). Laoag and Tuguegarao have a real dry season.
SITES = [
    ("Iligan (reference)", 8.23, 124.24),
    ("Laoag, Ilocos Norte", 18.2, 120.6),
    ("Tuguegarao, Cagayan", 17.6, 121.7),
]
DAILY_KEYS = ("T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN")


def daily_sum_et0(d: dict, unit: str, lat: float, elev: float) -> list[float]:
    """ET0 (mm/month) per calendar month: each day's ET0, summed per month, averaged over years."""
    per_year_month: dict[tuple[int, int], list[float]] = {}
    for date in d["T2M_MAX"]:
        vals = [d[k].get(date) for k in DAILY_KEYS]
        if any(v is None for v in vals):  # -999 already turned into None by daily_series
            continue
        tmax, tmin, rh, wind, rs = vals
        y, m, day = int(date[:4]), int(date[4:6]), int(date[6:8])
        doy = datetime.date(y, m, day).timetuple().tm_yday
        r = et0.et0_day(
            tmax_c=tmax, tmin_c=tmin, wind_ms_2m=wind, rs_mj_m2_day=et0.solar_to_mj(rs, unit),
            lat_deg=lat, elev_m=elev, day_of_year=doy, g_mj_m2_day=0, rh_mean_pct=rh,
        ).et0_mm_day
        per_year_month.setdefault((y, m), []).append(r)
    out = []
    for m in range(1, 13):
        months = [
            sum(v) / len(v) * calendar.monthrange(y, m)[1]
            for (y, mm), v in per_year_month.items()
            if mm == m
        ]
        out.append(statistics.mean(months))
    return out


def monthly_mean_et0(d: dict, unit: str, lat: float, elev: float) -> list[float]:
    """ET0 (mm/month) the way the app does it: from the 12 monthly means."""
    clim = lambda key: per_calendar_month(monthly_stat(d[key], "mean"), mean)  # noqa: E731
    return et0.monthly_et0(
        tmax_c=clim("T2M_MAX"), tmin_c=clim("T2M_MIN"), rh_mean_pct=clim("RH2M"),
        wind_ms_2m=clim("WS2M"), rs_mj_m2_day=[et0.solar_to_mj(v, unit) for v in clim("ALLSKY_SFC_SW_DWN")],
        lat_deg=lat, elev_m=elev,
    ).et0_mm_month


def check(name: str, lat: float, lon: float) -> None:
    raw = fetch_daily(lat, lon)
    d, unit = daily_series(raw), solar_unit(raw)
    elev = raw["geometry"]["coordinates"][2]  # the POWER cell's average elevation
    daily = daily_sum_et0(d, unit, lat, elev)
    monthly = monthly_mean_et0(d, unit, lat, elev)
    diffs = [(a - b) / b * 100 for a, b in zip(monthly, daily)]
    annual = (sum(monthly) - sum(daily)) / sum(daily) * 100
    rain = per_calendar_month(monthly_stat(d["PRECTOTCORR"], "sum"), mean)
    print(f"{name} ({lat}, {lon}), cell elevation {elev:.0f} m, rain {sum(rain):.0f} mm/yr")
    print(f"  daily-sum {sum(daily):.0f} mm/yr | monthly-mean {sum(monthly):.0f} mm/yr | annual difference {annual:+.2f}%")
    print("  monthly difference %: " + " ".join(f"{x:+.1f}" for x in diffs) + f" | worst {max(abs(x) for x in diffs):.1f}")


if __name__ == "__main__":
    for site in SITES:
        check(*site)
