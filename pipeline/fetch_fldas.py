"""NASA FLDAS Noah monthly soil moisture, evapotranspiration, rainfall and runoff for the demo farm.

    python3 pipeline/fetch_fldas.py            # downloads once, then uses pipeline/raw/fldas/
    python3 pipeline/fetch_fldas.py --offline  # cache only

Output: mobile/assets/data/demo/lanao-norte-demo-1-fldas.json

Product: FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 degree (MERRA-2 and CHIRPS) V001
(FLDAS_NOAH01_C_GL_M v001), GES DISC, CMR collection C1563089663-GES_DISC, DOI 10.5067/5NHC22T9375G,
landing page https://disc.gsfc.nasa.gov/datacollection/FLDAS_NOAH01_C_GL_M_001.html.
Domain (CMR, read 2026-11-14): global land, 60S to 90N, 180W to 180E, so it covers 8.0 N 123.8 E.
The regional FLDAS monthly runs (Southern/East/West Africa etc.) were retired and "superseded by the
global monthly dataset" (CMR abstract; README_FLDAS.pdf, last revised 12 June 2026). Rainfall forcing
is CHIRPS inside 50S-50N (README section 1.1), so CHIRPS here. CMR lists 300 monthly granules for
2001-01..2025-12 (checked 2026-11-14).

Variables (exact names, units from the file's DMR and README Table 5a, read 2026-11-14):
    SoilMoi00_10cm_tavg  m^3 m-3     soil moisture 0-10 cm      (kept as m3/m3)
    SoilMoi10_40cm_tavg  m^3 m-3     soil moisture 10-40 cm     (kept as m3/m3)
    Evap_tavg            kg m-2 s-1  total evapotranspiration   -> mm per month
    Rainf_f_tavg         kg m-2 s-1  rainfall flux (forcing)    -> mm per month
    Qs_tavg              kg m-2 s-1  storm surface runoff       -> mm per month
    Qsb_tavg             kg m-2 s-1  baseflow-groundwater runoff -> mm per month
Fill value -9999 (masked water or no data).

Unit conversion: "_tavg" fields are time averages over the month (LIS output naming). 1 kg of water
per m2 is a 1 mm layer, so kg m-2 s-1 = mm/s, and
    mm per month = rate (kg m-2 s-1) x 86400 x days in that month.

Method: same as fetch_imerg.py. Earthdata cloud OPeNDAP (Hyrax), bearer token, DAP4 index subset,
CSV answer, one request per month for a 4 x 4 cell block around the point; granule URLs from the
public CMR granule search; every raw answer cached in pipeline/raw/fldas/ (gitignored).

Grid: cell centres X = -179.95 + 0.1 i (3600), Y = -59.95 + 0.1 j (1500); variables are [time][Y][X].
The demo point lies on a cell corner, so it touches 4 cells (X 123.75/123.85, Y 7.95/8.05). We use the
mean of the touching cells that pass `usable_cell` (values in every month, and the rainfall forcing
is not zero in every month); if none pass, the nearest usable cell in the block. The rule and the
cells used are written to `grid_cell`.

Statistics: per calendar month, p20/p50/p80 (linear, aggregate.percentile) across years, with n years.
Standard library only.
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import math
import sys
import urllib.parse
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
import earthdata  # noqa: E402
from aggregate import percentile  # noqa: E402
from fetch_imerg import cell_indices, check_error, parse_dap_csv  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(__file__).parent / "raw" / "fldas"
OUT = ROOT / "mobile" / "assets" / "data" / "demo" / "lanao-norte-demo-1-fldas.json"

FARM_ID = "lanao-norte-demo-1"
LAT, LON = 8.0, 123.8
COLLECTION = "C1563089663-GES_DISC"
SHORT_NAME = "FLDAS_NOAH01_C_GL_M"
VERSION = "001"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
LANDING = "https://disc.gsfc.nasa.gov/datacollection/FLDAS_NOAH01_C_GL_M_001.html"
README = "https://docserver.gesdisc.eosdis.nasa.gov/public/project/hydrology/README_FLDAS.pdf"
DOI = "10.5067/5NHC22T9375G"
# Citation format from README_FLDAS.pdf section 1.2.3 (last revised 12 June 2026); fill in the access date.
CITATION = (
    "Amy McNally, NASA/GSFC/HSL (2018), FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 "
    "degree (MERRA-2 and CHIRPS), Greenbelt, MD, USA, Goddard Earth Sciences Data and Information "
    "Services Center (GES DISC), Accessed [Data Access Date], 10.5067/5NHC22T9375G"
)
START_YEAR, END_YEAR = 2001, 2025
RES = 0.1
N_X, N_Y = 3600, 1500
X0, Y0 = -179.95, -59.95
FILL = -9999.0
MIN_INTERVAL_S = 0.5
BLOCK = 1  # extra cells on each side of the touching cells (4 x 4 block for a corner point)

# file variable -> (output key, kind). kind "flux": kg m-2 s-1 -> mm/month; "sm": m3/m3 as is.
VARIABLES = {
    "SoilMoi00_10cm_tavg": ("soil_moisture_0_10cm_m3m3", "sm"),
    "SoilMoi10_40cm_tavg": ("soil_moisture_10_40cm_m3m3", "sm"),
    "Evap_tavg": ("evapotranspiration_mm", "flux"),
    "Rainf_f_tavg": ("rainfall_mm", "flux"),
    "Qs_tavg": ("surface_runoff_mm", "flux"),
    "Qsb_tavg": ("subsurface_runoff_mm", "flux"),
}
RAIN = "Rainf_f_tavg"


def seconds_in_month(year: int, month: int) -> int:
    return 86400 * calendar.monthrange(year, month)[1]


def flux_to_month_total(rate_kg_m2_s: float, year: int, month: int) -> float:
    """Monthly mean water flux (kg m-2 s-1 = mm/s) -> mm per month."""
    return rate_kg_m2_s * seconds_in_month(year, month)


def x_indices(lon: float) -> list[int]:
    return cell_indices(lon, X0, N_X, RES)


def y_indices(lat: float) -> list[int]:
    return cell_indices(lat, Y0, N_Y, RES)


def block_range(idx: list[int], n: int) -> tuple[int, int]:
    return max(0, idx[0] - BLOCK), min(n - 1, idx[-1] + BLOCK)


def clean(v: Optional[float]) -> Optional[float]:
    return None if v is None or v <= FILL + 0.5 else v


def parse_block(text: str) -> dict:
    """Hyrax `.dap.csv` -> {"X": [...], "Y": [...], var: {(y, x) centre pair: value or None}}."""
    p = parse_dap_csv(text)
    xs, ys = (p.get("X") or [[]])[0], (p.get("Y") or [[]])[0]
    out: dict = {"X": [round(v, 2) for v in xs], "Y": [round(v, 2) for v in ys]}
    for var in VARIABLES:
        rows = p.get(var) or []
        grid = {}
        for j, row in enumerate(rows):
            for i, v in enumerate(row):
                grid[(out["Y"][j], out["X"][i])] = clean(v)
        out[var] = grid
    return out


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


def granule_urls(offline: bool) -> dict[tuple[int, int], str]:
    def fetch() -> str:
        q = urllib.parse.urlencode({
            "collection_concept_id": COLLECTION,
            "temporal": f"{START_YEAR}-01-01T00:00:00Z,{END_YEAR}-12-31T23:59:59Z",
            "page_size": "2000",
        })
        return earthdata.get_public(f"{CMR}?{q}").decode()
    data = json.loads(_cached(RAW_DIR / f"cmr-{SHORT_NAME}-{VERSION}-{START_YEAR}-{END_YEAR}.json", fetch, offline))
    return pick_granules(data)


def pick_granules(cmr: dict) -> dict[tuple[int, int], str]:
    """FLDAS_NOAH01_C_GL_M.001:FLDAS_NOAH01_C_GL_M.A200101.001.nc -> {(2001, 1): OPeNDAP URL}."""
    out: dict[tuple[int, int], str] = {}
    for it in cmr.get("items", []):
        u = it["umm"]
        stamp = u["GranuleUR"].rsplit(".A", 1)[1][:6]
        key = (int(stamp[:4]), int(stamp[4:6]))
        url = next((r["URL"] for r in u.get("RelatedUrls", []) if r.get("Subtype") == "OPENDAP DATA"), None)
        if url and START_YEAR <= key[0] <= END_YEAR:
            out[key] = url
    return out


def constraint(ys: tuple[int, int], xs: tuple[int, int]) -> str:
    y = f"%5B{ys[0]}:1:{ys[1]}%5D"
    x = f"%5B{xs[0]}:1:{xs[1]}%5D"
    parts = [f"%2F{v}%5B0%5D{y}{x}" for v in VARIABLES] + [f"%2FX{x}", f"%2FY{y}"]
    return ";".join(parts)


def fetch_month(year: int, month: int, url: str, ys: tuple[int, int], xs: tuple[int, int], offline: bool) -> dict:
    full = f"{url}.dap.csv?dap4.ce={constraint(ys, xs)}"

    def fetch() -> str:
        try:
            text = earthdata.get(full, min_interval_s=MIN_INTERVAL_S).decode()
        except earthdata.EarthdataError as e:
            if "403" in str(e):
                check_error("Error { EULA (HTTP 403 from the archive) " + str(e)[:200], url)
            raise
        check_error(text, url)
        return text
    name = f"{SHORT_NAME}-{VERSION}-{year}{month:02d}-y{ys[0]}-{ys[1]}-x{xs[0]}-{xs[1]}.csv"
    return parse_block(_cached(RAW_DIR / name, fetch, offline))


# ---------------------------------------------------------------- cell choice + statistics

def usable_cell(cell: tuple[float, float], months: dict[tuple[int, int], dict]) -> bool:
    """A cell is usable if every variable has a value in every month and its rainfall is not always zero."""
    rain_total = 0.0
    for blk in months.values():
        for var in VARIABLES:
            if blk[var].get(cell) is None:
                return False
        rain_total += blk[RAIN][cell]
    return rain_total > 0


def choose_cells(months: dict[tuple[int, int], dict]) -> tuple[list[tuple[float, float]], list[dict], str]:
    """(cells used, why each touching cell was kept or dropped, rule applied)."""
    any_blk = next(iter(months.values()))
    touching = [(round(Y0 + RES * j, 2), round(X0 + RES * i, 2)) for j in y_indices(LAT) for i in x_indices(LON)]
    notes = []
    used = []
    for c in touching:
        ok = usable_cell(c, months)
        notes.append({"lat": c[0], "lon": c[1], "used": ok,
                      "reason": "values in every month" if ok else
                      "dropped: missing values (water mask) or rainfall forcing zero in every month"})
        if ok:
            used.append(c)
    if used:
        return used, notes, "mean of the cells that touch the point and have usable values in every month"
    cands = [(y, x) for y in any_blk["Y"] for x in any_blk["X"] if usable_cell((y, x), months)]
    if not cands:
        return [], notes, "no usable cell in the block"
    best = min(cands, key=lambda c: math.hypot(c[0] - LAT, c[1] - LON))
    return [best], notes, "no touching cell was usable, so the nearest usable cell in the block"


def monthly_values(months: dict[tuple[int, int], dict], cells: list[tuple[float, float]]) -> dict[str, dict]:
    """{output key: {(y, m): value in output units}} using the mean of `cells`."""
    out: dict[str, dict] = {key: {} for key, _k in VARIABLES.values()}
    for (y, m), blk in months.items():
        for var, (key, kind) in VARIABLES.items():
            vals = [blk[var].get(c) for c in cells]
            if not vals or any(v is None for v in vals):
                continue
            mean = sum(vals) / len(vals)
            out[key][(y, m)] = flux_to_month_total(mean, y, m) if kind == "flux" else mean
    tot = out.setdefault("total_runoff_mm", {})
    for k in out["surface_runoff_mm"]:
        if k in out["subsurface_runoff_mm"]:
            tot[k] = out["surface_runoff_mm"][k] + out["subsurface_runoff_mm"][k]
    return out


def climatology(series: dict[tuple[int, int], float], digits: int) -> list[dict]:
    out = []
    r = (lambda v: None if v is None else round(v, digits))
    for m in range(1, 13):
        vals = [v for (_y, mo), v in series.items() if mo == m]
        out.append({"month": m, "p20": r(percentile(vals, 0.2)), "p50": r(percentile(vals, 0.5)),
                    "p80": r(percentile(vals, 0.8)), "n_years": len(vals)})
    return out


UNITS = {
    "soil_moisture_0_10cm_m3m3": ("SoilMoi00_10cm_tavg", "m3/m3 (volumetric water content, as in the file: m^3 m-3)"),
    "soil_moisture_10_40cm_m3m3": ("SoilMoi10_40cm_tavg", "m3/m3 (volumetric water content, as in the file: m^3 m-3)"),
    "evapotranspiration_mm": ("Evap_tavg", "mm per month (file: kg m-2 s-1 monthly mean, x 86400 x days in month)"),
    "rainfall_mm": ("Rainf_f_tavg", "mm per month (file: kg m-2 s-1 monthly mean, x 86400 x days in month); CHIRPS forcing"),
    "surface_runoff_mm": ("Qs_tavg", "mm per month (file: kg m-2 s-1 monthly mean, x 86400 x days in month)"),
    "subsurface_runoff_mm": ("Qsb_tavg", "mm per month (file: kg m-2 s-1 monthly mean, x 86400 x days in month)"),
    "total_runoff_mm": ("Qs_tavg + Qsb_tavg", "mm per month (sum of the two converted runoff terms, same year and month)"),
}


def build(offline: bool = False) -> dict:
    urls = granule_urls(offline)
    ys, xs = block_range(y_indices(LAT), N_Y), block_range(x_indices(LON), N_X)
    months = {k: fetch_month(k[0], k[1], urls[k], ys, xs, offline) for k in sorted(urls)}
    cells, cell_notes, rule = choose_cells(months)
    series = monthly_values(months, cells)
    monthly = {key: climatology(s, 3 if key.endswith("m3m3") else 1) for key, s in series.items()}
    covered = sorted(series["rainfall_mm"])
    period = f"{covered[0][0]}-{covered[0][1]:02d} to {covered[-1][0]}-{covered[-1][1]:02d}" if covered else "none"
    today = dt.date.today().isoformat()
    return {
        "id": FARM_ID,
        "product": "FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 degree (MERRA-2 and CHIRPS) (FLDAS_NOAH01_C_GL_M)",
        "version": "001",
        "native_res": "0.1 x 0.1 degree grid cell (about 11 x 11 km here), monthly",
        "period": period,
        "point": {"lat": LAT, "lon": LON},
        "grid_cell": {
            "rule": rule,
            "block_y_index": list(ys), "block_x_index": list(xs),
            "touching_cells": cell_notes,
            "cells_used": [{"lat": c[0], "lon": c[1]} for c in cells],
        },
        "units": {k: {"file_variable": v[0], "unit": v[1]} for k, v in UNITS.items()},
        "monthly": monthly,
        "provenance": [
            {
                "source": f"NASA GES DISC, {SHORT_NAME} V{VERSION} (FLDAS, Noah 3.6.1, forced by MERRA-2 and CHIRPS), variables "
                          + ", ".join(VARIABLES),
                "short_name": SHORT_NAME,
                "version": VERSION,
                "doi": DOI,
                "native_res": "0.1 degree, monthly",
                "period": period,
                "citation": CITATION.replace("[Data Access Date]", today),
                "url": LANDING,
                "units_reference": f"README_FLDAS.pdf Table 5a and the granule DMR: {README}",
                "unit_conversion": "kg m-2 s-1 (= mm/s of water) x 86400 x days in month -> mm per month; soil moisture kept in m3/m3",
                "access": "NASA Earthdata cloud OPeNDAP (https://opendap.earthdata.nasa.gov), DAP4 CSV subset; granule list from CMR",
                "retrieved": today,
            },
        ],
        "caveats": [
            "FLDAS is a land surface model run (Noah 3.6.1), not a measurement: soil moisture, evapotranspiration and runoff are modelled from weather inputs (MERRA-2) and CHIRPS rainfall.",
            "Values are for a 0.1 degree cell (about 11 km), not for one plot; soil type and slope at the farm can differ.",
            "Percentiles are across years for each calendar month: p20 is a dry year, p80 a wet year, p50 the middle.",
            "Rainfall here is the CHIRPS forcing on the FLDAS grid; it will not match NASA POWER or GPM IMERG exactly.",
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="use pipeline/raw/fldas/ only")
    a = ap.parse_args()
    out = build(offline=a.offline)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
