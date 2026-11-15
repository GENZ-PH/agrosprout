// NASA satellite and model side files for demo farms, written by the pipeline (pipeline/fetch_imerg.py,
// fetch_smap.py, fetch_appeears.py, fetch_fldas.py). Bundled, read only by the "Satellite checks"
// card; they do not feed the engine. A file that has not been produced yet is simply absent (null).
import ecostress1 from "../../assets/data/demo/lanao-norte-demo-1-ecostress.json";
import fldas1 from "../../assets/data/demo/lanao-norte-demo-1-fldas.json";
import hls1 from "../../assets/data/demo/lanao-norte-demo-1-hls.json";
import imerg1 from "../../assets/data/demo/lanao-norte-demo-1-imerg.json";
import ndvi1 from "../../assets/data/demo/lanao-norte-demo-1-ndvi.json";
import smap1 from "../../assets/data/demo/lanao-norte-demo-1-smap.json";

type Stat = { mean: number | null; p20: number | null; p80: number | null; n: number };
/** p20, p50 and p80 across years for one calendar month, as the AppEEARS and FLDAS files write it. */
export type MonthPct = { month: number; p20: number | null; p50: number | null; p80: number | null; n_years: number; n_samples?: number };

export interface ImergFile {
  period: string;
  monthly: { month: number; p20_mm: number | null; p50_mm: number | null; p80_mm: number | null; n_years: number }[];
  power_compare: {
    power: { period: string };
    monthly: { month: number; power_p20_mm: number | null; power_p50_mm: number | null; power_p80_mm: number | null }[];
  };
}
export interface SmapFile {
  period: string;
  monthly: { month: number; surface_m3m3: Stat; rootzone_m3m3: Stat }[];
}
/** MODIS MOD13Q1 or HLS NDVI (pipeline/fetch_appeears.py). */
export interface NdviFile {
  period: string;
  sampling: { valid_samples: number };
  monthly: MonthPct[];
}
/** ECOSTRESS ESI and daily ET (pipeline/fetch_appeears.py). */
export interface EcostressFile {
  esi: { period: string; valid_samples: number; monthly: MonthPct[] };
  et_daily: { period: string; valid_samples: number; monthly: MonthPct[] };
}
/** FLDAS Noah monthly model output (pipeline/fetch_fldas.py). */
export interface FldasFile {
  period: string;
  monthly: {
    soil_moisture_0_10cm_m3m3: MonthPct[];
    evapotranspiration_mm: MonthPct[];
    rainfall_mm: MonthPct[];
    total_runoff_mm: MonthPct[];
  };
}

export interface SatelliteFiles {
  imerg: ImergFile | null;
  smap: SmapFile | null;
  ndvi: NdviFile | null;
  hls: NdviFile | null;
  ecostress: EcostressFile | null;
  fldas: FldasFile | null;
}

export const SATELLITE: Record<string, SatelliteFiles> = {
  "lanao-norte-demo-1": {
    imerg: imerg1 as ImergFile,
    smap: smap1 as SmapFile,
    ndvi: ndvi1 as NdviFile,
    hls: hls1 as NdviFile,
    ecostress: ecostress1 as EcostressFile,
    fldas: fldas1 as FldasFile,
  },
};
