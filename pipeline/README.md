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

## NASA FLDAS soil moisture, ET, rainfall and runoff (`fetch_fldas.py`)

```
python3 pipeline/fetch_fldas.py            # Earthdata token needed once, then uses pipeline/raw/fldas/
python3 pipeline/fetch_fldas.py --offline  # cache only
```

Writes `mobile/assets/data/demo/lanao-norte-demo-1-fldas.json`. Product: FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 degree
(MERRA-2 and CHIRPS), `FLDAS_NOAH01_C_GL_M` v001, DOI 10.5067/5NHC22T9375G, domain 60S-90N global (the regional FLDAS runs were retired).
Variables `SoilMoi00_10cm_tavg`, `SoilMoi10_40cm_tavg` (m3/m3), `Evap_tavg`, `Rainf_f_tavg`, `Qs_tavg`, `Qsb_tavg` (kg m-2 s-1, converted to
mm per month as x 86400 x days in month). Same access path as `fetch_imerg.py` (Earthdata cloud OPeNDAP, DAP4 CSV, token from `earthdata.py`).
The point sits on a cell corner; the cells used and the ones dropped (water mask or zero rain forcing) are listed in `grid_cell`.
Output: p20/p50/p80 across years per calendar month for each variable, with `n_years`. Tests: `python3 -m unittest test_fldas` (synthetic fixture
`fixtures/fldas_noah01_c_gl_m_block.dap.csv`).

## AppEEARS: MODIS NDVI, HLS NDVI, ECOSTRESS ESI/ET (`fetch_appeears.py`)

One NASA AppEEARS point task for the demo point (8.0 N, 123.8 E) with layers from MOD13Q1.061
(NDVI, pixel reliability, composite day), HLSL30_VI.020 / HLSS30_VI.020 (NDVI) plus Fmask from
HLSL30.020 / HLSS30.020, ECO_L4T_ESI.002 (ESI, cloud, water) and ECO_L3T_JET.002 (ETdaily, cloud, water).
It writes `mobile/assets/data/demo/lanao-norte-demo-1-{ndvi,hls,ecostress}.json`, one file per product
whose result CSV exists, each with a provenance block, the QA rule, and `monthly` p20/p50/p80 with
`n_years` and `n_samples`.

```
python3 pipeline/fetch_appeears.py                 # submit or resume (task id in raw/appeears/task.json), poll, download, build
python3 pipeline/fetch_appeears.py --offline       # build from pipeline/raw/appeears/*-results.csv only
python3 pipeline/fetch_appeears.py --write-request # write raw/appeears/request.json for upload in the AppEEARS web UI
```

Login: AppEEARS `/login` needs the Earthdata Login username and password (HTTP Basic). They are read at run
time from the netrc at `EARTHDATA_NETRC` (default `~/.netrc`). The
EDL user token used by IMERG/SMAP is not accepted by AppEEARS (403). If the API login fails, upload
`request.json` in the AppEEARS web UI (Point Sample, "Copy a previous request" / upload JSON), download the
`*-results.csv` files into `pipeline/raw/appeears/`, and run `--offline`.
QA rules and the low-NDVI rule (p50 below 0.4) are in the module docstring and in each output file.
Tests: `cd pipeline && python3 -m unittest test_appeears` (hand-made fixtures in `fixtures/appeears/`, not NASA values).
