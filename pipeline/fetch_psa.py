"""PSA OpenSTAT yields per province (issue #10) -> mobile/assets/data/psa/yields.json.

Source: PSA OpenSTAT, tables 0012E4EVCP0 (volume of production, metric tons) and
0022E4EAHC0 (area harvested, hectares), palay and corn, by province, annual.
https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS

Notes checked on 2026-11-14:
  * the default Python User-Agent gets 403, so a normal browser one is sent;
  * ask for `csv` (the `json-stat2` format returns a placeholder value);
  * ".." means no value yet and a 0.00 area is not a real yield, both become None.

yield_t_per_ha = annual production / annual area harvested, taken for the latest
year in which both are present. Standard library only.
Run:  python3 pipeline/fetch_psa.py [--provinces 80,104] [--out PATH]
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

BASE = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS"
PRODUCTION = "0012E4EVCP0.px"
AREA = "0022E4EAHC0.px"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
# The table's own labels for the two crop groups we keep.
CROPS = {"Palay": "palay", "Corn": "corn"}
DEFAULT_PROVINCES = ["80"]  # Lanao del Norte (Geolocation code in the table)
YEARS_BACK = 6


def clean_name(text: str) -> str:
    """Geolocation labels are indented with dots, e.g. '....Lanao del Norte'."""
    return text.lstrip(".").strip()


def number(cell: str) -> float | None:
    """'..' (not available) and empty cells are None; other cells are floats."""
    c = cell.strip()
    if c in ("", ".."):
        return None
    try:
        return float(c)
    except ValueError:
        return None


def parse_csv(text: str) -> dict[tuple[str, str], dict[int, float | None]]:
    """CSV from a PxWeb query -> {(croptype, province name): {year: annual value}}.

    Only the 'YYYY Annual' columns are read.
    """
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return {}
    header = rows[0]
    annual = {i: int(h.split()[0]) for i, h in enumerate(header) if h.endswith(" Annual")}
    out: dict[tuple[str, str], dict[int, float | None]] = {}
    for r in rows[1:]:
        if len(r) < 2:
            continue
        key = (r[0].strip(), clean_name(r[1]))
        out[key] = {year: number(r[i]) if i < len(r) else None for i, year in annual.items()}
    return out


def latest_yield(
    production: dict[int, float | None], area: dict[int, float | None]
) -> dict | None:
    """Latest year with a real production and a positive area -> PsaCropYield dict."""
    for year in sorted(set(production) & set(area), reverse=True):
        p, a = production[year], area[year]
        if p is not None and a is not None and a > 0:
            return {
                "year": year,
                "production_t": p,
                "area_ha": a,
                "yield_t_per_ha": round(p / a, 3),
            }
    return None


def build_yields(
    production_csv: str,
    area_csv: str,
    provinces: dict[str, str],
    retrieved: str,
) -> dict:
    """provinces = {geolocation code: name}. Missing data gives null, never 0."""
    prod = parse_csv(production_csv)
    area = parse_csv(area_csv)
    out: dict = {}
    for code, name in provinces.items():
        entry: dict = {"name": name, "palay": None, "corn": None}
        for label, field in CROPS.items():
            key = (label, name)
            if key in prod and key in area:
                entry[field] = latest_yield(prod[key], area[key])
        out[code] = entry
    return {
        "source": f"PSA OpenSTAT, tables {PRODUCTION[:-3]} (production) and {AREA[:-3]} (area harvested)",
        "retrieved": retrieved,
        "provinces": out,
    }


# --- network (not used by the tests) -----------------------------------------


def _request(url: str, body: dict | None = None) -> bytes:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, **({"Content-Type": "application/json"} if data else {})},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _query(table: str, province_codes: list[str]) -> tuple[str, dict[str, str]]:
    meta = json.loads(_request(f"{BASE}/{table}"))
    var = {v["code"]: v for v in meta["variables"]}
    geo = dict(zip(var["Geolocation"]["values"], var["Geolocation"]["valueTexts"]))
    crops = [c for c, t in zip(var["Ecosystem/Croptype"]["values"], var["Ecosystem/Croptype"]["valueTexts"]) if t in CROPS]
    years = var["Year"]["values"][-YEARS_BACK:]
    body = {
        "query": [
            {"code": "Ecosystem/Croptype", "selection": {"filter": "item", "values": crops}},
            {"code": "Geolocation", "selection": {"filter": "item", "values": province_codes}},
            {"code": "Year", "selection": {"filter": "item", "values": years}},
            {"code": "Period", "selection": {"filter": "all", "values": ["*"]}},
        ],
        "response": {"format": "csv"},
    }
    text = _request(f"{BASE}/{table}", body).decode("utf-8-sig")
    return text, {c: clean_name(geo[c]) for c in province_codes}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--provinces", default=",".join(DEFAULT_PROVINCES), help="PSA Geolocation codes, comma separated")
    default_out = Path(__file__).resolve().parents[1] / "mobile" / "assets" / "data" / "psa" / "yields.json"
    ap.add_argument("--out", type=Path, default=default_out)
    args = ap.parse_args(argv)
    codes = [c.strip() for c in args.provinces.split(",") if c.strip()]
    prod_csv, names = _query(PRODUCTION, codes)
    area_csv, _ = _query(AREA, codes)
    result = build_yields(prod_csv, area_csv, names, date.today().isoformat())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
