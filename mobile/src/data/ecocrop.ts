// FAO Ecocrop crop names (#152), bundled so the S2 crop search works offline. Names only: crops found only here
// are saved as `other:<name>` and not scored. Data © FAO, via OpenCLIM/ecocrop; built by pipeline/build_ecocrop_names.py.
import raw from "../../assets/data/ecocrop-names.json";
import type { EcocropNames } from "../types";

/** Set to false to drop the Ecocrop names: the search then finds our crop list only, plus the "Add" row. */
export const ECOCROP_SEARCH_ENABLED = true;

export const ECOCROP_NAMES: EcocropNames | null = ECOCROP_SEARCH_ENABLED ? (raw as EcocropNames) : null;
