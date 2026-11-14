"""Build the demo farm data (issue #8): daily NASA POWER -> `LotData` JSON the app bundles.

    python3 pipeline/build_demo.py            # all farms in pipeline/demo_farms.json
    python3 pipeline/build_demo.py --offline  # only use the cache in pipeline/raw/

Output: mobile/assets/data/demo/<id>.json, in the `LotData` shape of mobile/src/types.ts.
Unlike live lots, demo farms use the daily data, so they also get heat-stress days,
heavy-rain days, the mean daily Tmax and Tmin, and long-term trends.
"""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Optional

import et0
from aggregate import (
    annual, mean, monthly_stat, per_calendar_month, percentile, trend_per_decade,
)
import fetch_srtm
from fetch_power import cache_path, daily_series, fetch_daily, solar_unit

HERE = Path(__file__).parent
OUT_DIR = HERE.parent / "mobile" / "assets" / "data" / "demo"
START, END = 2001, 2025
# NASA POWER docs (power.larc.nasa.gov/docs/methodology/data/sources_meteorology and sources_fluxes, read
# 2026-11-14): meteorology is MERRA-2 on a 1/2 x 5/8 degree grid; solar radiation is CERES SYN1deg, 1 x 1 degree.
NATIVE_RES = "0.5° × 0.625° grid cell"
NATIVE_RES_SOLAR = "1° × 1° grid cell"
NATIVE_RES_ET0 = f"{NATIVE_RES}; solar radiation {NATIVE_RES_SOLAR}"
TREND_METHOD = "Sen's slope / Mann-Kendall"


def r(values: list[Optional[float]], digits: int = 2) -> list[Optional[float]]:
    return [None if v is None else round(v, digits) for v in values]


def build(farm: dict, raw: dict, retrieved: str, srtm: Optional[dict] = None) -> dict:
    """`srtm` is the result of `fetch_srtm.elevation_and_slope`; the farm's own values win over it."""
    d = daily_series(raw)
    unit = solar_unit(raw)
    lat, lon = farm["lat"], farm["lon"]

    precip = monthly_stat(d["PRECTOTCORR"], "sum")  # mm/day x days in month, per year-month
    tmax_m = monthly_stat(d["T2M_MAX"], "mean")
    tmin_m = monthly_stat(d["T2M_MIN"], "mean")
    rh_m = monthly_stat(d["RH2M"], "mean")
    ws_m = monthly_stat(d["WS2M"], "mean")
    solar_m = monthly_stat(d["ALLSKY_SFC_SW_DWN"], "mean")
    wet_m = monthly_stat(d["GWETROOT"], "mean")
    heat_m = monthly_stat(d["T2M_MAX"], "gt35")
    heavy_m = monthly_stat(d["PRECTOTCORR"], "gt50")

    clim = lambda m: per_calendar_month(m, mean)  # noqa: E731
    tmax, tmin = clim(tmax_m), clim(tmin_m)
    rh, ws = clim(rh_m), clim(ws_m)
    rs = [None if v is None else et0.solar_to_mj(v, unit) for v in clim(solar_m)]
    p = {
        "p20": per_calendar_month(precip, lambda v: percentile(v, 0.2)),
        "p50": per_calendar_month(precip, lambda v: percentile(v, 0.5)),
        "p80": per_calendar_month(precip, lambda v: percentile(v, 0.8)),
    }

    srtm = srtm or {}
    elev = farm.get("elevation_m") if farm.get("elevation_m") is not None else srtm.get("elevation_m")
    slope = farm.get("slope_pct") if farm.get("slope_pct") is not None else srtm.get("slope_pct")
    cell_elev = raw.get("geometry", {}).get("coordinates", [None, None, None])[2]
    caveats = [
        "Climate values describe a NASA POWER grid cell of roughly 50 km, not your exact field. "
        "Nearby lots in the same cell share the same climate numbers.",
    ]
    if cell_elev is not None:
        caveats.append(
            f"NASA reports this cell's average elevation as about {round(cell_elev)} m. The values "
            "describe that average height, so a field at a different elevation will differ, mainly in temperature."
        )
    caveats += srtm.get("caveats", [])
    if elev is not None and cell_elev is not None and cell_elev - elev > 100:
        caveats.append(
            f"This lot is at about {round(elev)} m but the NASA cell averages {round(cell_elev)} m, so temperatures "
            "here may read cooler than at the field."
        )
    e = et0.monthly_et0(
        tmax_c=tmax, tmin_c=tmin, rh_mean_pct=rh, wind_ms_2m=ws, rs_mj_m2_day=rs,
        lat_deg=lat, elev_m=elev,
    )
    caveats += [f"Evapotranspiration: {w}" for w in e.warnings]

    # Trends. Dry-season deficit per year = sum over the months where the typical year's rain is
    # below ET0 of (ET0 - rain that year, if positive). Years missing one of those months are left out.
    dry_months = [m for m in range(12) if e.et0_mm_month[m] is not None and p["p50"][m] is not None
                  and p["p50"][m] < e.et0_mm_month[m]]
    deficits: dict[int, float] = {}
    for y in range(START, END + 1):
        vals = [precip.get((y, m + 1)) for m in dry_months]
        if dry_months and all(v is not None for v in vals):
            deficits[y] = sum(max(0.0, e.et0_mm_month[m] - v) for m, v in zip(dry_months, vals))  # type: ignore[operator]
    prec_slope, prec_p = trend_per_decade(annual(precip, "sum"))
    def_slope, def_p = trend_per_decade(deficits)
    tmax_slope, tmax_p = trend_per_decade(annual(tmax_m, "mean"))
    p_values = {k: round(v, 4) for k, v in (
        ("annual_precip_mm_per_decade", prec_p),
        ("dry_season_deficit_mm_per_decade", def_p),
        ("tmax_c_per_decade", tmax_p),
    ) if v is not None}

    period = f"{START}-{END}"

    def prov(field: str, source: str, note: Optional[str] = None, native_res: str = NATIVE_RES) -> dict:
        out = {"field": field, "source": source, "native_res": native_res, "period": period, "retrieved": retrieved}
        if note:
            out["note"] = note
        return out

    return {
        "id": farm["id"],
        "name": farm["name"],
        "kind": "demo",
        "lat": lat,
        "lon": lon,
        "elevation_m": elev,
        "slope_pct": slope,
        "period": period,
        "monthly": {
            "precip_mm": {k: r(v, 1) for k, v in p.items()},
            "et0_mm": r(e.et0_mm_month, 1),
            "tmax_c": r(tmax), "tmin_c": r(tmin),
            "rootzone_wetness": r(clim(wet_m), 3),
            "rh2m_pct": r(rh, 1), "ws2m_ms": r(ws, 2), "solar_mj_m2_day": r(rs, 2),
            "heat_days_gt35": r(clim(heat_m), 2),
            "heavy_rain_days_gt50mm": r(clim(heavy_m), 2),
            "smap_rootzone_m3m3": None,
        },
        "trends": {
            "annual_precip_mm_per_decade": None if prec_slope is None else round(prec_slope, 1),
            "dry_season_deficit_mm_per_decade": None if def_slope is None else round(def_slope, 1),
            "tmax_c_per_decade": None if tmax_slope is None else round(tmax_slope, 2),
            "method": TREND_METHOD,
            "p_values": p_values,
        },
        "provenance": [
            prov("monthly.precip_mm", "NASA POWER daily PRECTOTCORR",
                 "monthly sum of daily mm, percentiles across years (linear interpolation)"),
            prov("monthly.et0_mm", "FAO-56 Penman-Monteith from NASA POWER daily T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN",
                 "monthly means, Eq. 6" + ("" if elev is not None else "; sea-level pressure assumed until the SRTM elevation is available"),
                 NATIVE_RES_ET0),
            prov("monthly.tmax_c", "NASA POWER daily T2M_MAX", "mean of the daily values"),
            prov("monthly.tmin_c", "NASA POWER daily T2M_MIN", "mean of the daily values"),
            prov("monthly.rootzone_wetness", "NASA POWER daily GWETROOT", "0 = dry, 1 = saturated"),
            prov("monthly.rh2m_pct", "NASA POWER daily RH2M"),
            prov("monthly.ws2m_ms", "NASA POWER daily WS2M"),
            prov("monthly.solar_mj_m2_day", "NASA POWER daily ALLSKY_SFC_SW_DWN", "converted to MJ m-2 day-1", NATIVE_RES_SOLAR),
            prov("monthly.heat_days_gt35", "NASA POWER daily T2M_MAX", "mean days per month above 35 °C"),
            prov("monthly.heavy_rain_days_gt50mm", "NASA POWER daily PRECTOTCORR", "mean days per month above 50 mm"),
            *([prov("elevation_m", fetch_srtm.CITATION, "height at the point") | {"native_res": "1 arc-second (~30 m)", "period": fetch_srtm.ACQUIRED}]
              if farm.get("elevation_m") is None and elev is not None else []),
            *([prov("slope_pct", fetch_srtm.CITATION, "Horn slope from a 3 x 3 grid with 30 m spacing, heights returned in whole metres, rounded to whole percent: a rough terrain class") | {"native_res": "1 arc-second (~30 m)", "period": fetch_srtm.ACQUIRED}]
              if farm.get("slope_pct") is None and slope is not None else []),
            prov("trends", "NASA POWER daily", f"{TREND_METHOD}; per decade; dry-season deficit = ET0 minus rain in the months where the typical year is short of rain"),
        ],
        "caveats": caveats,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="use only pipeline/raw/ (fail if a farm is not cached)")
    ap.add_argument("--no-srtm", action="store_true", help="skip the SRTM elevation and slope lookup")
    args = ap.parse_args()
    farms = json.loads((HERE / "demo_farms.json").read_text())["farms"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for farm in farms:
        if args.offline and not cache_path(farm["lat"], farm["lon"], START, END).exists():
            raise SystemExit(f"{farm['id']}: not in the cache (run without --offline)")
        raw = fetch_daily(farm["lat"], farm["lon"], START, END)
        srtm = None
        needs = farm.get("elevation_m") is None or farm.get("slope_pct") is None
        if needs and not args.no_srtm:
            if args.offline and not fetch_srtm.cache_path(farm["lat"], farm["lon"], fetch_srtm.SPACING_M).exists():
                raise SystemExit(f"{farm['id']}: SRTM not in the cache (run without --offline or use --no-srtm)")
            try:
                srtm = fetch_srtm.elevation_and_slope(farm["lat"], farm["lon"])
            except OSError as err:  # network trouble: keep going without it, and say so
                print(f"{farm['id']}: SRTM lookup failed ({err}); elevation and slope left unknown")
        data = build(farm, raw, date.today().isoformat(), srtm)
        out = OUT_DIR / f"{farm['id']}.json"
        out.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print(f"wrote {out.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
