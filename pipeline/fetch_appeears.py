"""NASA AppEEARS point samples (MODIS NDVI, HLS NDVI, ECOSTRESS ESI/ET) by calendar month for the demo farm.

    python3 pipeline/fetch_appeears.py            # submit (or resume) the task, poll, download, build
    python3 pipeline/fetch_appeears.py --submit-only
    python3 pipeline/fetch_appeears.py --offline  # build from pipeline/raw/appeears/*.csv only

Outputs (only for products whose CSV is present):
    mobile/assets/data/demo/lanao-norte-demo-1-ndvi.json       MOD13Q1 v061 NDVI
    mobile/assets/data/demo/lanao-norte-demo-1-hls.json        HLSL30/HLSS30 v2.0 VI NDVI + Fmask
    mobile/assets/data/demo/lanao-norte-demo-1-ecostress.json  ECO_L4T_ESI v002 ESI, ECO_L3T_JET v002 ETdaily

Service: NASA AppEEARS API (https://appeears.earthdatacloud.nasa.gov/api/), one point task for
(8.0 N, 123.8 E). Product names, layers, units, scale, fill and valid ranges were read from the
public /product and /product/<id> endpoints on 2026-11-14:
    MOD13Q1.061  _250m_16_days_NDVI (scale 0.0001, fill -3000, valid -0.2..1),
                 _250m_16_days_pixel_reliability (QA, 0..3, fill -1),
                 _250m_16_days_composite_day_of_the_year (1..366). 250 m, 16-day. DOI 10.5067/MODIS/MOD13Q1.061
    HLSL30_VI.020 / HLSS30_VI.020  NDVI (scale 0.0001, fill -19999, valid -1..1). 30 m.
                 These VI products carry no Fmask layer in AppEEARS, so Fmask is requested from the
                 reflectance products HLSL30.020 / HLSS30.020 and joined on date.
                 DOIs 10.5067/HLS/HLSL30_VI.002, 10.5067/HLS/HLSS30_VI.002
    ECO_L4T_ESI.002  ESI (ratio, valid 0..1, fill NaN), cloud (1 = cloud), water (1 = water). 70 m.
                 DOI 10.5067/ECOSTRESS/ECO_L4T_ESI.002
    ECO_L3T_JET.002  ETdaily (mm/day per the ECOSTRESS Grid/Tile User Guide V2 text; its Table 10 and AppEEARS say W m-2), cloud, water. 70 m.
                 DOI 10.5067/ECOSTRESS/ECO_L3T_JET.002
AppEEARS point tasks take one date range for all layers, so the task asks for 2001-01-01 to
2026-10-31 and each product is clipped to its own period when building (MODIS: 2001-2025).

QA rules (simple, written into each output):
    MODIS: keep a composite only if pixel_reliability == 0 ("good data"); 1 marginal, 2 snow/ice,
           3 cloudy and -1 fill are dropped. Month = month of the composite day of the year
           (the actual pixel date inside the 16-day window), not the window start.
    HLS:   keep an observation only if Fmask bits 1 (cloud), 2 (adjacent to cloud/shadow),
           3 (cloud shadow) and 4 (snow/ice) are all 0 and NDVI is within -1..1. Water (bit 5) is kept
           because a flooded paddy is a real field state.
    ECOSTRESS: keep a value only if cloud == 0, water == 0 and the value is finite (ESI within 0..1,
           ETdaily >= 0).

Statistics: valid samples are averaged per year-month; per calendar month we report p20, p50, p80
(linear-interpolated, aggregate.percentile) across years of those monthly means, the number of
years (n_years) and the number of valid samples (n_samples). Low-NDVI months (MODIS and HLS):
a calendar month is listed when its p50 NDVI is below LOW_NDVI (0.4); the rule is stated in the file.

Credentials: AppEEARS /login takes HTTP Basic with the Earthdata Login user and password, read at
run time from the netrc at EARTHDATA_NETRC (default ~/infrastructure/.secrets/earthdata.netrc,
machine urs.earthdata.nasa.gov). The returned AppEEARS token lives in memory only; it is sent as a
bearer header only to *.nasa.gov (earthdata._Redirect drops it on redirect to S3). Only the task id
is cached (pipeline/raw/appeears/task.json). Standard library only.
"""
from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import io
import json
import math
import netrc
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable, Optional

sys.path.insert(0, str(Path(__file__).parent))
import earthdata  # noqa: E402
from aggregate import percentile  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(__file__).parent / "raw" / "appeears"
TASK_FILE = RAW_DIR / "task.json"
OUT_DIR = ROOT / "mobile" / "assets" / "data" / "demo"
API = "https://appeears.earthdatacloud.nasa.gov/api"
DEFAULT_NETRC = Path.home() / "infrastructure" / ".secrets" / "earthdata.netrc"
EDL_HOST = "urs.earthdata.nasa.gov"

FARM_ID = "lanao-norte-demo-1"
LAT, LON = 8.0, 123.8
TASK_NAME = "agrosprout-lanao-norte-demo-1-v1"
TASK_START, TASK_END = "01-01-2001", "10-31-2026"   # AppEEARS wants MM-DD-YYYY
POLL_S = 120
LOW_NDVI = 0.4

LAYERS = [
    ("MOD13Q1.061", "_250m_16_days_NDVI"),
    ("MOD13Q1.061", "_250m_16_days_pixel_reliability"),
    ("MOD13Q1.061", "_250m_16_days_composite_day_of_the_year"),
    ("HLSL30_VI.020", "NDVI"),
    ("HLSS30_VI.020", "NDVI"),
    ("HLSL30.020", "Fmask"),
    ("HLSS30.020", "Fmask"),
    ("ECO_L4T_ESI.002", "ESI"),
    ("ECO_L4T_ESI.002", "cloud"),
    ("ECO_L4T_ESI.002", "water"),
    ("ECO_L3T_JET.002", "ETdaily"),
    ("ECO_L3T_JET.002", "cloud"),
    ("ECO_L3T_JET.002", "water"),
]

# HLS v2.0 Fmask bits (HLS v2.0 User Guide, Table 9): 0 cirrus (reserved), 1 cloud,
# 2 adjacent to cloud/shadow, 3 cloud shadow, 4 snow/ice, 5 water, 6-7 aerosol level.
FMASK_DROP_BITS = (1, 2, 3, 4)


class AppeearsError(RuntimeError):
    """A request failed. The message never holds a credential."""


# ---------------------------------------------------------------- network

def _edl_basic() -> str:
    path = Path(os.environ.get("EARTHDATA_NETRC", str(DEFAULT_NETRC)))
    try:
        auth = netrc.netrc(str(path)).authenticators(EDL_HOST)
    except (OSError, netrc.NetrcParseError) as e:
        raise AppeearsError(f"cannot read netrc at {path}") from e
    if not auth or not auth[0] or not auth[2]:  # message names the file, never its content
        raise AppeearsError(f"no {EDL_HOST} entry in {path}")
    return base64.b64encode(f"{auth[0]}:{auth[2]}".encode()).decode()


def _request(url: str, *, method: str = "GET", headers: Optional[dict] = None, body: Optional[bytes] = None,
             timeout_s: float = 300) -> bytes:
    h = {"User-Agent": earthdata.USER_AGENT, **(headers or {})}
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with earthdata._opener.open(req, timeout=timeout_s) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        msg = e.read()[:300].decode("utf-8", "replace")
        raise AppeearsError(f"HTTP {e.code} for {method} {url}: {msg}") from None
    except urllib.error.URLError as e:
        raise AppeearsError(f"network error for {url}: {e.reason}") from None


def login() -> str:
    """AppEEARS /login needs the EDL username + password (it does not take an EDL user token; tested
    2026-11-14, 403). A 401 here means the password in the netrc is wrong or expired."""
    data = json.loads(_request(f"{API}/login", method="POST",
                               headers={"Authorization": "Basic " + _edl_basic(), "Content-Length": "0"}, body=b""))
    return data["token"]


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def task_request() -> dict:
    return {
        "task_type": "point",
        "task_name": TASK_NAME,
        "params": {
            "dates": [{"startDate": TASK_START, "endDate": TASK_END}],
            "layers": [{"product": p, "layer": l} for p, l in LAYERS],
            "coordinates": [{"id": FARM_ID, "category": "demo", "latitude": LAT, "longitude": LON}],
        },
    }


def submit(tok: str) -> str:
    body = json.dumps(task_request()).encode()
    data = json.loads(_request(f"{API}/task", method="POST",
                               headers={**_auth(tok), "Content-Type": "application/json"}, body=body))
    tid = data["task_id"]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    TASK_FILE.write_text(json.dumps({"task_id": tid, "submitted": dt.datetime.now(dt.timezone.utc).isoformat(),
                                     "request": task_request()}, indent=2) + "\n")
    return tid


def status(tok: str, tid: str) -> dict:
    return json.loads(_request(f"{API}/task/{tid}", headers=_auth(tok)))


def poll(tok: str, tid: str, every_s: int = POLL_S, max_h: float = 14.0) -> dict:
    t0 = time.monotonic()
    while True:
        st = status(tok, tid)
        print(f"  {dt.datetime.now():%H:%M:%S} task {tid}: {st.get('status')} {st.get('progress', '')}", flush=True)
        if st.get("status") in ("done", "error"):
            return st
        if time.monotonic() - t0 > max_h * 3600:
            raise AppeearsError(f"task {tid} still {st.get('status')} after {max_h} h")
        time.sleep(every_s)


def download(tok: str, tid: str) -> list[Path]:
    bundle = json.loads(_request(f"{API}/bundle/{tid}", headers=_auth(tok)))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    got = []
    for f in bundle.get("files", []):
        name = Path(f["file_name"]).name
        if not (name.endswith(".csv") or name.endswith(".json") or name.endswith(".txt")):
            continue
        dest = RAW_DIR / name
        if not dest.exists():
            dest.write_bytes(_request(f"{API}/bundle/{tid}/{f['file_id']}", headers=_auth(tok)))
        got.append(dest)
    return got


# ---------------------------------------------------------------- parsing + QA

def read_csv(path_or_text) -> list[dict[str, str]]:
    text = path_or_text.read_text() if isinstance(path_or_text, Path) else path_or_text
    return list(csv.DictReader(io.StringIO(text)))


def _norm(s: str) -> str:
    return s.replace("_", "-").replace(".", "-").upper()


def find_csv(product: str, raw: Path = RAW_DIR) -> Optional[Path]:
    """AppEEARS names point results <task-name>-<PRODUCT>-<VER>-results.csv (e.g. ...-MOD13Q1-061-results.csv).
    `product` is the AppEEARS id ("HLSL30_VI.020"); '_' and '.' are compared as '-'."""
    want = "-" + _norm(product) + "-RESULTS-CSV"
    hits = sorted(p for p in raw.glob("*.csv") if _norm(p.name).endswith(want))
    return hits[0] if hits else None


def col(row: dict, suffix: str) -> Optional[str]:
    """The value of the first column whose name ends with `suffix` (AppEEARS prefixes product_version_)."""
    for k, v in row.items():
        if k and k.endswith(suffix):
            return v
    return None


def num(v: Optional[str]) -> Optional[float]:
    if v is None or v.strip() == "":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return x if math.isfinite(x) else None


def scaled(v: Optional[float], scale: float, limit: float = 1.5) -> Optional[float]:
    """AppEEARS point CSVs normally hold scaled values (NDVI 0.81). If a raw integer (8100) slips
    through, apply the product's scale factor. Fill values end up outside the valid range either way."""
    if v is None:
        return None
    return v * scale if abs(v) > limit else v


def modis_samples(rows: Iterable[dict], start_year: int = 2001, end_year: int = 2025) -> tuple[list[tuple[dt.date, float]], int]:
    """(kept (pixel date, NDVI) samples, total composites seen) for MOD13Q1 rows. NDVI in the AppEEARS CSV
    is already scaled; values outside -0.2..1 (fill -3000 scaled or not) are dropped."""
    kept, total = [], 0
    for r in rows:
        start = dt.date.fromisoformat(r["Date"][:10])
        if not (start_year <= start.year <= end_year):
            continue
        total += 1
        ndvi, rel, doy = scaled(num(col(r, "_250m_16_days_NDVI")), 1e-4), num(col(r, "_250m_16_days_pixel_reliability")), \
            num(col(r, "_250m_16_days_composite_day_of_the_year"))
        if ndvi is None or rel != 0 or not (-0.2 <= ndvi <= 1.0):
            continue
        day = start
        if doy is not None and 1 <= doy <= 366:
            # the composite window can cross a year end: a DOY smaller than the start DOY is next year
            y = start.year + (1 if doy < start.timetuple().tm_yday else 0)
            day = dt.date(y, 1, 1) + dt.timedelta(days=int(doy) - 1)
        if start_year <= day.year <= end_year:
            kept.append((day, ndvi))
    return kept, total


def fmask_ok(v: Optional[float]) -> bool:
    if v is None or v < 0 or v > 255:
        return False
    m = int(v)
    return not any(m >> b & 1 for b in FMASK_DROP_BITS)


def hls_samples(vi_rows: Iterable[dict], fmask_rows: Iterable[dict]) -> tuple[list[tuple[dt.date, float]], int]:
    """Join one HLS VI CSV with its reflectance CSV (Fmask) on Date; keep clear observations."""
    fm: dict[str, Optional[float]] = {}
    for r in fmask_rows:
        fm[r["Date"][:10]] = num(col(r, "_Fmask"))
    kept, total = [], 0
    for r in vi_rows:
        d = r["Date"][:10]
        ndvi = scaled(num(col(r, "_NDVI")), 1e-4)
        if ndvi is None:
            continue
        total += 1
        if not fmask_ok(fm.get(d)) or not (-1.0 <= ndvi <= 1.0):
            continue
        kept.append((dt.date.fromisoformat(d), ndvi))
    return kept, total


def eco_samples(rows: Iterable[dict], layer: str, lo: float, hi: float) -> tuple[list[tuple[dt.date, float]], int]:
    kept, total = [], 0
    for r in rows:
        v = num(col(r, "_" + layer))
        if v is None:
            continue
        total += 1
        if num(col(r, "_cloud")) != 0 or num(col(r, "_water")) != 0 or not (lo <= v <= hi):
            continue
        kept.append((dt.date.fromisoformat(r["Date"][:10]), v))
    return kept, total


# ---------------------------------------------------------------- statistics

def year_month_means(samples: Iterable[tuple[dt.date, float]]) -> dict[tuple[int, int], tuple[float, int]]:
    by: dict[tuple[int, int], list[float]] = {}
    for d, v in samples:
        by.setdefault((d.year, d.month), []).append(v)
    return {k: (sum(vs) / len(vs), len(vs)) for k, vs in by.items()}


def climatology(samples: list[tuple[dt.date, float]], digits: int = 3) -> list[dict]:
    ym = year_month_means(samples)
    r = (lambda v: None if v is None else round(v, digits))
    out = []
    for m in range(1, 13):
        vals = [v for (_y, mo), (v, _n) in sorted(ym.items()) if mo == m]
        out.append({
            "month": m,
            "p20": r(percentile(vals, 0.2)),
            "p50": r(percentile(vals, 0.5)),
            "p80": r(percentile(vals, 0.8)),
            "n_years": len(vals),
            "n_samples": sum(n for (_y, mo), (_v, n) in ym.items() if mo == m),
        })
    return out


def low_months(monthly: list[dict], limit: float = LOW_NDVI) -> list[int]:
    return [e["month"] for e in monthly if e["p50"] is not None and e["p50"] < limit]


def covered(samples: list[tuple[dt.date, float]]) -> Optional[str]:
    if not samples:
        return None
    ds = sorted(d for d, _ in samples)
    return f"{ds[0].isoformat()} to {ds[-1].isoformat()}"


# ---------------------------------------------------------------- outputs

def build_ndvi(rows: list[dict], task_id: str, today: str) -> dict:
    kept, total = modis_samples(rows)
    monthly = climatology(kept)
    low = low_months(monthly)
    return {
        "id": FARM_ID,
        "product": "MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid (MOD13Q1)",
        "version": "Collection 6.1 (061)",
        "native_res": "250 m pixel, 16-day composite",
        "period": covered(kept),
        "point": {"lat": LAT, "lon": LON},
        "units": "NDVI (unitless, -0.2..1)",
        "sampling": {
            "composites_seen": total,
            "valid_samples": len(kept),
            "qa_rule": "keep a composite only if _250m_16_days_pixel_reliability == 0 (good data); marginal (1), snow/ice (2), cloudy (3) and fill (-1) are dropped",
            "month_rule": "each composite is assigned to the month of its composite day of the year (the pixel's own acquisition day)",
            "statistic": "mean of the valid samples in each year-month, then p20, p50, p80 across years per calendar month (linear-interpolated percentiles)",
        },
        "monthly": monthly,
        "low_ndvi_months": low,
        "low_ndvi_rule": f"calendar months whose p50 NDVI is below {LOW_NDVI}. A simple threshold for 'little green cover' (bare, flooded or just planted), not a crop calendar",
        "provenance": {
            "source": "NASA LP DAAC MOD13Q1 v061 (_250m_16_days_NDVI, _250m_16_days_pixel_reliability, _250m_16_days_composite_day_of_the_year)",
            "doi": "10.5067/MODIS/MOD13Q1.061",
            "native_res": "250 m, 16-day",
            "period": covered(kept),
            "access": f"NASA AppEEARS point task {task_id} ({API})",
            "retrieved": today,
            "note": "A 250 m pixel mixes this lot with its neighbours; small lots may differ.",
        },
    }


def build_hls(pairs: dict[str, tuple[list[dict], list[dict]]], task_id: str, today: str) -> dict:
    kept_all: list[tuple[dt.date, float]] = []
    per: dict[str, dict] = {}
    for name, (vi, fm) in pairs.items():
        kept, total = hls_samples(vi, fm)
        per[name] = {"observations_seen": total, "valid_samples": len(kept), "period": covered(kept)}
        kept_all += kept
    monthly = climatology(kept_all)
    return {
        "id": FARM_ID,
        "product": "Harmonized Landsat Sentinel-2 Vegetation Indices (HLSL30_VI, HLSS30_VI)",
        "version": "v2.0 (020)",
        "native_res": "30 m pixel, every Landsat 8/9 and Sentinel-2 overpass",
        "period": covered(kept_all),
        "point": {"lat": LAT, "lon": LON},
        "units": "NDVI (unitless, -1..1)",
        "sampling": {
            "per_product": per,
            "valid_samples": len(kept_all),
            "qa_rule": "keep an observation only if the HLS Fmask (from HLSL30.020 / HLSS30.020, joined on date) has bits 1 cloud, 2 adjacent cloud/shadow, 3 cloud shadow and 4 snow/ice all 0, and NDVI is within -1..1. Water (bit 5) is kept, since a flooded paddy is a real field state",
            "statistic": "Landsat and Sentinel-2 samples pooled; mean per year-month, then p20, p50, p80 across years per calendar month (linear-interpolated percentiles)",
        },
        "monthly": monthly,
        "low_ndvi_months": low_months(monthly),
        "low_ndvi_rule": f"calendar months whose p50 NDVI is below {LOW_NDVI}. A simple threshold for 'little green cover' (bare, flooded or just planted), not a crop calendar",
        "provenance": {
            "source": "NASA LP DAAC HLSL30_VI v2.0 and HLSS30_VI v2.0 (NDVI), Fmask from HLSL30 v2.0 and HLSS30 v2.0",
            "doi": ["10.5067/HLS/HLSL30_VI.002", "10.5067/HLS/HLSS30_VI.002", "10.5067/HLS/HLSL30.002", "10.5067/HLS/HLSS30.002"],
            "native_res": "30 m, irregular revisit (about 2 to 3 days combined, fewer clear days)",
            "period": covered(kept_all),
            "access": f"NASA AppEEARS point task {task_id} ({API})",
            "retrieved": today,
            "note": "Early years have fewer overpasses (Sentinel-2 from late 2015, Landsat 9 from late 2021), so n_samples per month varies.",
        },
    }


def build_ecostress(esi_rows: Optional[list[dict]], jet_rows: Optional[list[dict]], jet_units: str,
                    task_id: str, today: str) -> dict:
    out: dict = {
        "id": FARM_ID,
        "product": "ECOSTRESS Tiled L4 Evaporative Stress Index PT-JPL (ECO_L4T_ESI) and L3 Evapotranspiration (ECO_L3T_JET)",
        "version": "002",
        "native_res": "70 m pixel, irregular ISS overpass times",
        "point": {"lat": LAT, "lon": LON},
        "qa_rule": "keep a value only if the product's own cloud layer == 0, water layer == 0 and the value is finite (ESI within 0..1, ETdaily >= 0)",
        "statistic": "mean of the valid samples in each year-month, then p20, p50, p80 across years per calendar month (linear-interpolated percentiles)",
        "provenance": [],
    }
    periods = []
    if esi_rows is not None:
        kept, total = eco_samples(esi_rows, "ESI", 0.0, 1.0)
        out["esi"] = {"units": "ratio (0 = high stress, 1 = no stress)", "period": covered(kept),
                      "observations_seen": total, "valid_samples": len(kept), "monthly": climatology(kept)}
        out["provenance"].append({"source": "NASA LP DAAC ECO_L4T_ESI v002 (ESI, cloud, water)",
                                  "doi": "10.5067/ECOSTRESS/ECO_L4T_ESI.002", "native_res": "70 m",
                                  "period": covered(kept), "access": f"NASA AppEEARS point task {task_id}",
                                  "retrieved": today})
        periods.append(covered(kept))
    if jet_rows is not None:
        kept, total = eco_samples(jet_rows, "ETdaily", 0.0, math.inf)
        out["et_daily"] = {"units": jet_units, "period": covered(kept),
                           "observations_seen": total, "valid_samples": len(kept), "monthly": climatology(kept, 2)}
        out["provenance"].append({"source": "NASA LP DAAC ECO_L3T_JET v002 (ETdaily, cloud, water)",
                                  "doi": "10.5067/ECOSTRESS/ECO_L3T_JET.002", "native_res": "70 m",
                                  "period": covered(kept), "access": f"NASA AppEEARS point task {task_id}",
                                  "retrieved": today})
    out["caveats"] = [
        "ECOSTRESS flies on the ISS, so overpass times vary and a month can have zero, one or many clear samples.",
        "ESI and ET are snapshots on clear-sky overpasses; cloudy (often rainy) days are missing, which biases the sample toward dry, sunny days.",
    ]
    return out


def build_all(raw: Path = RAW_DIR, today: Optional[str] = None) -> dict[str, dict]:
    today = today or dt.date.today().isoformat()
    task_id = json.loads((raw / "task.json").read_text())["task_id"] if (raw / "task.json").exists() else "unknown"
    out: dict[str, dict] = {}
    p = find_csv("MOD13Q1.061", raw)
    if p:
        out["ndvi"] = build_ndvi(read_csv(p), task_id, today)
    pairs = {}
    for vi, refl in (("HLSL30_VI.020", "HLSL30.020"), ("HLSS30_VI.020", "HLSS30.020")):
        pv, pr = find_csv(vi, raw), find_csv(refl, raw)
        if pv and pr:
            pairs[vi] = (read_csv(pv), read_csv(pr))
    if pairs:
        out["hls"] = build_hls(pairs, task_id, today)
    pe, pj = find_csv("ECO_L4T_ESI.002", raw), find_csv("ECO_L3T_JET.002", raw)
    if pe or pj:
        out["ecostress"] = build_ecostress(read_csv(pe) if pe else None, read_csv(pj) if pj else None,
                                           "mm/day, integrated from sunrise to sunset. Source: ECOSTRESS L1C-4 Grid/Tile User Guide V2, L3T JET section text ('a daily ET estimate in millimeters per day ... recorded in the L3T JET product as ETdaily'). The same guide's Table 10 and AppEEARS list W m-2; values of 1.7 to 4.6 only make sense as mm/day",
                                           task_id, today)
    return out


def write(outputs: dict[str, dict]) -> list[Path]:
    paths = []
    for key, data in outputs.items():
        path = OUT_DIR / f"{FARM_ID}-{key}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        paths.append(path)
    return paths


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true", help="build from pipeline/raw/appeears/ only")
    ap.add_argument("--submit-only", action="store_true")
    ap.add_argument("--poll-s", type=int, default=POLL_S)
    ap.add_argument("--write-request", action="store_true",
                    help="only write pipeline/raw/appeears/request.json (for upload in the AppEEARS web UI)")
    a = ap.parse_args()
    if a.write_request:
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        (RAW_DIR / "request.json").write_text(json.dumps(task_request(), indent=2) + "\n")
        print(f"wrote {(RAW_DIR / 'request.json').relative_to(ROOT)}")
        return
    if not a.offline:
        tok = login()
        tid = json.loads(TASK_FILE.read_text())["task_id"] if TASK_FILE.exists() else None
        if tid is None:
            tid = submit(tok)
            print(f"submitted task {tid}", flush=True)
        else:
            print(f"resuming task {tid}", flush=True)
        if a.submit_only:
            return
        st = poll(tok, tid, a.poll_s)
        if st.get("status") != "done":
            raise SystemExit(f"task {tid} ended with status {st.get('status')}: {st.get('error')}")
        for p in download(tok, tid):
            print(f"  downloaded {p.name}", flush=True)
    outs = build_all()
    if not outs:
        raise SystemExit(f"no AppEEARS result CSVs in {RAW_DIR.relative_to(ROOT)}; nothing written")
    for p in write(outs):
        print(f"wrote {p.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
