"""GPM IMERG Final Run monthly rainfall by calendar month for the demo farm, next to NASA POWER.

    python3 pipeline/fetch_imerg.py            # downloads once, then uses pipeline/raw/imerg/
    python3 pipeline/fetch_imerg.py --offline  # cache only

Output: mobile/assets/data/demo/lanao-norte-demo-1-imerg.json

Product: GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07 (GPM_3IMERGM v07,
files V07B), GES DISC, CMR collection C2723754851-GES_DISC, landing page
https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary (read 2026-11-14: DOI
10.5067/GPM/IMERG/3B-MONTH/07, temporal coverage "1998-01-01 to 2025-10-01"; CMR lists monthly
granules up to 2025-09, so 2025-10..12 are not out yet and those months have one year fewer).

Units. The file says `precipitation` Units "mm/hr" (DAS, read 2026-11-14), fill -9999.9. The IMERG
Technical Documentation (Huffman et al., 13 July 2023, linked from the landing page,
https://arthurhou.pps.eosdis.nasa.gov/Documents/IMERG_TechnicalDocumentation_final.pdf) lists
3IMERGM `precipitation` in mm/hr (Table 2) and says of 3IMERGM: "The precipitation value is an
average rate over the calendar month." So the monthly total is
    mm per month = rate (mm/hr) x 24 x days in that month.

Method (why this one): NASA Earthdata cloud OPeNDAP (Hyrax, https://opendap.earthdata.nasa.gov),
bearer token, DAP4 index subsetting, CSV answer. One request per month returns the few cells
around the point (a few hundred bytes) instead of a 17-30 MB HDF5 file, and CSV parses with the
standard library. Granule URLs come from the public CMR granule search. Checked 2026-11-14:
the old hydrology data rods URL redirects to HTML; Harmony's EDR /position route for this collection
runs the giovanni-time-series-adapter (CSV), but our test job sat at 0% with retries and was
cancelled; the on-prem gpm1.gesdisc OPeNDAP refused connections that day.

Grid. IMERG cell centres are at -179.95 + 0.1 i (lon, 3600) and -89.95 + 0.1 j (lat, 1800), and the
variable is laid out [time][lon][lat]. The demo point 8.0 N 123.8 E lies exactly on a cell corner, so
it touches 4 cells (lon 123.75 and 123.85, lat 7.95 and 8.05). We read all cells the point touches
and use their mean for every month; the per-cell p50 spread is written to `grid_cell`.

Statistics: per calendar month, p20, p50, p80 (linear-interpolated, aggregate.percentile) of the
monthly totals across years, with n years. Pacing: one request at a time, at least MIN_INTERVAL_S
apart; every raw answer is cached in pipeline/raw/imerg/ (gitignored). Standard library only.
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

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(__file__).parent / "raw" / "imerg"
DEMO = ROOT / "mobile" / "assets" / "data" / "demo" / "lanao-norte-demo-1.json"
OUT = ROOT / "mobile" / "assets" / "data" / "demo" / "lanao-norte-demo-1-imerg.json"

FARM_ID = "lanao-norte-demo-1"
LAT, LON = 8.0, 123.8
COLLECTION = "C2723754851-GES_DISC"
SHORT_NAME = "GPM_3IMERGM"
VERSION = "07"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
LANDING = "https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary"
TECH_DOC = "https://arthurhou.pps.eosdis.nasa.gov/Documents/IMERG_TechnicalDocumentation_final.pdf"
DOI = "10.5067/GPM/IMERG/3B-MONTH/07"
# Verbatim from the "Data Citation" tab of LANDING (read 2026-11-14); fill in the access date.
CITATION = (
    "Huffman, G.J.; Stocker, E.F.; Bolvin, D.T.; Nelkin, E.J.; Tan, J. (2023), GPM IMERG Final "
    "Precipitation L3 1 month 0.1 degree x 0.1 degree V07, Greenbelt, MD, Goddard Earth Sciences "
    "Data and Information Services Center (GES DISC), Accessed: [Data Access Date], "
    "10.5067/GPM/IMERG/3B-MONTH/07"
)
START_YEAR, END_YEAR = 2001, 2025
RES = 0.1
N_LON, N_LAT = 3600, 1800
FILL = -9999.9
MIN_INTERVAL_S = 0.5
EPS = 1e-9


def hours_in_month(year: int, month: int) -> int:
    return 24 * calendar.monthrange(year, month)[1]


def rate_to_month_total(rate_mm_per_hr: float, year: int, month: int) -> float:
    """3IMERGM `precipitation` is an average rate over the calendar month (mm/hr) -> mm per month."""
    return rate_mm_per_hr * hours_in_month(year, month)


def cell_indices(coord: float, origin_centre: float, n: int, res: float = RES) -> list[int]:
    """Indices of the cells that contain `coord` (centres origin_centre + res*i). Two when it lies on an edge."""
    pos = (coord - (origin_centre - res / 2)) / res  # in cell units from the grid's outer edge
    near = round(pos)
    if abs(pos - near) < 1e-6:  # on an edge: both neighbours
        return [i for i in (near - 1, near) if 0 <= i < n]
    return [math.floor(pos)]


def lon_indices(lon: float) -> list[int]:
    return cell_indices(lon, -179.95, N_LON)


def lat_indices(lat: float) -> list[int]:
    return cell_indices(lat, -89.95, N_LAT)


def parse_dap_csv(text: str) -> dict[str, list[list[Optional[float]]]]:
    """Hyrax `.dap.csv` -> {variable path without '/': rows}; `/precipitation[0][0], 1.0, 2.0`."""
    out: dict[str, list[list[Optional[float]]]] = {}
    for line in text.splitlines():
        if not line.startswith("/"):
            continue
        head, _, rest = line.partition(",")
        name = head.split("[", 1)[0].lstrip("/")
        out.setdefault(name, []).append([float(c) if c.strip() else None for c in rest.split(",")])
    return out


def cell_rates(parsed: dict[str, list[list[Optional[float]]]]) -> list[Optional[float]]:
    """Flatten the [time=0][lon][lat] block into a list of rates (mm/hr); fill/negative -> None."""
    rows = parsed.get("Grid/precipitation") or parsed.get("precipitation") or []
    out: list[Optional[float]] = []
    for row in rows:
        for v in row:
            out.append(None if v is None or v <= FILL + 0.01 or v < 0 else v)
    return out


def check_error(text: str, url: str) -> None:
    if "Error {" in text:
        msg = text.split("message =", 1)[-1][:400]
        if "EULA" in text:
            raise earthdata.EarthdataError(
                "GES DISC refused the file (HTTP 403; on 2026-11-14 the archive's reason was 'EULA Acceptance Failure'). Sign in at urs.earthdata.nasa.gov with the "
                "token's account and approve the app 'NASA GESDISC DATA ARCHIVE' (client_id e2WVk8Pw6weeLUKZYOxvTQ, "
                "accepting its EULA), then re-run. Server said: " + msg[:200]
            )
        raise earthdata.EarthdataError(f"OPeNDAP error for {url}: {msg}")


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
    """(year, month) -> OPeNDAP URL, from CMR (public, cached)."""
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
    out: dict[tuple[int, int], tuple[str, str]] = {}
    for it in cmr.get("items", []):
        u = it["umm"]
        name = u["GranuleUR"]
        stamp = name.split("3IMERG.", 1)[1][:8]
        key = (int(stamp[:4]), int(stamp[4:6]))
        url = next((r["URL"] for r in u.get("RelatedUrls", []) if r.get("Subtype") == "OPENDAP DATA"), None)
        if url and START_YEAR <= key[0] <= END_YEAR and (key not in out or name > out[key][0]):
            out[key] = (name, url)
    return {k: url for k, (_n, url) in out.items()}


def constraint(ilon: list[int], jlat: list[int]) -> str:
    lo = f"%5B{ilon[0]}:1:{ilon[-1]}%5D"
    la = f"%5B{jlat[0]}:1:{jlat[-1]}%5D"
    return f"%2FGrid%2Fprecipitation%5B0%5D{lo}{la};%2FGrid%2Flon{lo};%2FGrid%2Flat{la}"


def fetch_month(year: int, month: int, url: str, ilon: list[int], jlat: list[int], offline: bool) -> dict:
    full = f"{url}.dap.csv?dap4.ce={constraint(ilon, jlat)}"

    def fetch() -> str:
        try:
            text = earthdata.get(full, min_interval_s=MIN_INTERVAL_S).decode()
        except earthdata.EarthdataError as e:
            # The cloud OPeNDAP answers 403 when GES DISC refuses the file behind it (EULA not accepted).
            if "403" in str(e):
                check_error("Error { EULA (HTTP 403 from the archive) " + str(e)[:200], url)
            raise
        check_error(text, url)
        return text
    name = f"{SHORT_NAME}-{VERSION}-{year}{month:02d}-lon{ilon[0]}-{ilon[-1]}-lat{jlat[0]}-{jlat[-1]}.csv"
    parsed = parse_dap_csv(_cached(RAW_DIR / name, fetch, offline))
    return {"rates": cell_rates(parsed), "lon": (parsed.get("Grid/lon") or [[]])[0], "lat": (parsed.get("Grid/lat") or [[]])[0]}


# ---------------------------------------------------------------- statistics

def climatology(totals: dict[tuple[int, int], float], digits: int = 1) -> list[dict]:
    out = []
    for m in range(1, 13):
        vals = [v for (_y, mo), v in totals.items() if mo == m]
        r = (lambda v: None if v is None else round(v, digits))
        out.append({"month": m, "p20_mm": r(percentile(vals, 0.2)), "p50_mm": r(percentile(vals, 0.5)),
                    "p80_mm": r(percentile(vals, 0.8)), "n_years": len(vals)})
    return out


def power_compare(imerg_monthly: list[dict], demo: dict) -> dict:
    """NASA POWER precip percentiles copied from the bundled demo file, beside IMERG, with IMERG minus POWER."""
    p = demo["monthly"]["precip_mm"]
    prov = next((x for x in demo.get("provenance", []) if x.get("field") == "monthly.precip_mm"), {})
    rows = []
    for m in range(12):
        im = imerg_monthly[m]
        row = {"month": m + 1}
        for q in ("p20", "p50", "p80"):
            pw, ig = p[q][m], im[f"{q}_mm"]
            row[f"power_{q}_mm"] = pw
            row[f"imerg_{q}_mm"] = ig
            row[f"diff_{q}_mm"] = None if pw is None or ig is None else round(ig - pw, 1)
        row["imerg_n_years"] = im["n_years"]
        rows.append(row)
    return {
        "label": "NASA POWER vs GPM IMERG, monthly rainfall percentiles across years (mm per month)",
        "diff_definition": "IMERG minus POWER, same percentile, same calendar month",
        "power": {
            "from_file": "mobile/assets/data/demo/lanao-norte-demo-1.json monthly.precip_mm (copied, not recomputed)",
            "source": prov.get("source", "NASA POWER daily PRECTOTCORR"),
            "native_res": prov.get("native_res"),
            "period": prov.get("period", demo.get("period")),
            "note": prov.get("note"),
            "retrieved": prov.get("retrieved"),
        },
        "monthly": rows,
    }


def build(offline: bool = False) -> dict:
    urls = granule_urls(offline)
    ilon, jlat = lon_indices(LON), lat_indices(LAT)
    totals: dict[tuple[int, int], float] = {}
    per_cell: dict[int, dict[tuple[int, int], float]] = {}
    lons = lats = None
    for (y, m) in sorted(urls):
        got = fetch_month(y, m, urls[(y, m)], ilon, jlat, offline)
        rates = got["rates"]
        lons, lats = got["lon"], got["lat"]
        if not rates or any(r is None for r in rates):
            continue  # a missing cell: leave the month out rather than average fewer cells
        for k, r in enumerate(rates):
            per_cell.setdefault(k, {})[(y, m)] = rate_to_month_total(r, y, m)
        totals[(y, m)] = rate_to_month_total(sum(rates) / len(rates), y, m)
    monthly = climatology(totals)
    demo = json.loads(DEMO.read_text())
    cell_p50 = {k: [c["p50_mm"] for c in climatology(v)] for k, v in per_cell.items()}
    spread = []
    for m in range(12):
        vals = [cell_p50[k][m] for k in cell_p50 if cell_p50[k][m] is not None]
        spread.append({"month": m + 1, "min_cell_p50_mm": min(vals) if vals else None,
                       "max_cell_p50_mm": max(vals) if vals else None})
    first, last = (min(totals), max(totals)) if totals else (None, None)
    today = dt.date.today().isoformat()
    period = f"{first[0]}-{first[1]:02d} to {last[0]}-{last[1]:02d}" if first else "none"
    return {
        "id": FARM_ID,
        "product": "GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree (GPM_3IMERGM)",
        "version": "V07 (files V07B)",
        "native_res": "0.1 x 0.1 degree grid cell (about 11 x 11 km here)",
        "period": period,
        "point": {"lat": LAT, "lon": LON},
        "grid_cell": {
            "rule": "the point lies on the shared corner of the cells listed, so each month is the mean of those cells",
            "lon_index": ilon, "lat_index": jlat,
            "cell_centres_lon": lons, "cell_centres_lat": lats,
            "per_cell_p50_spread": spread,
        },
        "units": "mm per month (file: mm/hr average rate over the calendar month, x 24 x days in month)",
        "monthly": monthly,
        "power_compare": power_compare(monthly, demo),
        "provenance": [
            {
                "source": f"NASA GES DISC, {SHORT_NAME} V07, variable Grid/precipitation (merged satellite-gauge, Final Run)",
                "citation": CITATION.replace("[Data Access Date]", today),
                "doi": DOI,
                "url": LANDING,
                "units_reference": f"IMERG Technical Documentation, Huffman et al., 13 July 2023, Table 2 and the 3IMERGM description: {TECH_DOC}",
                "access": "NASA Earthdata cloud OPeNDAP (https://opendap.earthdata.nasa.gov), DAP4 CSV subset; granule list from CMR",
                "retrieved": today,
            },
            {
                "source": "NASA POWER daily PRECTOTCORR (power_compare.power)",
                "citation": "see lanao-norte-demo-1.json provenance",
                "doi": None,
                "url": "https://power.larc.nasa.gov/",
                "retrieved": demo_retrieved(demo),
            },
        ],
        "caveats": [
            "IMERG is a satellite estimate calibrated to monthly rain gauge analyses (GPCC), on a 0.1 degree cell; NASA POWER is a 0.5 x 0.625 degree cell. The two cells cover different areas, so the numbers are not expected to match.",
            "Rain at one farm can differ from either grid cell, especially near hills and the coast.",
            f"IMERG monthly V07 granules in CMR end at {period.split(' to ')[-1]} (checked {today}); calendar months after that have one year fewer than the others (see n_years). POWER uses 2001-2025.",
            "Percentiles are across years for each calendar month: p20 is a dry year, p80 a wet year, p50 the middle.",
        ],
    }


def demo_retrieved(demo: dict) -> Optional[str]:
    return next((x.get("retrieved") for x in demo.get("provenance", []) if x.get("field") == "monthly.precip_mm"), None)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="use pipeline/raw/imerg/ only")
    a = ap.parse_args()
    out = build(offline=a.offline)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
