# pipeline/

Python 3.11+, standard library only. Prepares data the app bundles in `mobile/assets/data/`.
Never commit credentials or `pipeline/raw/` (the cache of downloaded files).

| Script | Output | Issue |
|---|---|---|
| `build_demo.py` | `mobile/assets/data/demo/<farm>.json` (daily NASA POWER 2001–2025 → monthly, climatology, trends, ET₀) | #8 |
| `fetch_srtm.py` | elevation and slope for each demo farm point, used by `build_demo.py` (NASA SRTM v3 via Open Topo Data, cached in `pipeline/raw/`) | #9 |
| `fetch_psa.py` | `mobile/assets/data/psa/yields.json` | #10 |
| `fetch_oni.py` | `mobile/assets/data/context.json` | #10 |
| `make_et0_fixture.py` | `fixtures/et0_shared_cases.json`, checked by the Python and TypeScript ET₀ tests | #57 |

## Re-run the demo farm

```
python3 pipeline/build_demo.py            # downloads once, then uses pipeline/raw/
python3 pipeline/build_demo.py --offline  # cache only
```

Farms are listed in `demo_farms.json`. **D1 (demo coordinates) is still open**: the one point there is the
NASA POWER reference point from `docs/03` and is provisional. Add or replace farms there, then re-run.
Elevation and slope come from SRTM automatically (`--no-srtm` skips it, and then ET₀ uses sea level and says so). A value written in `demo_farms.json` (`elevation_m`, `slope_pct`) wins over SRTM.

## Tests

```
python3 -m unittest discover -s pipeline
```
