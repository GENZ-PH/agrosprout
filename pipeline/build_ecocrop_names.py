"""FAO Ecocrop crop names for the S2 crop search (issue #152) -> mobile/assets/data/ecocrop-names.json.

    python3 pipeline/build_ecocrop_names.py            # downloads once, then uses pipeline/raw/
    python3 pipeline/build_ecocrop_names.py --offline  # cache only

Source: FAO Ecocrop database, full copy in OpenCLIM/ecocrop `EcoCrop_DB.csv` (latin-1), pinned to commit
f13577f4237604b15d85d8e43741714a2d1eb2d4 (2026-01-30, 2,568 species), the same mirror `crops.json` cites.
Only names are used: EcoPortCode, ScientificName and COMNAME. Nothing here is scored or ranked.

Licence: the OpenCLIM repository is under the UK Open Government Licence v3; the data is (c) FAO (Ecocrop).
FAO's website terms (https://www.fao.org/contact-us/terms/en/, read 2026-11-14) allow use "in non-commercial
products or services, provided that appropriate acknowledgement of FAO as the source and copyright holder is
given", without implying FAO endorsement. The app is free and non-commercial; the credit text is in `CREDIT`.

Our library crops are matched to their Ecocrop species by `MAPPING` (codes cited in `crops.json`, plus the parent
species for rice and corn). Their names go to `library` (merged into the library crop's search names by the app)
and their rows leave `species`, so a crop never shows up twice. Every name is kept: COMNAME lists names A-Z, so a
cap would drop common ones ("okra" is 40th of 54 for Abelmoschus esculentus), except names built on an ethnic slur
(`OFFENSIVE`), which the app would otherwise show as "Also called ...". Standard library only.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

COMMIT = "f13577f4237604b15d85d8e43741714a2d1eb2d4"
URL = f"https://raw.githubusercontent.com/OpenCLIM/ecocrop/{COMMIT}/EcoCrop_DB.csv"
SOURCE = "FAO Ecocrop database (EcoCrop_DB.csv), via OpenCLIM/ecocrop"
LICENCE = (
    "Data (c) FAO (Ecocrop). FAO website terms (https://www.fao.org/contact-us/terms/en/, read 2026-11-14): "
    "non-commercial use with acknowledgement of FAO as source and copyright holder, no FAO endorsement implied. "
    "OpenCLIM/ecocrop repository: UK Open Government Licence v3."
)
CREDIT = "Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / f"EcoCrop_DB_{COMMIT[:7]}.csv"
OUT = HERE.parent / "mobile" / "assets" / "data" / "ecocrop-names.json"

# crop_id in crops.json -> EcoPortCodes. The first code's ScientificName is the crop's `sci`.
MAPPING: dict[str, list[str]] = {
    "lowland-rice": ["1574", "8143"],
    "corn": ["2175", "238663"],
    "mungbean": ["2150"],
    "peanut": ["2199"],
    "soybean": ["1150"],
    "string-bean": ["10834"],
    "sweet-potato": ["1265"],
    "sorghum": ["48747", "1982"],
    "eggplant": ["1965"],
    "sesbania-rostrata": ["43996"],
}


# Old common names built on ethnic slurs, found by scanning every name in the CSV (2026-11-14): "kafir corn" (sorghum),
# "kaffir orange", "Hottentot tobacco", "jew's apple" (eggplant), "jew'-myrtle", "gypsy onion", "bushman's tea".
# Kept on purpose: Spanish/Portuguese "negro" (= black, e.g. "zapote negro") and "mammy apple" (from "mamey").
OFFENSIVE = re.compile(r"\b(kaff?ir|hottentot|jew'|jews?\b|g[iy]psy|bushman)", re.IGNORECASE)


def split_names(comname: str) -> list[str]:
    """COMNAME "a (region), b, A" -> ["a", "b"]: notes in parentheses removed, spaces collapsed, case-insensitive unique,
    names in `OFFENSIVE` dropped."""
    out: list[str] = []
    seen: set[str] = set()
    for part in comname.split(","):
        name = re.sub(r"\([^)]*\)", "", part)
        name = re.sub(r"\s+", " ", name).strip().strip("'").strip()
        if name and name.lower() not in seen and not OFFENSIVE.search(name):
            seen.add(name.lower())
            out.append(name)
    return out


def _merge(lists: list[list[str]]) -> list[str]:
    return split_names(", ".join(n for names in lists for n in names))


def build_index(rows: list[dict], mapping: dict[str, list[str]], retrieved: str) -> dict:
    by_code = {r["EcoPortCode"].strip(): r for r in rows}
    library: dict[str, dict] = {}
    mapped: set[str] = set()
    for crop_id, codes in mapping.items():
        missing = [c for c in codes if c not in by_code]
        if missing:
            raise ValueError(f"{crop_id}: EcoPortCode {', '.join(missing)} not in the Ecocrop CSV")
        mapped.update(codes)
        library[crop_id] = {
            "sci": by_code[codes[0]]["ScientificName"].strip(),
            "names": _merge([split_names(by_code[c]["COMNAME"]) for c in codes]),
        }
    species = [
        {"code": code, "sci": r["ScientificName"].strip(), "names": split_names(r["COMNAME"])}
        for code, r in by_code.items()
        if code not in mapped and r["ScientificName"].strip()
    ]
    species.sort(key=lambda s: (s["sci"].lower(), s["code"]))
    return {
        "meta": {
            "source": SOURCE,
            "url": URL,
            "commit": COMMIT,
            "retrieved": retrieved,
            "licence": LICENCE,
            "credit": CREDIT,
            "species_count": len(species),
        },
        "library": library,
        "species": species,
    }


def _download() -> bytes:
    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
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
    rows = list(csv.DictReader(io.StringIO(RAW.read_bytes().decode("latin-1"), newline="")))
    index = build_index(rows, MAPPING, date.fromtimestamp(RAW.stat().st_mtime).isoformat())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({index['meta']['species_count']} species, {len(index['library'])} library crops)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
