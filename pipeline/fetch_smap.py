"""SMAP L4 surface and root-zone soil moisture by calendar month for the demo farm.

    python3 pipeline/fetch_smap.py            # downloads once, then uses pipeline/raw/smap/
    python3 pipeline/fetch_smap.py --offline  # cache only

Output: mobile/assets/data/demo/lanao-norte-demo-1-smap.json

Product: SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical
Data, Version 8 (SPL4SMGP v008), NSIDC DAAC, CMR collection C3480440870-NSIDC_CPRD, landing page
https://nsidc.org/data/spl4smgp/versions/8 (read 2026-11-14: temporal coverage "31 March 2015 to
present", 9 km, EASE-Grid 2.0 Global EPSG:6933). Variables (from the granule DMR, read 2026-11-14):
    Geophysical_Data/sm_surface   "Top layer soil moisture (0-5 cm)",   m3 m-3, fill -9999, valid 0..0.9
    Geophysical_Data/sm_rootzone  "Root zone soil moisture (0-100 cm)", m3 m-3, fill -9999, valid 0..0.9
The files are 3-hourly time averages; the granule name carries the centre time.

Method (why this one): NASA Earthdata cloud OPeNDAP (Hyrax, https://opendap.earthdata.nasa.gov),
bearer token, DAP4 index subsetting, CSV answer (`.dap.csv?dap4.ce=...`). One request returns a
3 x 3 block of cells (about 300 bytes); a 1 x 1 slice came back empty (2026-11-14), so we ask for
3 x 3 and read the centre. A whole 3-hourly file would be far bigger, Harmony only returns
NetCDF-4/GeoTIFF for this collection (needs non-stdlib readers) and there is no SMAP L4 monthly
product, so a point subset per sampled granule is the lightest path that stays standard library.
Granule URLs come from the public CMR granule search (version tags change over time, for example
Vv8010 in 2015 and Vv8013 in 2026, so names are never guessed).

Sampling: one granule per sampled day, the 03:00-06:00 UTC average (name `...T043000...`, that is
11:00-14:00 Philippine time), on days 1, 6, 11, 16, 21 and 26 of every month, 2015-04 to 2025-12.
A year-month counts if at least MIN_SAMPLES_PER_MONTH of its 6 samples are valid; its value is the
mean of its samples. Per calendar month we report the mean, p20 and p80 across years of those
monthly means (linear-interpolated percentiles, aggregate.percentile) and n (years).

Grid cell: the point is projected to EASE-Grid 2.0 (cylindrical equal-area, WGS84, true scale at
30 deg, EPSG:6933 parameters) and matched to the nearest cell centre in the file's own /x and /y
vectors (cached). The cell's cell_lat/cell_lon from the file are written to the output.
Pacing: one request at a time, at least MIN_INTERVAL_S apart; each raw answer is cached in
pipeline/raw/smap/ (gitignored) so a re-run makes no call. Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
import urllib.parse
from pathlib import Path
from typing import Optional, Sequence

sys.path.insert(0, str(Path(__file__).parent))
import earthdata  # noqa: E402
from aggregate import mean, percentile  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(__file__).parent / "raw" / "smap"
DEMO = ROOT / "mobile" / "assets" / "data" / "demo" / "lanao-norte-demo-1.json"
OUT = ROOT / "mobile" / "assets" / "data" / "demo" / "lanao-norte-demo-1-smap.json"

FARM_ID = "lanao-norte-demo-1"
LAT, LON = 8.0, 123.8
COLLECTION = "C3480440870-NSIDC_CPRD"
SHORT_NAME = "SPL4SMGP"
VERSION = "008"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
LANDING = "https://nsidc.org/data/spl4smgp/versions/8"
DOI = "10.5067/T5RUATAQREF8"
# Verbatim from the "Data Citation" box on LANDING (read 2026-11-14); the page asks to add the
# access date and a description of the subset.
CITATION = (
    "Reichle, R., De Lannoy, G., Koster, R. D., Crow, W. T., Kimball, J. S., Liu, Q. & Bechtold, M. "
    "(2025). SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical "
    "Data . (SPL4SMGP, Version 8). [Data Set]. Boulder, Colorado USA. NASA National Snow and Ice Data "
    "Center Distributed Active Archive Center. https://doi.org/10.5067/T5RUATAQREF8 ."
)
GRANULE_TIME = "T043000"
SAMPLE_DAYS = (1, 6, 11, 16, 21, 26)
MIN_SAMPLES_PER_MONTH = 4
START, END = (2015, 4), (2025, 12)
FILL = -9999.0
VALID = (0.0, 0.9)
MIN_INTERVAL_S = 0.5
VARS = ("Geophysical_Data/sm_surface", "Geophysical_Data/sm_rootzone", "cell_lat", "cell_lon")

# EASE-Grid 2.0 global (EPSG:6933): WGS84 ellipsoid, Lambert cylindrical equal-area, standard parallel 30 deg.
_A = 6378137.0
_F = 1 / 298.257223563
_E2 = _F * (2 - _F)
_E = math.sqrt(_E2)


def ease2_xy(lat: float, lon: float) -> tuple[float, float]:
    """Projected (x, y) metres of a WGS84 point on EPSG:6933."""
    p1 = math.radians(30.0)
    k0 = math.cos(p1) / math.sqrt(1 - _E2 * math.sin(p1) ** 2)
    s = math.sin(math.radians(lat))
    q = (1 - _E2) * (s / (1 - _E2 * s * s) - (1 / (2 * _E)) * math.log((1 - _E * s) / (1 + _E * s)))
    return _A * k0 * math.radians(lon), _A * q / (2 * k0)


def nearest_index(values: Sequence[float], target: float) -> int:
    return min(range(len(values)), key=lambda i: abs(values[i] - target))


def parse_dap_csv(text: str) -> dict[str, list[list[Optional[float]]]]:
    """Hyrax `.dap.csv` -> {variable path without leading '/': rows}. Lines look like
    `/Geophysical_Data/sm_surface[0], 0.1, 0.2, 0.3` (one row per first index) or `/x, 1, 2, ...`.
    An empty cell becomes None."""
    out: dict[str, list[list[Optional[float]]]] = {}
    for line in text.splitlines():
        if not line.startswith("/"):
            continue
        head, _, rest = line.partition(",")
        name = head.split("[", 1)[0].lstrip("/")
        cells = [c.strip() for c in rest.split(",")]
        out.setdefault(name, []).append([float(c) if c else None for c in cells])
    return out


def clean(v: Optional[float]) -> Optional[float]:
    """None for missing, fill or out-of-range values (valid range from the file's attributes)."""
    if v is None or v == FILL or not (VALID[0] <= v <= VALID[1]):
        return None
    return v


def months(start: tuple[int, int] = START, end: tuple[int, int] = END) -> list[tuple[int, int]]:
    y, m = start
    out = []
    while (y, m) <= end:
        out.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def sample_dates(start: tuple[int, int] = START, end: tuple[int, int] = END) -> list[dt.date]:
    return [dt.date(y, m, d) for y, m in months(start, end) for d in SAMPLE_DAYS]


# ---------------------------------------------------------------- network + cache

def _cached(path: Path, fetch, offline: bool) -> str:
    if path.exists():
        return path.read_text()
    if offline:
        raise SystemExit(f"--offline and {path.name} is not cached")
    text = fetch()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return text


def granule_urls(year: int, offline: bool) -> dict[str, str]:
    """'YYYY-MM-DD' -> OPeNDAP URL of that day's T043000 granule, from CMR (public, cached per year)."""
    def fetch() -> str:
        q = urllib.parse.urlencode({
            "collection_concept_id": COLLECTION,
            "readable_granule_name": f"SMAP_L4_SM_gph_*{GRANULE_TIME}_*",
            "options[readable_granule_name][pattern]": "true",
            "temporal": f"{year}-01-01T00:00:00Z,{year}-12-31T23:59:59Z",
            "page_size": "2000",
        })
        return earthdata.get_public(f"{CMR}?{q}").decode()
    data = json.loads(_cached(RAW_DIR / f"cmr-{SHORT_NAME}-{VERSION}-{year}{GRANULE_TIME}.json", fetch, offline))
    return pick_granules(data)


def pick_granules(cmr: dict) -> dict[str, str]:
    """From a CMR umm_json answer: date -> OPeNDAP URL. If a date has two granules (reprocessing),
    keep the one whose name sorts last (higher version tag)."""
    best: dict[str, tuple[str, str]] = {}
    for it in cmr.get("items", []):
        u = it["umm"]
        name = u["GranuleUR"]
        stamp = name.split("_gph_", 1)[1][:8]
        day = f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}"
        url = next((r["URL"] for r in u.get("RelatedUrls", []) if r.get("Subtype") == "OPENDAP DATA"), None)
        if url and (day not in best or name > best[day][0]):
            best[day] = (name, url)
    return {d: url for d, (_n, url) in best.items()}


def grid_index(sample_url: str, offline: bool) -> tuple[int, int]:
    """(row, col) of the cell whose centre is nearest the point, from the file's /y and /x."""
    def fetch() -> str:
        return earthdata.get(f"{sample_url}.dap.csv?dap4.ce=%2Fx;%2Fy", min_interval_s=MIN_INTERVAL_S).decode()
    xy = parse_dap_csv(_cached(RAW_DIR / f"{SHORT_NAME}-{VERSION}-xy.csv", fetch, offline))
    x, y = ease2_xy(LAT, LON)
    return nearest_index(xy["y"][0], y), nearest_index(xy["x"][0], x)


def block_ce(row: int, col: int) -> str:
    sl = f"%5B{row - 1}:1:{row + 1}%5D%5B{col - 1}:1:{col + 1}%5D"
    return ";".join(f"%2F{urllib.parse.quote(v, safe='')}{sl}" for v in VARS)


def sample(day: str, url: str, row: int, col: int, offline: bool) -> dict[str, Optional[float]]:
    def fetch() -> str:
        return earthdata.get(f"{url}.dap.csv?dap4.ce={block_ce(row, col)}", min_interval_s=MIN_INTERVAL_S).decode()
    parsed = parse_dap_csv(_cached(RAW_DIR / f"{SHORT_NAME}-{VERSION}-{day}{GRANULE_TIME}-r{row}c{col}.csv", fetch, offline))
    return centre_values(parsed)


def centre_values(parsed: dict[str, list[list[Optional[float]]]]) -> dict[str, Optional[float]]:
    def c(name: str) -> Optional[float]:
        rows = parsed.get(name)
        return rows[1][1] if rows and len(rows) == 3 and len(rows[1]) == 3 else None
    return {
        "surface": clean(c("Geophysical_Data/sm_surface")),
        "rootzone": clean(c("Geophysical_Data/sm_rootzone")),
        "cell_lat": c("cell_lat"),
        "cell_lon": c("cell_lon"),
    }


# ---------------------------------------------------------------- statistics

def monthly_means(samples: dict[str, Optional[float]], min_n: int = MIN_SAMPLES_PER_MONTH) -> dict[tuple[int, int], float]:
    """{'YYYY-MM-DD': value} -> {(year, month): mean}, only months with >= min_n valid samples."""
    by: dict[tuple[int, int], list[float]] = {}
    for day, v in samples.items():
        if v is not None:
            by.setdefault((int(day[:4]), int(day[5:7])), []).append(v)
    return {k: sum(vs) / len(vs) for k, vs in by.items() if len(vs) >= min_n}


def climatology(mm: dict[tuple[int, int], float], digits: int = 3) -> list[dict]:
    out = []
    for m in range(1, 13):
        vals = [v for (_y, mo), v in mm.items() if mo == m]
        r = (lambda v: None if v is None else round(v, digits))
        out.append({"mean": r(mean(vals)), "p20": r(percentile(vals, 0.2)), "p80": r(percentile(vals, 0.8)), "n": len(vals)})
    return out


def build(offline: bool = False) -> dict:
    urls: dict[str, str] = {}
    for y in range(START[0], END[0] + 1):
        urls.update(granule_urls(y, offline))
    dates = [d.isoformat() for d in sample_dates()]
    have = [d for d in dates if d in urls]
    missing = [d for d in dates if d not in urls]
    row, col = grid_index(urls[have[0]], offline)
    surf: dict[str, Optional[float]] = {}
    root: dict[str, Optional[float]] = {}
    cell = None
    for i, d in enumerate(have):
        try:
            s = sample(d, urls[d], row, col, offline)
        except earthdata.EarthdataError as e:
            print(f"  {d}: {e}", file=sys.stderr)
            continue
        surf[d], root[d] = s["surface"], s["rootzone"]
        if cell is None and s["cell_lat"] is not None:
            cell = (s["cell_lat"], s["cell_lon"])
        if (i + 1) % 60 == 0:
            print(f"  {i + 1}/{len(have)} granules", file=sys.stderr)
    surf_m, root_m = monthly_means(surf), monthly_means(root)
    s_clim, r_clim = climatology(surf_m), climatology(root_m)
    demo = json.loads(DEMO.read_text())
    gwet = demo["monthly"]["rootzone_wetness"]
    gwet_prov = next((p for p in demo["provenance"] if p["field"] == "monthly.rootzone_wetness"), {})
    today = dt.date.today().isoformat()
    n_valid_s = sum(v is not None for v in surf.values())
    n_valid_r = sum(v is not None for v in root.values())
    return {
        "id": FARM_ID,
        "product": "SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data (SPL4SMGP)",
        "version": "Version 8 (008)",
        "native_res": "9 km EASE-Grid 2.0 Global (EPSG:6933) cell",
        "period": f"{START[0]}-{START[1]:02d} to {END[0]}-{END[1]:02d}",
        "point": {"lat": LAT, "lon": LON},
        "grid_cell": {
            "grid": "EASE-Grid 2.0 Global 9 km (3856 x 1624)",
            "row": row, "col": col,
            "cell_lat": None if cell is None else round(cell[0], 5),
            "cell_lon": None if cell is None else round(cell[1], 5),
            "note": "cell_lat/cell_lon are the cell centre as written in the SPL4SMGP files",
        },
        "units": "m3/m3 (volumetric water content)",
        "sampling": {
            "granule": "03:00-06:00 UTC 3-hourly average (granule centre 04:30 UTC, 12:30 Philippine time)",
            "days_of_month": list(SAMPLE_DAYS),
            "min_samples_per_month": MIN_SAMPLES_PER_MONTH,
            "granules_requested": len(have),
            "valid_surface_samples": n_valid_s,
            "valid_rootzone_samples": n_valid_r,
            "sample_days_without_granule": missing,
            "statistic": "mean of the samples in each year-month, then mean, p20, p80 across years per calendar month (linear-interpolated percentiles)",
        },
        "monthly": [
            {
                "month": m + 1,
                "surface_m3m3": s_clim[m],
                "rootzone_m3m3": r_clim[m],
            }
            for m in range(12)
        ],
        "power_compare": {
            "label": "NASA POWER GWETROOT (model root-zone soil wetness): a different quantity",
            "quantity": "degree of saturation, 0 = dry, 1 = saturated, unitless",
            "not_comparable_note": (
                "GWETROOT is a fraction of saturation, SMAP sm_rootzone is volumetric water content (m3/m3). "
                "They are not the same number and should not be subtracted or plotted on one axis without saying so."
            ),
            "source": gwet_prov.get("source", "NASA POWER daily GWETROOT"),
            "native_res": gwet_prov.get("native_res"),
            "period": gwet_prov.get("period", demo.get("period")),
            "statistic": "mean of the daily values per calendar month (copied from lanao-norte-demo-1.json monthly.rootzone_wetness)",
            "from_file": "mobile/assets/data/demo/lanao-norte-demo-1.json",
            "monthly": [{"month": m + 1, "gwetroot": gwet[m]} for m in range(12)],
        },
        "provenance": [
            {
                "source": f"NASA NSIDC DAAC, {SHORT_NAME} Version 8, variables sm_surface and sm_rootzone",
                "citation": CITATION + f" Subset: cell row {row}, col {col} (EASE-Grid 2.0 9 km), {GRANULE_TIME[1:3]}:30 UTC granules on days {', '.join(map(str, SAMPLE_DAYS))} of each month, {START[0]}-{START[1]:02d} to {END[0]}-{END[1]:02d}. Date Accessed {today}.",
                "doi": DOI,
                "url": LANDING,
                "access": "NASA Earthdata cloud OPeNDAP (https://opendap.earthdata.nasa.gov), DAP4 CSV subset; granule list from CMR",
                "retrieved": today,
            },
            {
                "source": "NASA POWER daily GWETROOT (power_compare block)",
                "citation": "see lanao-norte-demo-1.json provenance",
                "doi": None,
                "url": "https://power.larc.nasa.gov/",
                "retrieved": gwet_prov.get("retrieved"),
            },
        ],
        "caveats": [
            "SPL4SMGP is a model analysis (the NASA land model with SMAP brightness temperatures assimilated), not a direct satellite reading of this field.",
            "Surface is the top 0-5 cm, root zone is 0-100 cm, both as a 9 km cell average. A single paddy or upland lot can be much wetter or drier than the cell, and irrigation or flooding in the lot is not in the product.",
            "Sampled, not complete: one 3-hour average (03:00-06:00 UTC) on 6 days per month. Monthly values are means of those samples.",
            "The point sits about 320 m from the west edge and about 550 m from the north edge of its 9 km cell, so lots a few hundred metres west or north may fall in the neighbouring cell.",
            "SMAP starts 2015-03-31, so this is about 11 years, not the 25 years used for NASA POWER.",
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="use pipeline/raw/smap/ only")
    a = ap.parse_args()
    out = build(offline=a.offline)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
