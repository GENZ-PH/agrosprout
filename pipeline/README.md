# pipeline/

Python 3.11+, standard library only. Prepares data the app bundles in `mobile/assets/data/`.
Never commit credentials or `pipeline/raw/` (the cache of downloaded files).

| Script | Output | Issue |
|---|---|---|
| `build_demo.py` | `mobile/assets/data/demo/<farm>.json` (daily NASA POWER 2001–2025 → monthly, climatology, trends, ET₀) | #8 |
| `fetch_srtm.py` | elevation and slope for each demo farm point, used by `build_demo.py` (NASA SRTM v3 via Open Topo Data, cached in `pipeline/raw/`) | #9 |
| `fetch_psa.py` | `mobile/assets/data/psa/yields.json` | #10 |
| `fetch_oni.py` | `mobile/assets/data/context.json` | #10 |
| `build_ecocrop_names.py` | `mobile/assets/data/ecocrop-names.json` (FAO Ecocrop crop names for the S2 search, from the pinned OpenCLIM/ecocrop CSV, cached in `pipeline/raw/`; `--offline` uses the cache only). Add a `MAPPING` row for every new `crops.json` crop, or `test_ecocrop_names.py` fails | #152 |
| `build_land_water.py` | `mobile/assets/data/land-water-ph.json` (Natural Earth 1:10m land, minor islands and lakes, release v5.1.2, cut to the Philippines for the "looks like water" warning on a lot; cached in `pipeline/raw/`; `--offline` uses the cache) |
| `make_et0_fixture.py` | `fixtures/et0_shared_cases.json`, checked by the Python and TypeScript ET₀ tests | #57 |
| `check_et0_methods.py` | prints how far the app's monthly-mean ET₀ is from summing daily ET₀ at three sites (needs network on the first run; not a test) | #57 |

## Re-run the demo farm

```
python3 pipeline/build_demo.py            # downloads once, then uses pipeline/raw/
python3 pipeline/build_demo.py --offline  # cache only
```

Farms are listed in `demo_farms.json`. **D1 (demo coordinates) is still open**: the one point there (8.0°N, 123.8°E) is provisional. It is a flat lowland spot
(SRTM about 35 m, 2% slope) in the west Lanao del Norte NASA POWER cell, picked because the earlier Iligan point (8.23°N, 124.24°E) lies in a cell
POWER reports at about 742 m, which made rice read cool (`docs/03`). Replace it with a real lowland paddy lot, add the upland lot, then re-run.
Elevation and slope come from SRTM automatically (`--no-srtm` skips it, and then ET₀ uses sea level and says so). A value written in `demo_farms.json` (`elevation_m`, `slope_pct`) wins over SRTM.

## Tests

```
python3 -m unittest discover -s pipeline
```
