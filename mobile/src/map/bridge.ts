// Messages between the app screens (S1 lots, S6 places) and the map page
// (Leaflet + Terra Draw in map-src/), which runs in a WebView on Android and an
// <iframe> on web. Both sides import this file.
// Shared data contract: change by PR only (D22). See docs/06-architecture.md "Map WebView bridge".
// Keep this file free of React Native imports: the map page bundle imports it too.

import type { LonLat, Lot } from "../types";

/** A lot outline: one closed ring in GeoJSON order, same shape as `Lot.geometry`. */
export type LotPolygon = Lot["geometry"];

/** How the map reacts to touch. */
export type MapMode =
  /** One finger traces around the lot; two fingers move and zoom the map. */
  | "sketch"
  /** Tap each corner, then tap the first point to close. */
  | "corners"
  /** One finger moves the map. Tap a lot to show its points: drag a point, tap an edge dot to add one, long-press to remove one. */
  | "select"
  /** Tap once to drop a pin (S1 fallback, S6 places). */
  | "pin";

export interface MapLot {
  id: string;
  name: string;
  geometry: LotPolygon;
}

export interface MapPlace {
  id: string;
  name: string;
  point: LonLat;
}

/** Satellite basemap candidates for decision D25 (still open). */
export type BasemapId = "esri-world-imagery" | "eox-s2cloudless" | "osm";

/** App → map page. */
export type AppToMap =
  | {
      type: "init";
      lots: MapLot[];
      places: MapPlace[];
      mode: MapMode;
      /** The lot a new sketch or corners shape belongs to, or the lot to select. */
      activeLotId?: string;
      /** Where to look when there are no lots yet. */
      center?: LonLat;
      zoom?: number;
      basemap?: BasemapId;
    }
  | { type: "setMode"; mode: MapMode; activeLotId?: string }
  /** Replace all lots (after add, rename, delete, undo). The map keeps unchanged shapes as they are. */
  | { type: "setLots"; lots: MapLot[] }
  | { type: "setPlaces"; places: MapPlace[] }
  /** The phone's position from expo-location (works without signal). */
  | { type: "gps"; lat: number; lon: number; accuracy_m?: number }
  | { type: "fitLots" };

export type SketchRejectReason =
  /** The stroke was too short to be a lot outline. */
  | "too_short"
  /** The cleaned shape is smaller than the minimum lot area. */
  | "too_small";

/** How the sketch cleanup had to repair the shape. */
export type ShapeFix = "none" | "unkinked" | "hull";

/** Map page → app. */
export type MapToApp =
  | { type: "ready" }
  /** A lot was drawn or edited. Save it. */
  | { type: "lotChanged"; id: string; geojson: LotPolygon; area_ha: number; centroid: LonLat; fix: ShapeFix }
  /** Live area while a point is being dragged (not saved yet). */
  | { type: "lotEditing"; id: string; area_ha: number }
  | { type: "sketchRejected"; reason: SketchRejectReason }
  | { type: "pinPlaced"; point: LonLat }
  /** The map switched mode by itself (e.g. to "select" after a lot is drawn). */
  | { type: "modeChanged"; mode: MapMode }
  | { type: "error"; message: string };

/** Envelope tags so each side ignores unrelated window messages (web only). */
export const BRIDGE_SOURCE_APP = "agro-app";
export const BRIDGE_SOURCE_MAP = "agro-map";

export interface BridgeEnvelope<T> {
  source: typeof BRIDGE_SOURCE_APP | typeof BRIDGE_SOURCE_MAP;
  msg: T;
}
