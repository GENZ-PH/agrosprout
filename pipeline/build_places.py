"""Philippine towns and cities for the offline place search on the lots map (issue #196) -> mobile/assets/data/places-ph.json.

    python3 pipeline/build_places.py            # downloads once, then uses pipeline/raw/
    python3 pipeline/build_places.py --offline  # cache only

Source: GeoNames, Philippines country dump PH.zip (https://download.geonames.org/export/dump/PH.zip).
Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); the credit text is in `CREDIT`.

Kept: every ADM3 row (the country's cities and municipalities), as [name, province, lat, lon]. The province comes
from the ADM2 row with the same admin1 and admin2 codes, without "Province of ". GeoNames splits Metro Manila into
districts ("Capital District", ...) that farmers would not recognise, so admin1 "NCR" becomes "Metro Manila".
Lat/lon are rounded to 3 decimals (about 100 m). Rows are sorted by population, largest first, so the app's search
lists bigger towns first among equal matches; the population itself is not stored.
Towns only for now: barangays come later (#196), once GeoNames' barangay coverage has been checked.
The search runs on the phone; nothing the farmer types is sent anywhere (rule 8). Standard library only.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
import zipfile
from collections.abc import Iterable
from datetime import date
from pathlib import Path

URL = "https://download.geonames.org/export/dump/PH.zip"
SOURCE = "GeoNames, Philippines country dump (PH.zip)"
LICENCE = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"
CREDIT = "Town names and positions: GeoNames (CC BY 4.0)"
USER_AGENT = "AgroSprout-pipeline/1.0 (NASA Space Apps 2026 entry)"

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "geonames" / "PH.zip"
OUT = HERE.parent / "mobile" / "assets" / "data" / "places-ph.json"

# GeoNames dump columns (readme.txt): 1 name, 4 latitude, 5 longitude, 7 feature code, 10 admin1, 11 admin2,
# 14 population.
NAME, LAT, LON, CODE, ADMIN1, ADMIN2, POP = 1, 4, 5, 7, 10, 11, 14


def parse(lines: Iterable[str]) -> list[list[str]]:
    """Tab-separated GeoNames rows (no quoting) as lists of columns."""
    return [r for r in csv.reader(lines, delimiter="\t", quoting=csv.QUOTE_NONE) if len(r) > POP]


def _province(rows: list[list[str]]) -> dict[tuple[str, str], str]:
    out: dict[tuple[str, str], str] = {}
    for r in rows:
        if r[CODE] == "ADM2":
            out[(r[ADMIN1], r[ADMIN2])] = r[NAME].removeprefix("Province of ").strip()
    return out


def _population(r: list[str]) -> int:
    try:
        return int(r[POP])
    except ValueError:
        return 0


def build(rows: list[list[str]], retrieved: str) -> dict:
    province = _province(rows)
    towns = [r for r in rows if r[CODE] == "ADM3"]
    towns.sort(key=lambda r: (-_population(r), r[NAME]))
    places = [
        [
            r[NAME].strip(),
            "Metro Manila" if r[ADMIN1] == "NCR" else province.get((r[ADMIN1], r[ADMIN2]), ""),
            round(float(r[LAT]), 3),
            round(float(r[LON]), 3),
        ]
        for r in towns
    ]
    return {
        "meta": {
            "source": SOURCE,
            "url": URL,
            "licence": LICENCE,
            "credit": CREDIT,
            "retrieved": retrieved,
            "count": len(places),
            "fields": ["name", "province", "lat", "lon"],
        },
        "places": places,
    }


def _download() -> bytes:
    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--offline", action="store_true", help="only use the cache in pipeline/raw/")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args(argv)
    if not RAW.exists():
        if args.offline:
            print(f"no cache at {RAW}; run once without --offline", file=sys.stderr)
            return 1
        RAW.parent.mkdir(parents=True, exist_ok=True)
        RAW.write_bytes(_download())
    with zipfile.ZipFile(RAW) as z, z.open("PH.txt") as f:
        rows = parse(io.TextIOWrapper(f, encoding="utf-8", newline=""))
    data = build(rows, date.fromtimestamp(RAW.stat().st_mtime).isoformat())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({data['meta']['count']} towns and cities)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
