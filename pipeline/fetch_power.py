"""Daily NASA POWER point data for a demo farm (issue #8).

Source: NASA POWER daily point API, community AG, 2001-2025.
https://power.larc.nasa.gov/docs/services/api/temporal/daily/
`-999` means missing and becomes None. The raw JSON is cached in pipeline/raw/
(gitignored), so a re-run does not call the API again. Standard library only.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

PARAMETERS = (
    "T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETROOT", "GWETTOP",
    "RH2M", "ALLSKY_SFC_SW_DWN", "WS2M",
)
URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
RAW_DIR = Path(__file__).parent / "raw"
MISSING = -999


def cache_path(lat: float, lon: float, start: int, end: int) -> Path:
    return RAW_DIR / f"power-daily-{lat}N-{lon}E-{start}-{end}.json"


def fetch_daily(lat: float, lon: float, start_year: int = 2001, end_year: int = 2025) -> dict:
    """Raw POWER response, from the cache when it exists."""
    path = cache_path(lat, lon, start_year, end_year)
    if path.exists():
        return json.loads(path.read_text())
    query = urllib.parse.urlencode({
        "parameters": ",".join(PARAMETERS), "community": "AG",
        "longitude": lon, "latitude": lat,
        "start": f"{start_year}0101", "end": f"{end_year}1231", "format": "JSON",
    })
    req = urllib.request.Request(f"{URL}?{query}", headers={"User-Agent": "agrosprout-pipeline"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    RAW_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(data))
    return data


def daily_series(raw: dict) -> dict[str, dict[str, Optional[float]]]:
    """{parameter: {"YYYYMMDD": value or None}} with -999 turned into None."""
    out: dict[str, dict[str, Optional[float]]] = {}
    for name, days in raw["properties"]["parameter"].items():
        out[name] = {d: (None if v == MISSING else float(v)) for d, v in days.items()}
    return out


def solar_unit(raw: dict) -> str:
    return raw.get("parameters", {}).get("ALLSKY_SFC_SW_DWN", {}).get("units", "MJ/m^2/day")
