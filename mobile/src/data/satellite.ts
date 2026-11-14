// NASA satellite side files for demo farms, written by the pipeline (pipeline/fetch_imerg.py,
// fetch_smap.py). Bundled, read only by the "Satellite checks" card; they do not
// feed the engine. A file that has not been produced yet is simply absent (null).
import imerg1 from "../../assets/data/demo/lanao-norte-demo-1-imerg.json";
import smap1 from "../../assets/data/demo/lanao-norte-demo-1-smap.json";

type Stat = { mean: number | null; p20: number | null; p80: number | null; n: number };

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
export interface NdviFile {
  period: string;
  monthly: Record<string, { month: number; median: number | null; p20: number | null; p80: number | null; n: number }[]>;
}

export const SATELLITE: Record<string, { imerg: ImergFile | null; smap: SmapFile | null; ndvi: NdviFile | null }> = {
  "lanao-norte-demo-1": { imerg: imerg1 as ImergFile, smap: smap1 as SmapFile, ndvi: null },
};
