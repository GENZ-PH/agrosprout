"""NOAA CPC Oceanic Nino Index (issue #10) -> the `oni` part of context.json.

Source: https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
Format: header line `SEAS YR TOTAL ANOM`, then one line per 3-month season.
The latest season's ANOM is read from the file, never typed by hand.
The PAGASA advisory is a PDF: it is summarized by hand and is not written here.
Standard library only.
Run:  python3 pipeline/fetch_oni.py [--out PATH]
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
SEASONS = {"DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"}


def parse_latest(text: str) -> tuple[str, int, float | None] | None:
    """Last valid line -> (season, year, anomaly in deg C). Skips malformed lines."""
    latest = None
    for line in text.splitlines():
        parts = line.split()
        if len(parts) != 4 or parts[0] not in SEASONS:
            continue
        try:
            year, anom = int(parts[1]), float(parts[3])
        except ValueError:
            continue
        latest = (parts[0], year, anom)
    return latest


def build_oni(text: str, retrieved: str) -> dict | None:
    latest = parse_latest(text)
    if latest is None:
        return None
    season, year, anom = latest
    return {
        "season": season,
        "year": year,
        "anomaly_c": anom,
        "source": "NOAA CPC Oceanic Nino Index",
        "url": URL,
        "retrieved": retrieved,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    default_out = Path(__file__).resolve().parents[1] / "mobile" / "assets" / "data" / "context.json"
    ap.add_argument("--out", type=Path, default=default_out)
    args = ap.parse_args(argv)
    with urllib.request.urlopen(URL, timeout=60) as r:
        text = r.read().decode("utf-8")
    oni = build_oni(text, date.today().isoformat())
    if oni is None:
        print("no ONI rows found", file=sys.stderr)
        return 1
    # Keep a hand-written advisory if the file already has one.
    advisory = None
    if args.out.exists():
        try:
            advisory = json.loads(args.out.read_text(encoding="utf-8")).get("advisory")
        except (OSError, ValueError):
            advisory = None
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"oni": oni, "advisory": advisory}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
