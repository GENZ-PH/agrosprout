import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { fetchCropPhoto, type CropPhoto } from "./crop-photo-core";

// Run-time side of the crop pictures from Wikipedia and Wikimedia Commons (#169, rule 8: only a crop
// name leaves the phone). Looked up once per crop, saved on the phone (also "no picture found", for a
// week), one request at a time with a pause between, because Wikimedia limits fast callers (HTTP 429).
// Offline or any error: no picture, and the app shows the placeholder.

const CACHE_PREFIX = "crop-photo:";
const MISS_DAYS = 7;
const GAP_MS = 1000;
// Browsers can't set User-Agent, so the web build sends none (Wikimedia asks for Api-User-Agent there; leave it out to avoid a preflight).
const HEADERS: Record<string, string> =
  Platform.OS === "web"
    ? {}
    : {
        "User-Agent": "AgroSprout/1.0 (https://github.com/GENZ-PH/agrosprout)",
      };

type Saved = { photo: CropPhoto | null; at: number };

let queue: Promise<unknown> = Promise.resolve();
const memory = new Map<string, CropPhoto | null>();

// After HTTP 429 Wikimedia asks callers to wait (Retry-After, else at least 5 seconds): nothing is sent before then.
let pausedUntil = 0;

async function getJson(url: string): Promise<unknown> {
  const wait = pausedUntil - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429) {
    const secs = Number(res.headers.get("retry-after"));
    pausedUntil = Date.now() + Math.max(5, Number.isFinite(secs) ? secs : 0) * 1000;
  }
  if (res.status === 404) return null; // no page for this name
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function load(sci: string): Promise<CropPhoto | null> {
  if (memory.has(sci)) return memory.get(sci) ?? null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + sci);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      const fresh =
        saved.photo !== null || Date.now() - saved.at < MISS_DAYS * 86_400_000;
      if (fresh) {
        memory.set(sci, saved.photo);
        return saved.photo;
      }
    }
  } catch {
    // unreadable cache: look it up again
  }
  const photo = await fetchCropPhoto(sci, getJson); // throws on a network error: not saved, tried again next time
  memory.set(sci, photo);
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + sci,
      JSON.stringify({ photo, at: Date.now() } satisfies Saved),
    );
  } catch {
    // not saved: looked up again next time
  }
  return sci ? photo : null;
}

/** Picture and credit for a scientific name, or null while loading, offline, or when none is found. */
export function useCropPhoto(sci: string | null): CropPhoto | null {
  const [photo, setPhoto] = useState<CropPhoto | null>(
    sci ? (memory.get(sci) ?? null) : null,
  );
  useEffect(() => {
    if (!sci) return;
    let cancelled = false;
    const run = queue.then(async () => {
      const cached = memory.has(sci);
      try {
        const p = await load(sci);
        if (!cancelled) setPhoto(p);
      } catch {
        if (!cancelled) setPhoto(null);
      }
      if (!cached) await new Promise((r) => setTimeout(r, GAP_MS));
    });
    queue = run.catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sci]);
  return sci ? photo : null;
}
