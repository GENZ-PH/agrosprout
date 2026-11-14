"""Daily POWER -> monthly values, climatology and trends (issue #8, docs/03 "Harmonization").

Pure functions, standard library only. Months are 0-11 in the output series (index 0 = January),
like the app's `MonthlySeries`. A month of a year with more than MAX_MISSING_SHARE missing days
is missing (None), never filled in.
"""
from __future__ import annotations

import calendar
import math
from typing import Callable, Optional, Sequence

Daily = dict[str, Optional[float]]  # "YYYYMMDD" -> value
# A year-month with more than this share of missing days is treated as missing.
MAX_MISSING_SHARE = 0.10
HEAT_DAY_TMAX_C = 35.0       # heat-stress day, issue #8 (heat_days_gt35)
HEAVY_RAIN_DAY_MM = 50.0     # heavy-rain day, issue #8 (heavy_rain_days_gt50mm)
# Frost day: daily minimum below 0 °C, ETCCDI index FD ("Annual count of days when TN (daily minimum
# temperature) < 0oC"), https://etccdi.pacificclimate.org/list_27_indices.shtml (read 2026-11-14).
FROST_DAY_TMIN_C = 0.0


def _by_year_month(daily: Daily) -> dict[tuple[int, int], list[Optional[float]]]:
    groups: dict[tuple[int, int], list[Optional[float]]] = {}
    for key in sorted(daily):
        groups.setdefault((int(key[:4]), int(key[4:6])), []).append(daily[key])
    return groups


def _valid(values: list[Optional[float]], year: int, month: int) -> Optional[list[float]]:
    """The non-missing values, or None when too many days are missing."""
    days = calendar.monthrange(year, month)[1]
    ok = [v for v in values if v is not None]
    if len(values) < days or (days - len(ok)) / days > MAX_MISSING_SHARE:
        return None
    return ok


def monthly_stat(daily: Daily, how: str) -> dict[tuple[int, int], Optional[float]]:
    """(year, month) -> mean, sum (scaled to the full month), or count of days above a limit.

    how: "mean" | "sum" | "gt35" (days with value > HEAT_DAY_TMAX_C) | "gt50" (> HEAVY_RAIN_DAY_MM)
         | "lt0" (days with value < FROST_DAY_TMIN_C).
    """
    out: dict[tuple[int, int], Optional[float]] = {}
    for (y, m), values in _by_year_month(daily).items():
        ok = _valid(values, y, m)
        if ok is None:
            out[(y, m)] = None
        elif how == "mean":
            out[(y, m)] = sum(ok) / len(ok)
        elif how == "sum":
            out[(y, m)] = sum(ok) * calendar.monthrange(y, m)[1] / len(ok)
        elif how in ("gt35", "gt50"):
            limit = HEAT_DAY_TMAX_C if how == "gt35" else HEAVY_RAIN_DAY_MM
            out[(y, m)] = sum(1 for v in ok if v > limit) * calendar.monthrange(y, m)[1] / len(ok)
        elif how == "lt0":
            out[(y, m)] = sum(1 for v in ok if v < FROST_DAY_TMIN_C) * calendar.monthrange(y, m)[1] / len(ok)
        else:
            raise ValueError(how)
    return out


def percentile(values: Sequence[float], p: float) -> Optional[float]:
    """Linear-interpolated percentile (p in 0..1), the same rule as `percentile()` in power.ts."""
    if not values:
        return None
    s = sorted(values)
    idx = (len(s) - 1) * p
    lo, hi = math.floor(idx), math.ceil(idx)
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)


def per_calendar_month(
    monthly: dict[tuple[int, int], Optional[float]],
    reduce: Callable[[list[float]], Optional[float]],
) -> list[Optional[float]]:
    """Reduce the values of each calendar month across years -> 12 values."""
    return [
        reduce([v for (y, mm), v in monthly.items() if mm == m and v is not None])
        for m in range(1, 13)
    ]


def mean(values: list[float]) -> Optional[float]:
    return sum(values) / len(values) if values else None


def annual(monthly: dict[tuple[int, int], Optional[float]], how: str) -> dict[int, float]:
    """year -> sum or mean over the 12 months; years with any missing month are left out."""
    years: dict[int, list[Optional[float]]] = {}
    for (y, _m), v in monthly.items():
        years.setdefault(y, []).append(v)
    out: dict[int, float] = {}
    for y, vals in years.items():
        if len(vals) == 12 and all(v is not None for v in vals):
            nums = [v for v in vals if v is not None]
            out[y] = sum(nums) if how == "sum" else sum(nums) / 12
    return out


def sen_slope(xs: Sequence[float], ys: Sequence[float]) -> Optional[float]:
    """Sen's slope: the median of all pairwise slopes. None with fewer than 2 points."""
    slopes = [
        (ys[j] - ys[i]) / (xs[j] - xs[i])
        for i in range(len(xs)) for j in range(i + 1, len(xs)) if xs[j] != xs[i]
    ]
    return percentile(slopes, 0.5)


def mann_kendall_p(ys: Sequence[float]) -> Optional[float]:
    """Two-sided p-value of the Mann-Kendall trend test (normal approximation, tie-corrected).

    Needs at least 10 values for the approximation, otherwise None.
    """
    n = len(ys)
    if n < 10:
        return None
    s = sum((ys[j] > ys[i]) - (ys[j] < ys[i]) for i in range(n) for j in range(i + 1, n))
    counts: dict[float, int] = {}
    for y in ys:
        counts[y] = counts.get(y, 0) + 1
    var = (n * (n - 1) * (2 * n + 5) - sum(t * (t - 1) * (2 * t + 5) for t in counts.values())) / 18
    if var <= 0:
        return None
    z = 0.0 if s == 0 else (s - math.copysign(1, s)) / math.sqrt(var)
    return math.erfc(abs(z) / math.sqrt(2))


def trend_per_decade(by_year: dict[int, float]) -> tuple[Optional[float], Optional[float]]:
    """(Sen's slope per decade, Mann-Kendall p-value) for a year -> value series."""
    years = sorted(by_year)
    xs, ys = [float(y) for y in years], [by_year[y] for y in years]
    slope = sen_slope(xs, ys)
    return (None if slope is None else slope * 10, mann_kendall_p(ys))
