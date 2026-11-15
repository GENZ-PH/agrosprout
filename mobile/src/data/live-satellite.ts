// Live NASA satellite and model checks for a drawn lot (2026-11-15). The app asks our API Worker,
// which holds the NASA Earthdata credentials as secrets (never in the app) and calls NASA for the
// lot's centre rounded to 0.1 degree (CLAUDE.md rule 8: the same rounded point NASA POWER gets).
// Each answer is saved with the query cache, so a lot is fetched once. These are checks set beside
// the NASA POWER numbers; they do not feed the scores.
import { useQuery } from "@tanstack/react-query";

import { API_URL } from "../api/client";
import { fetchWithTimeout } from "../net/fetch";
import { STALE } from "../state/query-client";
import type { LotData } from "../types";
import type { EcostressFile, FldasFile, ImergFile, NdviFile, SatelliteFiles, SmapFile } from "./satellite";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const round1 = (v: number) => Math.round(v * 10) / 10;

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, init, 90_000);
  const body = (await res.json()) as Envelope<T>;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

type ImergLive = Omit<ImergFile, "power_compare">;
export type SrtmLive = { elevation_m: number | null; slope_deg: number | null };
type AppeearsLive = { status: "pending"; progress?: unknown } | { status: "done"; ndvi: NdviFile | null; hls: NdviFile | null; ecostress: EcostressFile | null };

/** IMERG beside this lot's NASA POWER rain (the same p20/p50/p80 the results use). */
function withPower(imerg: ImergLive, data: LotData): ImergFile {
  const p = data.monthly.precip_mm;
  return {
    ...imerg,
    power_compare: {
      power: { period: data.period },
      monthly: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        power_p20_mm: p.p20[i] ?? null,
        power_p50_mm: p.p50[i] ?? null,
        power_p80_mm: p.p80[i] ?? null,
      })),
    },
  };
}

export interface LiveSatellite {
  files: SatelliteFiles;
  srtm: SrtmLive | null;
  /** Products still on their way, in plain words, e.g. "MODIS, HLS and ECOSTRESS (a few minutes)". */
  waiting: string[];
  failed: string[];
}

export function useLiveSatellite(data: LotData | undefined): LiveSatellite | null {
  const live = data?.kind === "live";
  const lat = data ? round1(data.lat) : 0;
  const lon = data ? round1(data.lon) : 0;
  const q = `lat=${lat}&lon=${lon}`;
  const opts = { enabled: live, staleTime: STALE.FOREVER, gcTime: 30 * STALE.DAY, retry: 1 } as const;
  const imerg = useQuery({ queryKey: ["nasa", "imerg", lat, lon], queryFn: () => getJson<ImergLive>(`/v1/nasa/imerg?${q}`), ...opts });
  const smap = useQuery({ queryKey: ["nasa", "smap", lat, lon], queryFn: () => getJson<SmapFile>(`/v1/nasa/smap?${q}`), ...opts });
  const fldas = useQuery({ queryKey: ["nasa", "fldas", lat, lon], queryFn: () => getJson<FldasFile>(`/v1/nasa/fldas?${q}`), ...opts });
  const srtm = useQuery({ queryKey: ["nasa", "srtm", lat, lon], queryFn: () => getJson<SrtmLive>(`/v1/nasa/srtm?${q}`), ...opts });
  // AppEEARS works in the background on NASA's side: submit once, then ask every 30 s until done.
  const task = useQuery({
    queryKey: ["nasa", "appeears-task", lat, lon],
    queryFn: () =>
      getJson<{ task_id: string }>(`/v1/nasa/appeears`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat, lon }),
      }),
    ...opts,
  });
  const taskId = task.data?.task_id;
  const appeears = useQuery({
    queryKey: ["nasa", "appeears", taskId],
    queryFn: () => getJson<AppeearsLive>(`/v1/nasa/appeears/${encodeURIComponent(taskId ?? "")}`),
    enabled: live && !!taskId,
    staleTime: STALE.FOREVER,
    gcTime: 30 * STALE.DAY,
    retry: 1,
    refetchInterval: (query) => (query.state.data?.status === "done" ? false : 30_000),
  });
  if (!live || !data) return null;
  const done = appeears.data?.status === "done" ? appeears.data : null;
  const waiting: string[] = [];
  const failed: string[] = [];
  const track = (name: string, s: { isPending: boolean; isError: boolean }) => {
    if (s.isError) failed.push(name);
    else if (s.isPending) waiting.push(name);
  };
  track("GPM IMERG rain", imerg);
  track("SMAP soil moisture", smap);
  track("FLDAS land model", fldas);
  track("SRTM elevation", srtm);
  if (task.isError || appeears.isError) failed.push("MODIS, HLS and ECOSTRESS");
  else if (!done) waiting.push("MODIS, HLS and ECOSTRESS (NASA AppEEARS, a few minutes)");
  return {
    files: {
      imerg: imerg.data ? withPower(imerg.data, data) : null,
      smap: smap.data ?? null,
      fldas: fldas.data ?? null,
      ndvi: done?.ndvi ?? null,
      hls: done?.hls ?? null,
      ecostress: done?.ecostress ?? null,
    },
    srtm: srtm.data ?? null,
    waiting,
    failed,
  };
}
