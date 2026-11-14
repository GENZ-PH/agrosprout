# pipeline/

Python 3.11+, standard library only. Prepares data the app bundles in `mobile/assets/data/`.
Never commit credentials or `pipeline/raw/` (the cache of downloaded files).

| Script | Output | Issue |
|---|---|---|
| `build_demo.py` | `mobile/assets/data/demo/<farm>.json` (daily NASA POWER 2001–2025 → monthly, climatology, trends, ET₀) | #8 |
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
Set `elevation_m` (and `slope_pct`) when the SRTM values from #9 exist; until then ET₀ uses sea level and says so.

## Tests

```
python3 -m unittest discover -s pipeline
```
