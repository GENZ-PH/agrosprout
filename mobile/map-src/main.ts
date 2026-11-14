// The map page (#19, #20): Leaflet + Terra Draw, bundled by map-src/build.mjs into
// one offline HTML file (src/map/map-html.generated.ts). It runs in a WebView on
// Android and an <iframe> on web and talks to the app only through bridge.ts.

import { area } from "@turf/area";
import { centroid } from "@turf/centroid";
import { polygon } from "@turf/helpers";
import L from "leaflet";
import {
  TerraDraw,
  TerraDrawFreehandMode,
  type GeoJSONStoreFeatures,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawLeafletAdapter } from "terra-draw-leaflet-adapter";

import {
  type AppToMap,
  type BasemapId,
  BRIDGE_SOURCE_APP,
  BRIDGE_SOURCE_MAP,
  type MapInset,
  type MapLot,
  type MapLotStyle,
  type MapMode,
  type MapPlace,
  type MapToApp,
  type ShapeFix,
} from "../src/map/bridge";
import type { LonLat } from "../src/types";
import { cleanSketch, closeRing, corners, CLEANUP, isSimpleRing, pointInRing, ringAreaM2 } from "./cleanup";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

type RNWindow = Window & { ReactNativeWebView?: { postMessage(data: string): void } };

function post(msg: MapToApp) {
  const rn = (window as RNWindow).ReactNativeWebView;
  if (rn) rn.postMessage(JSON.stringify(msg));
  else window.parent.postMessage({ source: BRIDGE_SOURCE_MAP, msg }, "*");
}

window.addEventListener("error", (e) => post({ type: "error", message: String(e.message) }));

// ---------------------------------------------------------------------------
// Map and basemaps (D25 still open: Esri is a placeholder, one line to change)
// ---------------------------------------------------------------------------

const BASEMAPS: Record<BasemapId, { url: string; attribution: string; maxNativeZoom: number }> = {
  "esri-world-imagery": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxNativeZoom: 18,
  },
  "eox-s2cloudless": {
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    attribution:
      'Sentinel-2 cloudless 2020 &copy; <a href="https://s2maps.eu">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
    maxNativeZoom: 15,
  },
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
};
const DEFAULT_BASEMAP: BasemapId = "esri-world-imagery";

/** Iligan City, where the team is. Only the starting view; the farmer moves the map or taps Find me. */
const DEFAULT_CENTER: LonLat = [124.2452, 8.228];
const DEFAULT_ZOOM = 13;

const map = L.map("map", {
  center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]],
  zoom: DEFAULT_ZOOM,
  maxZoom: 20,
  doubleClickZoom: false,
  attributionControl: true,
  zoomControl: false,
});
map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
// Top right, under the app's Find me button (S1 puts its title bar top left).
L.control.zoom({ position: "topright" }).addTo(map);

// Redraw the tiles when the map box changes size (#114): a browser resize, a phone rotation, the
// dashboard switching to two columns, or the S1 map going full screen. Leaflet only listens for
// window resizes on its own, so watch the map element itself. One redraw per frame at most.
const mapEl = map.getContainer();
if (typeof ResizeObserver !== "undefined") {
  let queued = false;
  new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      map.invalidateSize({ pan: false });
    });
  }).observe(mapEl);
}

let tiles: L.TileLayer | null = null;
function setBasemap(id: BasemapId) {
  const b = BASEMAPS[id];
  tiles?.remove();
  // Tiles load as the farmer looks around. No bulk caching (D25 terms); offline, the
  // lots still draw on the plain background.
  tiles = L.tileLayer(b.url, { attribution: b.attribution, maxNativeZoom: b.maxNativeZoom, maxZoom: 20 }).addTo(map);
}

// ---------------------------------------------------------------------------
// Terra Draw
// ---------------------------------------------------------------------------

const LOT = "#F2C94C";
const INK = "#1B1F1A";
const WHITE = "#FFFFFF";

const adapter = new TerraDrawLeafletAdapter({ lib: L, map });

let mode: MapMode = "view";
/** Set by `init`: the map sits inside a scrolling page (the dashboard), see bridge.ts. */
let inPage = false;
let activeLotId: string | undefined;

// Dashboard farm map (#124): a lot with a style is filled with its color, and the lot the
// dashboard shows gets a thicker white outline. Lots without a style keep the S1 look.
type HexColor = `#${string}`;
const HEX = /^#[0-9a-fA-F]{6}$/;
const lotStyles = new Map<string, MapLotStyle>();
const colorOf = (id: unknown): HexColor | undefined => {
  const c = lotStyles.get(String(id))?.color;
  return c && HEX.test(c) ? (c as HexColor) : undefined;
};
const isHighlighted = (id: unknown) => mode === "view" && lotStyles.has(String(id)) && String(id) === activeLotId;

// While sketching, one finger must draw, never pan. Terra Draw turns map dragging
// back on after each stroke, so keep it off until the mode changes.
const baseSetDraggability = adapter.setDraggability.bind(adapter);
adapter.setDraggability = (enabled: boolean) => baseSetDraggability(enabled && mode !== "sketch");

let tempId = 0;
const draw = new TerraDraw({
  adapter,
  // Lot features use the app's lot id ("lot-1"); shapes being drawn get "td-N".
  idStrategy: {
    isValidId: (id) => typeof id === "string" && id.length > 0,
    getId: () => `td-${++tempId}`,
  },
  modes: [
    new TerraDrawFreehandMode({
      drawInteraction: "click-drag",
      styles: { fillColor: LOT, fillOpacity: 0.15, outlineColor: LOT, outlineWidth: 3, closingPointWidth: 0 },
    }),
    new TerraDrawPolygonMode({
      pointerDistance: 30,
      // Saved lots are stored as polygon features, so this is also how a lot looks
      // outside adjust mode: a white outline, like the selected lot. A styled lot
      // (dashboard) is filled with its own color instead.
      styles: {
        fillColor: (f) => colorOf(f.id) ?? LOT,
        fillOpacity: (f) => (colorOf(f.id) ? 0.55 : 0.25),
        outlineColor: (f) => (colorOf(f.id) && !isHighlighted(f.id) ? colorOf(f.id) : WHITE),
        outlineWidth: (f) => (isHighlighted(f.id) ? 5 : 3),
        closingPointWidth: 10,
        closingPointColor: WHITE,
        closingPointOutlineColor: INK,
        closingPointOutlineWidth: 2,
      },
    }),
    new TerraDrawSelectMode({
      // 30 px around a point counts as touching it: a 60 px target, above the 44 px minimum.
      pointerDistance: 30,
      flags: {
        polygon: {
          feature: {
            draggable: false,
            coordinates: { draggable: true, midpoints: true, deletable: true },
          },
        },
      },
      styles: {
        selectedPolygonColor: LOT,
        selectedPolygonFillOpacity: 0.3,
        selectedPolygonOutlineColor: WHITE,
        selectedPolygonOutlineWidth: 3,
        selectionPointWidth: 9,
        selectionPointColor: WHITE,
        selectionPointOutlineColor: INK,
        selectionPointOutlineWidth: 2,
        midPointWidth: 6,
        midPointColor: LOT,
        midPointOutlineColor: INK,
        midPointOutlineWidth: 1.5,
      },
    }),
  ],
});

// ---------------------------------------------------------------------------
// Lots, labels and places
// ---------------------------------------------------------------------------

const lotNames = new Map<string, string>();
/** Last outline seen per lot, to tell real edits from selection restyling. */
const lastRing = new Map<string, string>();
const labels = new Map<string, L.Tooltip>();
const placesLayer = L.layerGroup().addTo(map);
let gpsLayer: L.LayerGroup | null = null;

const ringOf = (id: string): LonLat[] | null => {
  const f = draw.getSnapshotFeature(id);
  return f && f.geometry.type === "Polygon" ? (f.geometry.coordinates[0] as LonLat[]) : null;
};
const hectares = (ring: LonLat[]) => ringAreaM2(ring) / 10_000;
const centroidOf = (ring: LonLat[]) => centroid(polygon([ring])).geometry.coordinates as LonLat;

function updateLabel(id: string, ring: LonLat[] | null) {
  labels.get(id)?.remove();
  labels.delete(id);
  if (!ring) return;
  const [lon, lat] = centroidOf(ring);
  const style = lotStyles.get(id);
  const color = colorOf(id);
  const name = escapeHtml(lotNames.get(id) ?? id);
  const ha = `${hectares(ring).toFixed(2)} ha`;
  // Dashboard (#124): the colored dot and name, then the area and status in words on a second
  // line, which `declutterLabels` hides while it would cover a neighbouring lot's label.
  const html = style
    ? `${color ? `<span class="lot-dot" style="background:${color}"></span>` : ""}<b>${name}</b>` +
      `<span class="lot-detail"><br>${escapeHtml(`${ha} · ${style.status}`)}</span>`
    : `${name} · ${ha}`;
  const tip = L.tooltip({ permanent: true, direction: "center", className: "lot-label", interactive: false })
    .setLatLng([lat, lon])
    .setContent(html)
    .addTo(map);
  labels.set(id, tip);
  if (style) queueDeclutter();
}

/**
 * Neighbouring lots' labels overlap when the whole farm fits on a small map. Each styled label
 * that would cover one already shown drops to its dot and name, or hides if that still covers
 * one. Zooming in brings them back.
 */
function declutterLabels() {
  const shown: DOMRect[] = [];
  // The lot the dashboard shows keeps its full label.
  const order = [...labels].sort(([a], [b]) => Number(b === activeLotId) - Number(a === activeLotId));
  for (const [id, tip] of order) {
    const el = tip.getElement();
    if (!el || !lotStyles.has(id)) continue;
    el.classList.remove("compact", "hidden");
    const overlaps = () => {
      const r = el.getBoundingClientRect();
      return shown.some((s) => r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top);
    };
    // First drop the second line; if the name alone still covers a label, hide it (the lot
    // keeps its color, and the dashboard's tabs and legend still name it).
    if (overlaps()) el.classList.add("compact");
    if (overlaps()) el.classList.add("hidden");
    else shown.push(el.getBoundingClientRect());
  }
}
let declutterQueued = false;
function queueDeclutter() {
  if (declutterQueued) return;
  declutterQueued = true;
  requestAnimationFrame(() => {
    declutterQueued = false;
    declutterLabels();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function lotFeature(id: string, ring: LonLat[]): GeoJSONStoreFeatures {
  return { id, type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { mode: "polygon" } };
}

/** Puts a lot's outline in Terra Draw, replacing any older one. */
function putLot(id: string, ring: LonLat[]) {
  if (draw.hasFeature(id)) draw.removeFeatures([id]);
  const [result] = draw.addFeatures([lotFeature(id, ring)]);
  lastRing.set(id, JSON.stringify(ring));
  if (!result?.valid) post({ type: "error", message: `Could not show ${id}: ${result?.reason ?? "invalid"}` });
  updateLabel(id, ring);
}

function sendLot(id: string, fix: ShapeFix) {
  const ring = ringOf(id);
  if (!ring) return;
  post({
    type: "lotChanged",
    id,
    geojson: { type: "Polygon", coordinates: [ring] },
    area_ha: hectares(ring),
    centroid: centroidOf(ring),
    fix,
  });
}

/** Mirrors the app's lot list. Shapes that did not change are left alone, so an edit in progress survives. */
function setLots(lots: MapLot[]) {
  const keep = new Set(lots.map((l) => l.id));
  // Every lot shape on the map, including one just drawn under an id the app has
  // since replaced (a new lot is saved under the farm store's id).
  for (const id of new Set([...lotNames.keys(), ...lastRing.keys()])) {
    if (!keep.has(id)) {
      if (draw.hasFeature(id)) draw.removeFeatures([id]);
      updateLabel(id, null);
      lotNames.delete(id);
      lastRing.delete(id);
      lotStyles.delete(id);
    }
  }
  for (const lot of lots) {
    lotNames.set(lot.id, lot.name);
    const restyled = JSON.stringify(lotStyles.get(lot.id)) !== JSON.stringify(lot.style);
    if (lot.style) lotStyles.set(lot.id, lot.style);
    else lotStyles.delete(lot.id);
    const ring = lot.geometry.coordinates[0];
    const current = ringOf(lot.id);
    // Re-adding the shape is what makes Terra Draw run the style functions again.
    if (!current || restyled || JSON.stringify(current) !== JSON.stringify(ring)) {
      putLot(lot.id, ring);
      // Keep the corners of the lot being edited draggable after it is re-added.
      if (mode === "select" && lot.id === activeLotId) draw.selectFeature(lot.id);
    } else updateLabel(lot.id, current);
  }
}

function setPlaces(places: MapPlace[]) {
  placesLayer.clearLayers();
  for (const p of places) {
    L.circleMarker([p.point[1], p.point[0]], { radius: 9, color: WHITE, weight: 2, fillColor: "#A04A06", fillOpacity: 1 })
      .bindTooltip(escapeHtml(p.name), { permanent: true, direction: "top", offset: [0, -10], className: "lot-label" })
      .addTo(placesLayer);
  }
}

// The part of the map covered by the app's buttons and panels (see MapInset).
let inset: MapInset = { top: 0, right: 0, bottom: 0, left: 0 };

function fitLots() {
  const rings = [...lotNames.keys()].map(ringOf).filter((r): r is LonLat[] => !!r);
  if (!rings.length) return;
  const bounds = L.latLngBounds(rings.flat().map(([lon, lat]) => [lat, lon] as [number, number]));
  map.fitBounds(bounds, {
    paddingTopLeft: [inset.left + 40, inset.top + 40],
    paddingBottomRight: [inset.right + 40, inset.bottom + 40],
    maxZoom: 18,
  });
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function setMode(next: MapMode, lotId?: string) {
  const before = { mode, activeLotId };
  mode = next;
  activeLotId = lotId;
  // The dashboard switched lots: redraw the old and the new one so the highlight moves.
  if (before.mode !== mode || before.activeLotId !== lotId) {
    for (const id of new Set([before.activeLotId, lotId])) {
      const ring = id && lotStyles.has(id) ? ringOf(id) : null;
      if (id && ring) putLot(id, ring);
    }
  }
  if (next === "sketch") {
    map.dragging.disable();
    draw.setMode("freehand");
  } else {
    // Dashboard overview ("view"): the page scrolls past the map, so the mouse wheel scrolls the
    // page and, on a phone, one finger scrolls the page too. The + and - buttons still zoom.
    if (next === "view" && inPage && L.Browser.mobile) map.dragging.disable();
    else map.dragging.enable();
    if (next === "corners") draw.setMode("polygon");
    else if (next === "select") {
      draw.setMode("select");
      if (lotId && draw.hasFeature(lotId)) draw.selectFeature(lotId);
    } else draw.setMode("static"); // "view" and "pin": lots show without points, taps don't select
  }
  if (next === "view" && inPage) map.scrollWheelZoom.disable();
  else map.scrollWheelZoom.enable();
  document.body.dataset.mode = next;
}

// A second finger while sketching: drop the half-drawn stroke and let Leaflet pinch.
document.getElementById("map")?.addEventListener(
  "touchstart",
  (e) => {
    if (mode === "sketch" && e.touches.length > 1 && draw.getMode() === "freehand") {
      draw.setMode("static");
      draw.setMode("freehand");
    }
  },
  { capture: true, passive: true },
);

map.on("click", (e: L.LeafletMouseEvent) => {
  const point: LonLat = [round6(e.latlng.lng), round6(e.latlng.lat)];
  if (mode === "pin") post({ type: "pinPlaced", point });
  else if (mode === "view") {
    // Lot shapes and labels don't take taps (interactive: false), so every tap lands here.
    const hit = [...lotNames.keys()].find((id) => {
      const ring = ringOf(id);
      return !!ring && pointInRing(point, ring);
    });
    if (hit) post({ type: "lotTapped", id: hit });
  }
});
const round6 = (v: number) => Number(v.toFixed(6));

/** A finished freehand stroke or corners shape becomes the active lot's clean outline. */
function adoptDrawnShape(tempFeatureId: string, kind: "sketch" | "corners") {
  const raw = ringOf(tempFeatureId);
  draw.removeFeatures([tempFeatureId]);
  if (!raw || !activeLotId) return;
  const lotId = activeLotId;

  let ring: LonLat[];
  let fix: ShapeFix = "none";
  if (kind === "sketch") {
    const result = cleanSketch(raw);
    if (!result.ok) {
      post({ type: "sketchRejected", reason: result.reason });
      return;
    }
    ring = result.ring;
    fix = result.fix;
  } else {
    ring = closeRing(raw);
    if (corners(ring) < 3 || !isSimpleRing(ring) || ringAreaM2(ring) < CLEANUP.minAreaM2) {
      post({ type: "sketchRejected", reason: "too_small" });
      return;
    }
  }
  putLot(lotId, ring);
  sendLot(lotId, fix);
  // A clean outline without points; the farmer taps Adjust in the app to show them.
  setMode("view", lotId);
  post({ type: "modeChanged", mode: "view" });
}

draw.on("finish", (id, context) => {
  const fid = String(id);
  if (context.mode === "freehand" && context.action === "draw") adoptDrawnShape(fid, "sketch");
  else if (context.mode === "polygon" && context.action === "draw") adoptDrawnShape(fid, "corners");
  else if (context.mode === "select" && lotNames.has(fid)) {
    updateLabel(fid, ringOf(fid));
    sendLot(fid, "none");
  }
});

// Live area while a corner is dragged. Selecting a lot also fires "update" (styling
// only), so report an edit only when the outline itself moved.
draw.on("change", (ids, type) => {
  if (type !== "update" || mode !== "select") return;
  for (const id of ids) {
    const fid = String(id);
    if (!lotNames.has(fid)) continue;
    const ring = ringOf(fid);
    if (!ring) continue;
    const key = JSON.stringify(ring);
    if (key === lastRing.get(fid)) continue;
    lastRing.set(fid, key);
    updateLabel(fid, ring);
    post({ type: "lotEditing", id: fid, area_ha: hectares(ring) });
  }
});

// ---------------------------------------------------------------------------
// Commands from the app
// ---------------------------------------------------------------------------

function receive(msg: AppToMap) {
  switch (msg.type) {
    case "init": {
      setBasemap(msg.basemap ?? DEFAULT_BASEMAP);
      if (msg.inset) inset = msg.inset;
      inPage = msg.inPage === true;
      setLots(msg.lots);
      setPlaces(msg.places);
      if (msg.lots.length) fitLots();
      else if (msg.center) map.setView([msg.center[1], msg.center[0]], msg.zoom ?? DEFAULT_ZOOM);
      setMode(msg.mode, msg.activeLotId);
      post({ type: "zoomChanged", zoom: map.getZoom() });
      break;
    }
    case "setMode":
      setMode(msg.mode, msg.activeLotId);
      break;
    case "setLots":
      setLots(msg.lots);
      break;
    case "setPlaces":
      setPlaces(msg.places);
      break;
    case "fitLots":
      fitLots();
      break;
    case "setInset":
      inset = msg.inset;
      break;
    case "zoomIn":
      if (map.getZoom() < msg.zoom) map.setZoom(msg.zoom);
      break;
    case "gps": {
      gpsLayer?.remove();
      const at: [number, number] = [msg.lat, msg.lon];
      gpsLayer = L.layerGroup([
        ...(msg.accuracy_m ? [L.circle(at, { radius: msg.accuracy_m, color: "#1D5FA8", weight: 1, fillOpacity: 0.1 })] : []),
        L.circleMarker(at, { radius: 8, color: WHITE, weight: 3, fillColor: "#1D5FA8", fillOpacity: 1 }),
      ]).addTo(map);
      map.setView(at, Math.max(map.getZoom(), 17));
      break;
    }
  }
}

(window as unknown as { agroMap: { receive: typeof receive } }).agroMap = { receive };
window.addEventListener("message", (e: MessageEvent) => {
  const data = e.data as { source?: string; msg?: AppToMap } | null;
  if (data && data.source === BRIDGE_SOURCE_APP && data.msg) receive(data.msg);
});

// While adjusting, a tap beside the lot would hide its points; keep them showing until Done.
draw.on("deselect", () => {
  if (mode !== "select" || !activeLotId) return;
  const id = activeLotId;
  setTimeout(() => {
    if (mode === "select" && activeLotId === id && draw.hasFeature(id)) draw.selectFeature(id);
  }, 0);
});

map.on("zoomend", () => {
  post({ type: "zoomChanged", zoom: map.getZoom() });
  if (lotStyles.size) queueDeclutter();
});
// The iframe / WebView can get its size after the lots are drawn.
map.on("resize", () => {
  if (lotStyles.size) queueDeclutter();
});
draw.on("ready", () => post({ type: "ready" }));
draw.start();
