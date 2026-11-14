"""Land and lakes of the Philippines for the "looks like water" check on a lot -> mobile/assets/data/land-water-ph.json.

    python3 pipeline/build_land_water.py            # downloads once, then uses pipeline/raw/
    python3 pipeline/build_land_water.py --offline  # cache only

Why: NASA POWER's ~50 km grid cells read inner seas and lakes as land (POWER probe 2026-11-15: Manila Bay, the Sibuyan,
Visayan, Camotes and Bohol Seas, Moro Gulf, Laguna de Bay), so the app also checks the lot against a land map.

Source: Natural Earth 1:10m physical vectors, release v5.1.2 (2022-05-13), from the nvkelso/natural-earth-vector GitHub
repository: `ne_10m_land`, `ne_10m_minor_islands` and `ne_10m_lakes`; `ne_10m_admin_0_countries` only gives the window
(the bounding box of its "Philippines" feature). Natural Earth's terms (https://www.naturalearthdata.com/about/terms-of-use/,
read 2026-11-15): "in the public domain"; crediting is unnecessary, the suggested short credit is "Made with Natural Earth."

Shapes are cut to the window, coordinates rounded to 0.001 degrees (~110 m) and lines simplified with the same tolerance.
At the data's 1:10,000,000 scale, 0.001 degrees is about 0.01 mm on the map, far below its own detail. Of the lakes, the
1:10m data holds only Laguna de Bay and Taal near the Philippines (Lake Lanao is not in it). Standard library only.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

VERSION = "v5.1.2"
BASE = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{VERSION}/geojson"
FILES = ("ne_10m_land", "ne_10m_minor_islands", "ne_10m_lakes", "ne_10m_admin_0_countries")
SOURCE = f"Natural Earth 1:10m land, minor islands and lakes, release {VERSION}, via nvkelso/natural-earth-vector"
LICENCE = "Public domain (Natural Earth terms of use, https://www.naturalearthdata.com/about/terms-of-use/, read 2026-11-15)"
CREDIT = "Land and lakes: Made with Natural Earth"
# Rounding and simplification, degrees. See the module docstring: far below the detail of 1:10m data.
TOLERANCE = 0.001
DECIMALS = 3

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / f"naturalearth-{VERSION}"
OUT = HERE.parent / "mobile" / "assets" / "data" / "land-water-ph.json"

Point = list[float]
Ring = list[Point]
Window = tuple[float, float, float, float]


def _polygons(geom: dict) -> list[list[Ring]]:
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return list(geom["coordinates"])
    return []


def philippines_window(countries: dict) -> Window:
    """(min lon, min lat, max lon, max lat) of the "Philippines" feature in Natural Earth admin-0 countries."""
    pts = [
        p
        for f in countries["features"]
        if f["properties"].get("ADMIN") == "Philippines"
        for poly in _polygons(f["geometry"])
        for p in poly[0]
    ]
    if not pts:
        raise ValueError("no Philippines feature in the countries file")
    return (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))


def clip_ring(ring: Ring, w: Window) -> Ring:
    """Sutherland-Hodgman clip of a closed ring to the window; [] when nothing is left. Stays closed."""
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else list(ring)
    edges = (
        (lambda p: p[0] >= w[0], lambda a, b: _at_x(a, b, w[0])),
        (lambda p: p[0] <= w[2], lambda a, b: _at_x(a, b, w[2])),
        (lambda p: p[1] >= w[1], lambda a, b: _at_y(a, b, w[1])),
        (lambda p: p[1] <= w[3], lambda a, b: _at_y(a, b, w[3])),
    )
    for inside, cross in edges:
        out: Ring = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
        pts = out
        if not pts:
            return []
    return pts + [pts[0]]


def _at_x(a: Point, b: Point, x: float) -> Point:
    t = (x - a[0]) / (b[0] - a[0])
    return [x, a[1] + t * (b[1] - a[1])]


def _at_y(a: Point, b: Point, y: float) -> Point:
    t = (y - a[1]) / (b[1] - a[1])
    return [a[0] + t * (b[0] - a[0]), y]


def tidy_ring(ring: Ring) -> Ring:
    """Rounds to `DECIMALS` and drops repeated points; [] when fewer than 3 distinct points are left."""
    out: Ring = []
    for p in ring:
        q = [round(p[0], DECIMALS), round(p[1], DECIMALS)]
        if not out or q != out[-1]:
            out.append(q)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    if len({tuple(p) for p in out}) < 3:
        return []
    return out + [out[0]]


def simplify_ring(ring: Ring, tol: float) -> Ring:
    """Douglas-Peucker on a closed ring (first point kept); [] when it collapses below 3 distinct points."""
    if len(ring) < 4:
        return ring
    far = max(range(len(ring)), key=lambda i: _dist(ring[i], ring[0], ring[0]))
    out = _dp(ring[: far + 1], tol)[:-1] + _dp(ring[far:], tol)
    return out if len({tuple(p) for p in out}) >= 3 else []


def _dp(line: Ring, tol: float) -> Ring:
    if len(line) < 3:
        return list(line)
    i, d = max(((i, _dist(line[i], line[0], line[-1])) for i in range(1, len(line) - 1)), key=lambda x: x[1])
    if d <= tol:
        return [line[0], line[-1]]
    return _dp(line[: i + 1], tol)[:-1] + _dp(line[i:], tol)


def _dist(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == 0 and dy == 0:
        return ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return ((p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2) ** 0.5


def _cut(fc: dict, w: Window) -> tuple[list[list[Ring]], list[str]]:
    polys: list[list[Ring]] = []
    names: list[str] = []
    for f in fc["features"]:
        for poly in _polygons(f["geometry"]):
            rings = [simplify_ring(tidy_ring(clip_ring(r, w)), TOLERANCE) for r in poly]
            if rings and rings[0]:
                polys.append([rings[0]] + [r for r in rings[1:] if r])
                name = (f.get("properties") or {}).get("name")
                if name and name not in names:
                    names.append(name)
    return polys, names


def build(land: dict, islands: dict, lakes: dict, window: Window, retrieved: str) -> dict:
    land_polys = _cut(land, window)[0] + _cut(islands, window)[0]
    lake_polys, lake_names = _cut(lakes, window)
    return {
        "meta": {
            "source": SOURCE,
            "url": BASE,
            "version": VERSION,
            "retrieved": retrieved,
            "licence": LICENCE,
            "credit": CREDIT,
            "window": [float(v) for v in window],
            "window_note": "Bounding box of the Philippines feature in Natural Earth 1:10m admin-0 countries",
            "rounding_deg": TOLERANCE,
            "lakes": lake_names,
            "land_polygons": len(land_polys),
            "points": sum(len(r) for p in land_polys + lake_polys for r in p),
        },
        "land": land_polys,
        "lakes": lake_polys,
    }


def _load(name: str, offline: bool) -> dict:
    path = RAW / f"{name}.geojson"
    if not path.exists():
        if offline:
            raise FileNotFoundError(f"no cache at {path}; run once without --offline")
        RAW.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(f"{BASE}/{name}.geojson", headers={"User-Agent": "agriresilience-pipeline"})
        with urllib.request.urlopen(req, timeout=300) as r:
            path.write_bytes(r.read())
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--offline", action="store_true", help="only use the cache in pipeline/raw/")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args(argv)
    try:
        land, islands, lakes, countries = (_load(n, args.offline) for n in FILES)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
    retrieved = date.fromtimestamp((RAW / f"{FILES[0]}.geojson").stat().st_mtime).isoformat()
    out = build(land, islands, lakes, philippines_window(countries), retrieved)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    m = out["meta"]
    print(f"wrote {args.out} ({m['land_polygons']} land polygons, lakes {m['lakes']}, {m['points']} points, {args.out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
