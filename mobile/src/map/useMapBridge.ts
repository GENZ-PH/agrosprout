import { type Ref, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { LonLat } from "../types";
import type { AppToMap, BasemapId, MapLot, MapMode, MapPlace, MapToApp } from "./bridge";

export type MapViewHandle = {
  /** One-off commands: `gps`, `fitLots`. Lots, places and mode follow the props. */
  send: (msg: AppToMap) => void;
};

export type MapViewProps = {
  lots: MapLot[];
  places?: MapPlace[];
  mode: MapMode;
  activeLotId?: string;
  /** Starting view when there are no lots yet. */
  center?: LonLat;
  basemap?: BasemapId;
  onMessage?: (msg: MapToApp) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<MapViewHandle>;
};

const NO_PLACES: MapPlace[] = [];

/**
 * The platform-independent half of MapView: waits for the page's `ready`, sends
 * `init`, then keeps the page in step with the props. `postToPage` is the
 * platform's transport (WebView injectJavaScript or iframe postMessage).
 * Returns the handler for messages coming back from the page.
 */
export function useMapBridge(props: MapViewProps, postToPage: (msg: AppToMap) => void) {
  const { lots, places = NO_PLACES, mode, activeLotId, ref } = props;
  const ready = useRef(false);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const send = useCallback(
    (msg: AppToMap) => {
      if (ready.current) postToPage(msg);
    },
    [postToPage],
  );
  useImperativeHandle(ref, () => ({ send }), [send]);

  useEffect(() => send({ type: "setMode", mode, activeLotId }), [send, mode, activeLotId]);
  useEffect(() => send({ type: "setLots", lots }), [send, lots]);
  useEffect(() => send({ type: "setPlaces", places }), [send, places]);

  return useCallback(
    (msg: MapToApp) => {
      if (msg.type === "ready") {
        ready.current = true;
        const p = latest.current;
        postToPage({
          type: "init",
          lots: p.lots,
          places: p.places ?? NO_PLACES,
          mode: p.mode,
          activeLotId: p.activeLotId,
          center: p.center,
          basemap: p.basemap,
        });
      }
      latest.current.onMessage?.(msg);
    },
    [postToPage],
  );
}
