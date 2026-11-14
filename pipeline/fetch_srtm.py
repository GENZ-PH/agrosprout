"""Elevation and slope for a demo farm point (issue #9).

Source: NASA SRTM v3 (1 arc-second, about 30 m), served via Open Topo Data (`srtm30m`),
https://www.opentopodata.org/datasets/srtm/. The public API sends no CORS header, so this
runs in `pipeline/` only (docs/03). It is rate-limited, so one request per point (9
locations) and the answer is cached in pipeline/raw/ (gitignored). Standard library only.

Slope method (Horn 1981, the usual GIS slope): sample the point and its 8 neighbours on a
3 x 3 grid with `spacing_m` between them (default 30 m, the SRTM cell size), then
    dz/dx = ((c + 2f + i) - (a + 2d + g)) / (8 x spacing)
    dz/dy = ((g + 2h + i) - (a + 2b + c)) / (8 x spacing)
    slope % = 100 x sqrt(dz/dx^2 + dz/dy^2)
with the grid  a b c / d e f / g h i  (north row first). SRTM heights are whole metres, so a
slope on one 30 m step is coarse: expect it to be good to a few percent, not to the decimal.
"""
from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, Sequence

URL = "https://api.opentopodata.org/v1/srtm30m"
RAW_DIR = Path(__file__).parent / "raw"
SPACING_M = 30.0
CITATION = "NASA SRTM v3 (1 arc-second, ~30 m), served via Open Topo Data"


def meters_per_degree(lat_deg: float) -> tuple[float, float]:
    """(metres per degree of latitude, metres per degree of longitude) at this latitude (WGS84 series)."""
    p = math.radians(lat_deg)
    lat_m = 111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p)
    lon_m = 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)
    return lat_m, lon_m


def grid_points(lat: float, lon: float, spacing_m: float = SPACING_M) -> list[tuple[float, float]]:
    """The 9 points a b c / d e f / g h i, north row first, west to east."""
    lat_m, lon_m = meters_per_degree(lat)
    dlat, dlon = spacing_m / lat_m, spacing_m / lon_m
    return [
        (round(lat + r * dlat, 6), round(lon + c * dlon, 6))
        for r in (1, 0, -1) for c in (-1, 0, 1)
    ]


def horn_slope_pct(z: Sequence[Optional[float]], spacing_m: float = SPACING_M) -> Optional[float]:
    """Slope in percent from the 9 heights in grid order (see the module note); None if any is missing."""
    if len(z) != 9 or any(v is None for v in z):
        return None
    a, b, c, d, _e, f, g, h, i = z  # type: ignore[misc]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * spacing_m)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * spacing_m)
    return 100 * math.hypot(dzdx, dzdy)


def cache_path(lat: float, lon: float, spacing_m: float) -> Path:
    return RAW_DIR / f"srtm30m-{lat}N-{lon}E-{spacing_m:g}m.json"


def fetch_heights(lat: float, lon: float, spacing_m: float = SPACING_M) -> list[Optional[float]]:
    """Heights (m) at the 9 grid points; None where the point is outside any tile."""
    path = cache_path(lat, lon, spacing_m)
    if path.exists():
        data = json.loads(path.read_text())
    else:
        locations = "|".join(f"{la},{lo}" for la, lo in grid_points(lat, lon, spacing_m))
        req = urllib.request.Request(
            f"{URL}?{urllib.parse.urlencode({'locations': locations})}",
            headers={"User-Agent": "agrosprout-pipeline"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        if data.get("status") != "OK":
            raise RuntimeError(f"Open Topo Data answered: {data}")
        RAW_DIR.mkdir(exist_ok=True)
        path.write_text(json.dumps(data))
    return [r.get("elevation") for r in data["results"]]


def elevation_and_slope(lat: float, lon: float, spacing_m: float = SPACING_M) -> dict:
    """{"elevation_m", "slope_pct", "caveats"}; each value is None when it could not be found."""
    z = fetch_heights(lat, lon, spacing_m)
    elev = z[4]
    caveats: list[str] = []
    if elev is None:
        caveats.append("SRTM has no height at this point (outside any tile), so the elevation is unknown.")
    elif elev == 0:
        caveats.append(
            "SRTM reads 0 m here. That is also what the sea reads, so the point may be on the shoreline: check the coordinates."
        )
    slope = horn_slope_pct(z, spacing_m)
    if slope is None and elev is not None:
        caveats.append("SRTM is missing around this point, so the slope is unknown.")
    return {
        "elevation_m": elev,
        "slope_pct": None if slope is None else round(slope, 1),
        "caveats": caveats,
    }
