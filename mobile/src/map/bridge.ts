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
  /** One finger moves the map. Lots show as clean outlines, without points. Tapping a lot posts `lotTapped`. */
  | "view"
  /** Adjust the active lot: its points show. Drag a point, tap an edge dot to add one, long-press to remove one. */
  | "select"
  /** Tap once to drop a pin (S1 fallback, S6 places). */
  | "pin";

/**
 * How the dashboard's farm map (#124) colors a lot. Without it a lot keeps the S1 drawing
 * look. The status words go in the lot's label, so color is never the only cue.
 */
export interface MapLotStyle {
  /** Fill and outline color, `#RRGGBB` (from the app's theme.ts). Anything else is ignored. */
  color: string;
  /** Short status in words, shown after the name and area, e.g. "Watch out". */
  status: string;
}

export interface MapLot {
  id: string;
  name: string;
  geometry: LotPolygon;
  style?: MapLotStyle;
}

export interface MapPlace {
  id: string;
  name: string;
  point: LonLat;
}

/** Satellite basemap candidates for decision D25 (still open). */
export type BasemapId = "esri-world-imagery" | "eox-s2cloudless" | "osm";

/**
 * Screen space (px) covered by the app's floating buttons and panels. Fitting the map
 * to the lots keeps the lots clear of it.
 */
export type MapInset = { top: number; right: number; bottom: number; left: number };

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
      inset?: MapInset;
      /**
       * The map sits inside a scrolling page (the dashboard's farm map). In "view" mode the mouse
       * wheel and, on a phone, one finger scroll the page instead of the map; + and - still zoom.
       */
      inPage?: boolean;
    }
  | { type: "setMode"; mode: MapMode; activeLotId?: string }
  /** Replace all lots (after add, rename, delete, undo). The map keeps unchanged shapes as they are. */
  | { type: "setLots"; lots: MapLot[] }
  | { type: "setPlaces"; places: MapPlace[] }
  /** The phone's position from expo-location (works without signal). */
  | { type: "gps"; lat: number; lon: number; accuracy_m?: number }
  | { type: "fitLots" }
  /** The app's panels changed size. Used by the next fit; the view doesn't move. */
  | { type: "setInset"; inset: MapInset }
  /** Zoom in to at least this level, keeping the centre (the S1 zoom check before drawing). */
  | { type: "zoomIn"; zoom: number }
  /** Move to a place the farmer searched for (#196). `label` shows on the map for a few seconds. */
  | { type: "flyTo"; lat: number; lon: number; zoom: number; label?: string };

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
  /** A tap inside a lot in "view" mode (the dashboard map selects that lot; S1 ignores it). */
  | { type: "lotTapped"; id: string }
  /** The map switched mode by itself (e.g. to "view" after a lot is drawn). */
  | { type: "modeChanged"; mode: MapMode }
  /** After every zoom, and once after `init`. The app uses it to check the map is close enough to draw. */
  | { type: "zoomChanged"; zoom: number }
  | { type: "error"; message: string };

/** Envelope tags so each side ignores unrelated window messages (web only). */
export const BRIDGE_SOURCE_APP = "agro-app";
export const BRIDGE_SOURCE_MAP = "agro-map";

export interface BridgeEnvelope<T> {
  source: typeof BRIDGE_SOURCE_APP | typeof BRIDGE_SOURCE_MAP;
  msg: T;
}
