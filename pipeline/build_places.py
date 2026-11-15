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
Barangays: every ADM4 row (barangay) and PPL row (populated place; in the Philippines mostly barangays, some sitios),
as [name, town, lat, lon] with `town` the index of its town in `places`. Most ADM4 rows have no admin3 (town) code;
those rows, and rows whose code is not a town's, get the town of the nearest place whose town is known (a town centre
or a linked ADM4/PPL row), only within the row's own province (admin1 + admin2), and a fifth field `1`: the app then
says "near <town>": tested on 3,000 rows whose town is known, 8% of guesses named a neighbouring town. Rows with no town in their province
are left out. Listed once per town (linked rows first, ADM4 before PPL), never when the name is the town's own,
sorted by town (biggest first) then name.
The search runs on the phone; nothing the farmer types is sent anywhere (rule 8). Standard library only.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from collections.abc import Iterable
from datetime import date
from pathlib import Path

URL = "https://download.geonames.org/export/dump/PH.zip"
SOURCE = "GeoNames, Philippines country dump (PH.zip)"
LICENCE = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"
CREDIT = "Place names and positions: GeoNames (CC BY 4.0)"
USER_AGENT = "AgroSprout-pipeline/1.0 (NASA Space Apps 2026 entry)"

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "geonames" / "PH.zip"
OUT = HERE.parent / "mobile" / "assets" / "data" / "places-ph.json"

# GeoNames dump columns (readme.txt): 1 name, 4 latitude, 5 longitude, 7 feature code, 10 admin1, 11 admin2,
# 12 admin3 (the town's code), 14 population.
NAME, LAT, LON, CODE, ADMIN1, ADMIN2, ADMIN3, POP = 1, 4, 5, 7, 10, 11, 12, 14
# ADM4 first, so its position wins when a PPL row repeats the same barangay.
BARANGAY_CODES = ("ADM4", "PPL")
# Grid cell (degrees) for the nearest-place search, and how many rings of cells it looks through at most.
CELL = 0.1
MAX_RINGS = 30


def parse(lines: Iterable[str]) -> list[list[str]]:
    """Tab-separated GeoNames rows (no quoting) as lists of columns."""
    return [r for r in csv.reader(lines, delimiter="\t", quoting=csv.QUOTE_NONE) if len(r) > POP]


def _province(rows: list[list[str]]) -> dict[tuple[str, str], str]:
    out: dict[tuple[str, str], str] = {}
    for r in rows:
        if r[CODE] == "ADM2":
            out[(r[ADMIN1], r[ADMIN2])] = r[NAME].removeprefix("Province of ").strip()
    return out


def _norm(s: str) -> str:
    """Lower case, accents removed, punctuation as spaces (the app's search does the same)."""
    plain = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", plain.lower()).strip()


def _core(name: str) -> str:
    """"Iligan City" -> "iligan", "City of Vigan" -> "vigan"."""
    return _norm(re.sub(r" City$", "", re.sub(r"^(City|Municipality) of ", "", name.strip())))


class _Nearest:
    """Nearest known place (lat, lon, town index), searched in rings of grid cells, one province at a time."""

    def __init__(self) -> None:
        self.grid: dict[tuple[tuple[str, str], int, int], list[tuple[float, float, int]]] = defaultdict(list)

    def add(self, province: tuple[str, str], lat: float, lon: float, town: int) -> None:
        self.grid[(province, math.floor(lat / CELL), math.floor(lon / CELL))].append((lat, lon, town))

    def town(self, province: tuple[str, str], lat: float, lon: float) -> int | None:
        gi, gj, k = math.floor(lat / CELL), math.floor(lon / CELL), math.cos(math.radians(lat))
        best: tuple[float, int] | None = None
        for ring in range(MAX_RINGS + 1):
            for i in range(gi - ring, gi + ring + 1):
                for j in range(gj - ring, gj + ring + 1):
                    if max(abs(i - gi), abs(j - gj)) != ring:
                        continue
                    for plat, plon, town in self.grid.get((province, i, j), ()):
                        d = math.hypot(plat - lat, (plon - lon) * k)
                        if best is None or d < best[0]:
                            best = (d, town)
            # Anything outside the rings searched so far is at least ring * CELL (scaled for longitude) away.
            if best is not None and best[0] <= ring * CELL * k:
                break
        return best[1] if best else None


def _barangays(rows: list[list[str]], towns: list[list[str]]) -> list[list]:
    town_of = {r[ADMIN3]: i for i, r in enumerate(towns) if r[ADMIN3]}
    nearest = _Nearest()
    for i, t in enumerate(towns):
        nearest.add((t[ADMIN1], t[ADMIN2]), float(t[LAT]), float(t[LON]), i)
    for r in rows:
        if r[CODE] in BARANGAY_CODES and r[ADMIN3] in town_of:
            t = towns[town_of[r[ADMIN3]]]
            nearest.add((t[ADMIN1], t[ADMIN2]), float(r[LAT]), float(r[LON]), town_of[r[ADMIN3]])

    seen: set[tuple[str, int]] = set()
    out: list[list] = []

    def keep(r: list[str], i: int, near: bool) -> None:
        key = (_norm(r[NAME]), i)
        if key in seen or key[0] in (_norm(towns[i][NAME]), _core(towns[i][NAME])):
            return
        seen.add(key)
        row = [r[NAME].strip(), i, round(float(r[LAT]), 3), round(float(r[LON]), 3)]
        out.append(row + [1] if near else row)

    for code in BARANGAY_CODES:
        for r in rows:
            if r[CODE] == code and r[ADMIN3] in town_of:
                keep(r, town_of[r[ADMIN3]], near=False)
    for code in BARANGAY_CODES:
        for r in rows:
            if r[CODE] == code and r[ADMIN3] not in town_of:
                i = nearest.town((r[ADMIN1], r[ADMIN2]), float(r[LAT]), float(r[LON]))
                if i is not None:
                    keep(r, i, near=True)
    out.sort(key=lambda b: (b[1], _norm(b[0])))
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
    barangays = _barangays(rows, towns)
    return {
        "meta": {
            "source": SOURCE,
            "url": URL,
            "licence": LICENCE,
            "credit": CREDIT,
            "retrieved": retrieved,
            "count": len(places),
            "fields": ["name", "province", "lat", "lon"],
            "barangay_count": len(barangays),
            "barangay_near_count": sum(1 for x in barangays if len(x) > 4),
            "barangay_fields": ["name", "town (index in places)", "lat", "lon", "1 = town is the nearest one (guessed)"],
        },
        "places": places,
        "barangays": barangays,
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
    m = data["meta"]
    print(f"wrote {args.out} ({m['count']} towns and cities, {m['barangay_count']} barangays, {m['barangay_near_count']} near a town)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
