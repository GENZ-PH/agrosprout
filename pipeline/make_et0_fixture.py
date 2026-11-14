"""Writes pipeline/fixtures/et0_shared_cases.json (#57).

The cases are checked by BOTH pipeline/test_et0.py and mobile/src/data/et0.test.ts, so the
Python and TypeScript ET0 code cannot drift apart without a test failing. Inputs are made up
with a fixed seed (synthetic, not measured data); the expected values come from pipeline/et0.py.
Re-run only when the ET0 method is changed on purpose, then check the TypeScript still agrees:

    python3 pipeline/make_et0_fixture.py
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import et0

OUT = Path(__file__).parent / "fixtures" / "et0_shared_cases.json"


def series(rng: random.Random, lo: float, hi: float) -> list[float]:
    return [round(rng.uniform(lo, hi), 2) for _ in range(12)]


def case(name: str, rng: random.Random, lat: float, elev: float | None, missing: int | None = None) -> dict:
    inp = {
        "tmax_c": series(rng, 28, 34),
        "tmin_c": series(rng, 19, 24),
        "rh_mean_pct": series(rng, 70, 88),
        "wind_ms_2m": series(rng, 0.8, 3.0),
        "rs_mj_m2_day": series(rng, 12, 22),
    }
    if missing is not None:
        inp["rh_mean_pct"][missing] = None
    r = et0.monthly_et0(**inp, lat_deg=lat, elev_m=elev)
    return {
        "name": name,
        "inputs": {**inp, "lat_deg": lat, "elev_m": elev},
        "expected": {
            "et0_mm_day": r.et0_mm_day,
            "et0_mm_month": r.et0_mm_month,
            "elevation_assumed": r.elevation_assumed,
        },
    }


def main() -> None:
    rng = random.Random(57)
    cases = [
        case("lowland, elevation known", rng, 8.23, 6),
        case("elevation unknown (sea level assumed)", rng, 8.23, None),
        case("highland 742 m", rng, 8.23, 742),
        case("southern hemisphere", rng, -6.2, 15),
        case("one input missing in June", rng, 8.23, 6, missing=5),
    ]
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"tolerance_mm_day": 1e-9, "cases": cases}, indent=1) + "\n")
    print(f"wrote {OUT} ({len(cases)} cases)")


if __name__ == "__main__":
    main()
