"""Monthly reference evapotranspiration (ET0), FAO-56 Penman-Monteith.

Python mirror of ``mobile/src/data/et0.ts``. Both must give the same answer
for the same inputs; the shared check is FAO-56 Chapter 4, Example 17.

Source: Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop
evapotranspiration: guidelines for computing crop water requirements. FAO
Irrigation and Drainage Paper 56. Equation numbers below are the paper's own
(Chapters 2 and 3).

Standard library only (``math``), so it runs anywhere without installing
anything. Units: temperatures in degrees C, vapour pressure in kPa, wind in
m/s at 2 m, radiation in MJ m-2 day-1, ET0 in mm/day (and mm/month).

If you change a constant or equation here, change ``et0.ts`` the same way.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional, Sequence

# --- Constants (each with its FAO-56 source) --------------------------------

GSC = 0.082  # solar constant, MJ m-2 min-1 (Eq. 21)
ALBEDO = 0.23  # grass reference crop albedo (Eq. 38)
SIGMA = 4.903e-9  # Stefan-Boltzmann constant, MJ K-4 m-2 day-1 (Eq. 39)
KELVIN_RNL = 273.16  # degrees C to K as used in Eq. 39
KELVIN_PM = 273  # degrees C to K as used in 900/(T + 273) (Eq. 6)
MM_PER_MJ = 0.408  # radiation to equivalent evaporation (Eq. 20)
MAX_ABS_LAT_DEG = 66  # beyond this the Eq. 25 shortcut is not used here
DAYS_IN_MONTH = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)  # common year
MJ_PER_W_M2_DAY = 0.0864  # 1 W m-2 in MJ m-2 day-1 (FAO-56 Chapter 3, Table 3)
MJ_PER_KWH = 3.6  # 1 kWh = 3.6 MJ (exact)


# --- Helpers ----------------------------------------------------------------


def mid_month_day_of_year(month0: int) -> int:
    """Day of year (common year) of the 15th of a month; month0 = 0 for January."""
    return 15 + sum(DAYS_IN_MONTH[:month0])


def solar_to_mj(value: float, unit: str) -> float:
    """Convert incoming solar radiation to MJ m-2 day-1.

    NASA POWER reports the unit in its response ``parameters`` metadata. An
    unknown unit raises so a wrong unit can never pass silently.
    """
    u = "".join(unit.strip().lower().split())
    if u in ("mj/m^2/day", "mjm-2day-1", "mj/m2/day"):
        return value
    if u in ("kw-hr/m^2/day", "kwh/m^2/day", "kwh/m2/day"):
        return value * MJ_PER_KWH
    if u in ("w/m^2", "wm-2", "w/m2"):
        return value * MJ_PER_W_M2_DAY
    raise ValueError(f'Unknown solar radiation unit: "{unit}"')


def wind_at_2m(uz: float, height_m: float) -> float:
    """Convert wind speed measured at height z (m) to 2 m. FAO-56 Eq. 47."""
    return uz * 4.87 / math.log(67.8 * height_m - 5.42)


def _assert_latitude(lat_deg: float) -> None:
    if not math.isfinite(lat_deg) or abs(lat_deg) > MAX_ABS_LAT_DEG:
        raise ValueError(
            f"Latitude must be within +/-{MAX_ABS_LAT_DEG} degrees, got {lat_deg}"
        )


# --- FAO-56 building blocks -------------------------------------------------


def saturation_vapour_pressure(t_c: float) -> float:
    """Saturation vapour pressure at air temperature T (degrees C), kPa. Eq. 11."""
    return 0.6108 * math.exp(17.27 * t_c / (t_c + 237.3))


def vapour_pressure_slope(t_c: float) -> float:
    """Slope of the saturation vapour pressure curve, kPa/degC. Eq. 13."""
    return 4098 * saturation_vapour_pressure(t_c) / (t_c + 237.3) ** 2


def atmospheric_pressure(elev_m: float) -> float:
    """Atmospheric pressure from elevation, kPa. Eq. 7."""
    return 101.3 * ((293 - 0.0065 * elev_m) / 293) ** 5.26


def psychrometric_constant(pressure_kpa: float) -> float:
    """Psychrometric constant, kPa/degC. Eq. 8 (0.665e-3 * P)."""
    return 0.000665 * pressure_kpa


def _declination(doy: int) -> float:
    return 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)  # Eq. 24, radians


def _sunset_hour_angle(lat_rad: float, decl: float) -> float:
    return math.acos(-math.tan(lat_rad) * math.tan(decl))  # Eq. 25, radians


def extraterrestrial_radiation(lat_deg: float, doy: int) -> float:
    """Extraterrestrial radiation Ra, MJ m-2 day-1. Eq. 21 with Eq. 22 to 25."""
    _assert_latitude(lat_deg)
    phi = math.pi / 180 * lat_deg  # Eq. 22
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)  # Eq. 23
    delta = _declination(doy)  # Eq. 24
    ws = _sunset_hour_angle(phi, delta)  # Eq. 25
    return (
        (24 * 60 / math.pi)
        * GSC
        * dr
        * (
            ws * math.sin(phi) * math.sin(delta)
            + math.cos(phi) * math.cos(delta) * math.sin(ws)
        )
    )


def daylight_hours(lat_deg: float, doy: int) -> float:
    """Maximum possible daylight hours N. Eq. 34."""
    _assert_latitude(lat_deg)
    phi = math.pi / 180 * lat_deg
    return 24 / math.pi * _sunset_hour_angle(phi, _declination(doy))


def solar_from_sunshine(sunshine_hours: float, lat_deg: float, doy: int) -> float:
    """Solar radiation from sunshine hours (Angstrom, default as/bs). Eq. 35."""
    ra = extraterrestrial_radiation(lat_deg, doy)
    n = daylight_hours(lat_deg, doy)
    return (0.25 + 0.5 * (sunshine_hours / n)) * ra


# --- ET0 for one period ------------------------------------------------------


@dataclass(frozen=True)
class Et0Detail:
    """Intermediates, exposed so tests can check them against the worked example."""

    tmean_c: float
    pressure_kpa: float
    gamma_kpa_c: float
    delta_kpa_c: float
    es_kpa: float
    ea_kpa: float
    ra_mj_m2_day: float
    daylight_hours: float
    rso_mj_m2_day: float
    rns_mj_m2_day: float
    rnl_mj_m2_day: float
    rn_mj_m2_day: float
    radiation_term_mm_day: float
    aerodynamic_term_mm_day: float


@dataclass(frozen=True)
class Et0DayResult:
    et0_mm_day: float
    detail: Et0Detail


def et0_day(
    *,
    tmax_c: float,
    tmin_c: float,
    wind_ms_2m: float,
    rs_mj_m2_day: float,
    lat_deg: float,
    elev_m: float,
    day_of_year: int,
    g_mj_m2_day: float,
    ea_kpa: Optional[float] = None,
    rh_mean_pct: Optional[float] = None,
) -> Et0DayResult:
    """FAO-56 Penman-Monteith (Eq. 6) for one period from mean inputs, mm/day.

    Provide ``ea_kpa`` OR ``rh_mean_pct``. ``rs_mj_m2_day`` must already be in
    MJ m-2 day-1 (use ``solar_to_mj``). ``g_mj_m2_day`` is the soil heat flux
    (Eq. 43 or 44; 0 for daily periods).
    """
    tmean = (tmax_c + tmin_c) / 2  # Eq. 9
    p = atmospheric_pressure(elev_m)  # Eq. 7
    gamma = psychrometric_constant(p)  # Eq. 8
    delta = vapour_pressure_slope(tmean)  # Eq. 13, at mean air temperature

    es = (
        saturation_vapour_pressure(tmax_c) + saturation_vapour_pressure(tmin_c)
    ) / 2  # Eq. 12
    if ea_kpa is not None:
        ea = ea_kpa
    elif rh_mean_pct is not None:
        ea = es * rh_mean_pct / 100  # Eq. 19 (RHmean only; less desirable than Eq. 17)
    else:
        raise TypeError("Provide ea_kpa or rh_mean_pct")

    ra = extraterrestrial_radiation(lat_deg, day_of_year)  # Eq. 21
    n = daylight_hours(lat_deg, day_of_year)  # Eq. 34
    rso = (0.75 + 2e-5 * elev_m) * ra  # Eq. 37
    rns = (1 - ALBEDO) * rs_mj_m2_day  # Eq. 38
    rel_shortwave = min(rs_mj_m2_day / rso, 1.0)  # Rs/Rso limited to <= 1.0 (Eq. 39)
    rnl = (
        SIGMA
        * ((tmax_c + KELVIN_RNL) ** 4 + (tmin_c + KELVIN_RNL) ** 4)
        / 2
        * (0.34 - 0.14 * math.sqrt(ea))
        * (1.35 * rel_shortwave - 0.35)
    )  # Eq. 39
    rn = rns - rnl  # Eq. 40

    denom = delta + gamma * (1 + 0.34 * wind_ms_2m)
    radiation_term = MM_PER_MJ * delta * (rn - g_mj_m2_day) / denom
    aerodynamic_term = (
        gamma * (900 / (tmean + KELVIN_PM)) * wind_ms_2m * (es - ea) / denom
    )

    return Et0DayResult(
        et0_mm_day=radiation_term + aerodynamic_term,  # Eq. 6
        detail=Et0Detail(
            tmean_c=tmean,
            pressure_kpa=p,
            gamma_kpa_c=gamma,
            delta_kpa_c=delta,
            es_kpa=es,
            ea_kpa=ea,
            ra_mj_m2_day=ra,
            daylight_hours=n,
            rso_mj_m2_day=rso,
            rns_mj_m2_day=rns,
            rnl_mj_m2_day=rnl,
            rn_mj_m2_day=rn,
            radiation_term_mm_day=radiation_term,
            aerodynamic_term_mm_day=aerodynamic_term,
        ),
    )


# --- ET0 for the twelve months of a climatology ------------------------------

MonthlySeries = Sequence[Optional[float]]  # 12 values, January first, None = missing


@dataclass(frozen=True)
class MonthlyEt0Result:
    et0_mm_day: list[Optional[float]]
    et0_mm_month: list[Optional[float]]
    elevation_assumed: bool
    warnings: list[str]


def monthly_et0(
    *,
    tmax_c: MonthlySeries,
    tmin_c: MonthlySeries,
    rh_mean_pct: MonthlySeries,
    wind_ms_2m: MonthlySeries,
    rs_mj_m2_day: MonthlySeries,
    lat_deg: float,
    elev_m: Optional[float],
) -> MonthlyEt0Result:
    """Monthly ET0 from monthly mean inputs.

    Soil heat flux G uses the previous and next month's mean temperature
    (Eq. 43), wrapping December to January because the inputs are a 12-month
    climatology. ``elev_m=None`` falls back to sea level and is flagged.
    """
    series = (tmax_c, tmin_c, rh_mean_pct, wind_ms_2m, rs_mj_m2_day)
    if any(len(s) != 12 for s in series):
        raise ValueError("Every monthly series must have 12 values (January to December)")

    elevation_assumed = elev_m is None
    elev = 0.0 if elev_m is None else elev_m
    warnings: list[str] = []
    if elevation_assumed:
        warnings.append("Elevation not supplied: sea level (0 m) assumed.")

    tmean: list[Optional[float]] = [
        None if tx is None or tn is None else (tx + tn) / 2
        for tx, tn in zip(tmax_c, tmin_c)
    ]

    et0_day_out: list[Optional[float]] = []
    et0_month_out: list[Optional[float]] = []
    for m in range(12):
        tx, tn = tmax_c[m], tmin_c[m]
        rh, u2, rs = rh_mean_pct[m], wind_ms_2m[m], rs_mj_m2_day[m]
        if tx is None or tn is None or rh is None or u2 is None or rs is None:
            et0_day_out.append(None)
            et0_month_out.append(None)
            warnings.append(f"Month {m + 1}: an input was missing, ET0 not computed.")
            continue
        prev, nxt = tmean[(m + 11) % 12], tmean[(m + 1) % 12]
        if prev is not None and nxt is not None:
            g = 0.07 * (nxt - prev)  # Eq. 43
        else:
            g = 0.0
            warnings.append(
                f"Month {m + 1}: neighbouring month missing, soil heat flux G set to 0."
            )
        r = et0_day(
            tmax_c=tx,
            tmin_c=tn,
            rh_mean_pct=rh,
            wind_ms_2m=u2,
            rs_mj_m2_day=rs,
            lat_deg=lat_deg,
            elev_m=elev,
            day_of_year=mid_month_day_of_year(m),
            g_mj_m2_day=g,
        )
        et0_day_out.append(r.et0_mm_day)
        et0_month_out.append(r.et0_mm_day * DAYS_IN_MONTH[m])

    return MonthlyEt0Result(
        et0_mm_day=et0_day_out,
        et0_mm_month=et0_month_out,
        elevation_assumed=elevation_assumed,
        warnings=warnings,
    )
