# pipeline/

Python 3.11+, standard library only. Prepares data the app bundles in `mobile/assets/data/`.
Never commit credentials or `pipeline/raw/` (the cache of downloaded files).

| Script | Output | Issue |
|---|---|---|
| `build_demo.py` | `mobile/assets/data/demo/<farm>.json` (daily NASA POWER 2001–2025 → monthly, climatology, trends, ET₀) | #8 |
| `fetch_srtm.py` | elevation and slope for each demo farm point, used by `build_demo.py` (NASA SRTM v3 via Open Topo Data, cached in `pipeline/raw/`) | #9 |
| `fetch_ndvi.py` | `mobile/assets/data/demo/lanao-norte-demo-1-ndvi.json` (NASA MODIS MOD13Q1 v061 NDVI per calendar month for the two demo lots, cached in `pipeline/raw/ndvi/`) | |
| `fetch_imerg.py` | `mobile/assets/data/demo/lanao-norte-demo-1-imerg.json` (NASA GPM IMERG Final monthly V07 rain p20/p50/p80 per calendar month, beside NASA POWER; cached in `pipeline/raw/imerg/`) | |
| `fetch_smap.py` | `mobile/assets/data/demo/lanao-norte-demo-1-smap.json` (NASA SMAP L4 SPL4SMGP v8 surface and root-zone soil moisture per calendar month, beside POWER GWETROOT; cached in `pipeline/raw/smap/`) | |
| `earthdata.py` | shared NASA Earthdata Login bearer-token GET for the two scripts above | |
| `fetch_psa.py` | `mobile/assets/data/psa/yields.json` | #10 |
| `fetch_oni.py` | `mobile/assets/data/context.json` | #10 |
| `make_et0_fixture.py` | `fixtures/et0_shared_cases.json`, checked by the Python and TypeScript ET₀ tests | #57 |

## Re-run the demo farm

```
python3 pipeline/build_demo.py            # downloads once, then uses pipeline/raw/
python3 pipeline/build_demo.py --offline  # cache only
```

Farms are listed in `demo_farms.json`. **D1 (demo coordinates) is still open**: the one point there (8.0°N, 123.8°E) is provisional. It is a flat lowland spot
(SRTM about 35 m, 2% slope) in the west Lanao del Norte NASA POWER cell, picked because the earlier Iligan point (8.23°N, 124.24°E) lies in a cell
POWER reports at about 742 m, which made rice read cool (`docs/03`). Replace it with a real lowland paddy lot, add the upland lot, then re-run.
Elevation and slope come from SRTM automatically (`--no-srtm` skips it, and then ET₀ uses sea level and says so). A value written in `demo_farms.json` (`elevation_m`, `slope_pct`) wins over SRTM.

## Vegetation greenness (NDVI) for the demo lots

```
python3 pipeline/fetch_ndvi.py            # downloads once (about 1.5 hours, see below), then uses pipeline/raw/ndvi/
python3 pipeline/fetch_ndvi.py --offline  # cache only
```

Source: NASA MODIS/Terra MOD13Q1 v061 (Didan 2021, https://doi.org/10.5067/MODIS/MOD13Q1.061), band
`250m_16_days_NDVI`, via the ORNL DAAC MODIS/VIIRS Land Product Subsets REST API (no login,
https://modis.ornl.gov/data/modis_webservice.html). Only composites with pixel reliability 0 (good) or 1 (marginal)
are used (MOD13 User Guide V6.1, Table 4); values are scaled by 0.0001. For each calendar month of the composite start
date, 2001-2025, the file gives the median, 20th and 80th percentile, the count used (`n`) and the share dropped as
cloudy or missing (`dropped_share`). The lot centroids are computed like `square()` in `mobile/src/state/demo-farm.ts`.

The API returns at most 10 dates per request, and each request took 45-50 s on 2026-11-14 (two at once failed with a
502), so the script asks one request at a time for a window that holds every lot's pixel, and checks the values against
a single-pixel request per lot. If it stops, run it again: it resumes from the cache.

## Tests

```
python3 -m unittest discover -s pipeline
```

## NASA Earthdata datasets (IMERG rain, SMAP soil moisture)

Both scripts need a NASA Earthdata Login token. It is read at run time from `EARTHDATA_TOKEN`, or from
`~/infrastructure/.secrets/earthdata-token.txt` (`EARTHDATA_TOKEN_FILE` changes the path). It is sent only to
`*.nasa.gov` hosts, and never written to the repo, the cache or the output. Both read one small cell block per
file through NASA Earthdata cloud OPeNDAP (`opendap.earthdata.nasa.gov`, DAP4 CSV), with the file list from the
public CMR search, one request at a time, and cache every answer in `pipeline/raw/` so a re-run makes no call.

```
python3 pipeline/fetch_imerg.py            # GPM_3IMERGM v07, 2001-01 to the last month CMR lists (2025-09 on 2026-11-14)
python3 pipeline/fetch_smap.py             # SPL4SMGP v8, 2015-04 to 2025-12, 774 small requests (about 35 min once)
python3 pipeline/fetch_imerg.py --offline  # cache only (same for fetch_smap.py)
```

- **IMERG** (`fetch_imerg.py`): `precipitation` is an average rate over the calendar month in mm/hr (file
  attributes and the IMERG Technical Documentation, Table 2), so mm per month = rate x 24 x days in the month.
  The demo point 8.0 N 123.8 E is on the corner of 4 IMERG cells; each month is their mean, and the spread between
  the cells is written to `grid_cell`. Output: p20/p50/p80 across years per calendar month, n years, and a
  `power_compare` block that copies the POWER `monthly.precip_mm` percentiles from the demo file and gives
  IMERG minus POWER. GES DISC files need the Earthdata account to have approved the app "NASA GESDISC DATA
  ARCHIVE" and its EULA: without it the archive answers HTTP 403 "EULA Acceptance Failure" and the script stops
  with that message.
- **SMAP** (`fetch_smap.py`): one 3-hourly granule (03:00-06:00 UTC) on days 1, 6, 11, 16, 21, 26 of each month;
  monthly mean of those samples (at least 4 of 6), then mean, p20 and p80 across years per calendar month, for
  surface (0-5 cm) and root zone (0-100 cm) soil moisture in m3/m3. `power_compare` holds POWER GWETROOT from the
  demo file, labelled as a different quantity (degree of saturation, 0-1, not m3/m3).
